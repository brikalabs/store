import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { archRules, category, classNames, modules, rule, specifiers, stripComments } from "./index";

// The package's own directory, used as a real root to exercise file scanning without
// fixtures: src/index.ts genuinely imports "bun" and "node:fs"/"node:path", and src/rules.ts
// declares `class ArchRules`.
const ROOT = join(import.meta.dir, "..");

describe("modules", () => {
  test("a bare name matches itself and its submodules", () => {
    const c = modules("drizzle-orm", "@brika/store-db");
    expect(c.test("drizzle-orm")).toBe(true);
    expect(c.test("drizzle-orm/d1")).toBe(true);
    expect(c.test("@brika/store-db")).toBe(true);
    expect(c.test("drizzle-ormx")).toBe(false); // not a submodule boundary
    expect(c.test("zod")).toBe(false);
  });

  test("a name ending in : or / is a prefix match", () => {
    const c = modules("cloudflare:", "@cloudflare/");
    expect(c.test("cloudflare:workers")).toBe(true);
    expect(c.test("@cloudflare/workers-types")).toBe(true);
    expect(c.test("cloudflarewat")).toBe(false);
  });

  test("labels read well for one vs many", () => {
    expect(modules("hono").label).toBe('"hono"');
    expect(modules("a", "b").label).toContain("one of");
  });
});

describe("stripComments + specifiers + classNames", () => {
  test("collects from/import/dynamic-import specifiers", () => {
    const src = `import a from "x";\nexport { b } from "y";\nconst c = import("z");`;
    expect(specifiers(src)).toEqual(["x", "y", "z"]);
  });

  test("collects declared class names (export / abstract / default)", () => {
    const src = `export class A {}\nabstract class B {}\nexport default class C {}\nclass D {}`;
    expect(classNames(src)).toEqual(["A", "B", "C", "D"]);
  });

  test("a declaration inside a comment is ignored after stripping", () => {
    const src = `/* example: import { env } from "cloudflare:workers"; class Fake {} */\nimport a from "real";\nclass Real {}`;
    expect(specifiers(stripComments(src))).toEqual(["real"]);
    expect(classNames(stripComments(src))).toEqual(["Real"]);
    // line comments too
    expect(
      specifiers(stripComments(`// import x from "commented";\nimport y from "kept";`)),
    ).toEqual(["kept"]);
  });
});

describe("ArchRules engine (imports)", () => {
  test("flags a real banned import, naming the file", () => {
    const violations = archRules({ root: ROOT })
      .rule("no node built-ins")
      .filesMatching("src/scan.ts")
      .mayNotImport(modules("node:fs"))
      .check();
    expect(violations.length).toBe(1);
    expect(violations[0]).toContain("src/scan.ts");
    expect(violations[0]).toContain("no node built-ins");
  });

  test("filesMatching expands a directory to its TS sources", () => {
    // "src" is expanded to "src/**/*.{ts,tsx}"; scan.ts imports node:fs, so it is flagged
    // (and *.test.ts is excluded as a test file).
    const violations = archRules({ root: ROOT })
      .rule("no node:fs")
      .filesMatching("src")
      .mayNotImport(modules("node:fs"))
      .check();
    expect(violations.some((v) => v.includes("src/scan.ts"))).toBe(true);
  });

  test("holds when nothing matches", () => {
    const violations = archRules({ root: ROOT })
      .rule("no lodash")
      .filesMatching("src/scan.ts")
      .mayNotImport(modules("lodash"))
      .check();
    expect(violations).toEqual([]);
  });

  test("`except` removes a file from a rule", () => {
    const violations = archRules({ root: ROOT })
      .rule("no node built-ins")
      .filesMatching("src/scan.ts")
      .except("src/scan.ts")
      .mayNotImport(modules("node:fs"))
      .check();
    expect(violations).toEqual([]);
  });

  test("rules chain, and checkEach yields one result per rule", () => {
    const results = archRules({ root: ROOT })
      .rule("a")
      .filesMatching("src/scan.ts")
      .mayNotImport(modules("node:fs"))
      .rule("b")
      .filesMatching("src/scan.ts")
      .mayNotImport(modules("lodash"))
      .checkEach();
    expect(results.map((r) => r.description)).toEqual(["a", "b"]);
    expect(results[0]?.violations.length).toBe(1);
    expect(results[1]?.violations).toEqual([]);
  });

  test("category is the raw escape hatch", () => {
    const odd = category("an odd-length specifier", (s) => s.length % 2 === 1);
    expect(odd.test("bun")).toBe(true);
    expect(odd.test("node:fs")).toBe(true);
  });

  test("assert throws on violation and passes when clean", () => {
    expect(() =>
      archRules({ root: ROOT })
        .rule("no node built-ins")
        .filesMatching("src/scan.ts")
        .mayNotImport(modules("node:fs"))
        .assert(),
    ).toThrow(/violation/);
    expect(() =>
      archRules({ root: ROOT })
        .rule("no lodash")
        .filesMatching("src/scan.ts")
        .mayNotImport(modules("lodash"))
        .assert(),
    ).not.toThrow();
  });

  test("top-level rule() builds a single rule against the cwd", () => {
    // Run from the repo root (where bun test runs); a clean rule must not throw.
    expect(() =>
      rule()
        .filesMatching("packages/archunit/src/index.ts")
        .mayNotImport(modules("lodash"))
        .assert(),
    ).not.toThrow();
  });
});

describe("ArchRules engine (filenames)", () => {
  test("holds when every file matches the name pattern", () => {
    // src/*.ts are all lowercase words; test files are excluded.
    const violations = archRules({ root: ROOT })
      .rule("sources are lowercase")
      .filesMatching("src")
      .mustBeNamed(/^[a-z]+\.ts$/)
      .check();
    expect(violations).toEqual([]);
  });

  test("flags a file whose name breaks the convention", () => {
    const violations = archRules({ root: ROOT })
      .rule("sources start with z")
      .filesMatching("src/scan.ts")
      .mustBeNamed(/^z/)
      .check();
    expect(violations.length).toBe(1);
    expect(violations[0]).toContain("src/scan.ts");
    expect(violations[0]).toContain("is not named like");
  });
});

describe("ArchRules engine (class names)", () => {
  test("holds when every declared class has the prefix", () => {
    const violations = archRules({ root: ROOT })
      .rule("engine classes are Arch*")
      .filesMatching("src/rules.ts")
      .classesMustBePrefixed("Arch")
      .check();
    expect(violations).toEqual([]);
  });

  test("flags a class without the required prefix", () => {
    const violations = archRules({ root: ROOT })
      .rule("classes must be D1*")
      .filesMatching("src/rules.ts")
      .classesMustBePrefixed("D1")
      .check();
    expect(violations.length).toBe(1);
    expect(violations[0]).toContain("declares class ArchRules");
    expect(violations[0]).toContain('not prefixed "D1"');
  });
});
