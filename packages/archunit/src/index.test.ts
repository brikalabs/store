import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { archRules, category, modules, rule, specifiers, stripComments } from "./index";

// The package's own directory, used as a real root to exercise file scanning without
// fixtures: src/index.ts genuinely imports "bun" and "node:fs"/"node:path".
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

describe("stripComments + specifiers", () => {
  test("collects from/import/dynamic-import specifiers", () => {
    const src = `import a from "x";\nexport { b } from "y";\nconst c = import("z");`;
    expect(specifiers(src).sort()).toEqual(["x", "y", "z"]);
  });

  test("an import inside a comment is ignored after stripping", () => {
    const src = `/* example: import { env } from "cloudflare:workers"; */\nimport a from "real";`;
    expect(specifiers(stripComments(src))).toEqual(["real"]);
    // line comments too
    expect(
      specifiers(stripComments(`// import x from "commented";\nimport y from "kept";`)),
    ).toEqual(["kept"]);
  });
});

describe("ArchRules engine", () => {
  test("flags a real banned import, naming the file", () => {
    const violations = archRules({ root: ROOT })
      .rule("no node built-ins")
      .filesMatching("src/index.ts")
      .mayNotImport(modules("node:fs", "node:path"))
      .check();
    expect(violations.length).toBe(2); // node:fs + node:path
    expect(violations[0]).toContain("src/index.ts");
    expect(violations[0]).toContain("no node built-ins");
  });

  test("filesMatching expands a directory to its TS sources", () => {
    // "src" is expanded to "src/**/*.{ts,tsx}"; index.ts imports node:fs, so it is flagged
    // (and index.test.ts is excluded as a test file).
    const violations = archRules({ root: ROOT })
      .rule("no node:fs")
      .filesMatching("src")
      .mayNotImport(modules("node:fs"))
      .check();
    expect(violations.some((v) => v.includes("src/index.ts"))).toBe(true);
  });

  test("holds when nothing matches", () => {
    const violations = archRules({ root: ROOT })
      .rule("no lodash")
      .filesMatching("src/index.ts")
      .mayNotImport(modules("lodash"))
      .check();
    expect(violations).toEqual([]);
  });

  test("`except` removes a file from a rule", () => {
    const violations = archRules({ root: ROOT })
      .rule("no node built-ins")
      .filesMatching("src/index.ts")
      .except("src/index.ts")
      .mayNotImport(modules("node:fs"))
      .check();
    expect(violations).toEqual([]);
  });

  test("rules chain, and checkEach yields one result per rule", () => {
    const results = archRules({ root: ROOT })
      .rule("a")
      .filesMatching("src/index.ts")
      .mayNotImport(modules("node:fs"))
      .rule("b")
      .filesMatching("src/index.ts")
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
        .filesMatching("src/index.ts")
        .mayNotImport(modules("node:fs"))
        .assert(),
    ).toThrow(/violation/);
    expect(() =>
      archRules({ root: ROOT })
        .rule("no lodash")
        .filesMatching("src/index.ts")
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
