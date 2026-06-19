/**
 * A tiny ArchUnit-style architecture-rule engine. Declare layering rules fluently, by
 * package/folder glob, so they scale as packages/controllers/adapters are added:
 *
 *   archRules()
 *     .rule("the domain core imports no database")
 *     .filesMatching("packages/*-core/src/**\/*.ts")
 *     .mayNotImport(modules("drizzle-orm", "@brika/store-db"));
 *
 * Run them as a lint CLI (`check()` -> violation lines) or as test cases
 * (`toTestCases()` -> one assertion per rule). Import-aware: comments are stripped, so an
 * `import` inside a JSDoc example is not counted. Bun runtime (uses `Bun.Glob`).
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Glob } from "bun";

/** A named class of module specifier, e.g. "the database/ORM". */
export interface Category {
  readonly label: string;
  readonly test: (specifier: string) => boolean;
}

/** Build a category from raw predicate logic (the escape hatch; prefer {@link modules}). */
export function category(label: string, test: (specifier: string) => boolean): Category {
  return { label, test };
}

/**
 * A category matching a set of module names/prefixes (the ergonomic common case):
 *
 *   modules("drizzle-orm", "@brika/store-db")  // matches those + their submodules
 *   modules("cloudflare:", "@cloudflare/")     // prefix match (ends in : or /)
 *
 * A bare name matches itself and its submodules (`drizzle-orm` -> `drizzle-orm/d1`); a
 * name ending in `:` or `/` is a prefix match.
 */
export function modules(...names: string[]): Category {
  const quoted = names.map((n) => `"${n}"`).join(", ");
  const label = names.length === 1 ? quoted : `one of ${quoted}`;
  return {
    label,
    test: (s) =>
      names.some((name) =>
        name.endsWith(":") || name.endsWith("/")
          ? s.startsWith(name)
          : s === name || s.startsWith(`${name}/`),
      ),
  };
}

/** Strip block + line comments so an `import ... from "x"` inside a comment is not counted. */
export function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

/** Every import/export module specifier in a source file (comments should be stripped first). */
export function specifiers(source: string): string[] {
  const out: string[] = [];
  const re = /\b(?:from|import)\b\s*\(?\s*["']([^"']+)["']/g;
  let match = re.exec(source);
  while (match !== null) {
    if (match[1] !== undefined) out.push(match[1]);
    match = re.exec(source);
  }
  return out;
}

/** A rule's result: its description and the violations found (empty when it holds). */
export interface RuleResult {
  readonly description: string;
  readonly violations: string[];
}

/** A rule turned into a test case: a name and an `assert` that throws on violation. */
export interface ArchTestCase {
  readonly name: string;
  readonly assert: () => void;
}

const TEST_GLOBS = ["**/*.test.ts", "**/*.test.tsx", "**/*.spec.ts", "**/test-harness.ts"];

/**
 * Expand a directory/package-shaped pattern to all the TS sources under it, so rules can
 * be written by folder: `filesMatching("packages/*-core/src")` instead of
 * `"packages/*-core/src/**\/*.ts"`. A pattern that already targets files (ends in
 * `.ts`/`.tsx`, or contains an explicit `*.ext` / brace glob) is left as-is.
 */
function toFileGlob(pattern: string): string {
  if (/\.(ts|tsx)$/.test(pattern) || /\*\.[a-z{]/.test(pattern)) return pattern;
  return `${pattern.replace(/\/+$/, "")}/**/*.{ts,tsx}`;
}

interface RuleSpec {
  readonly description: string;
  readonly include: string[];
  readonly exclude: string[];
  readonly forbidden: Category[];
}

/** Fluent builder for one rule; also lets you start the next rule or run the checks. */
export interface RuleBuilder {
  /** Files this rule applies to (repo-relative globs). */
  filesMatching(...globs: string[]): RuleBuilder;
  /** Globs to exclude from this rule (on top of the always-ignored test files). */
  except(...globs: string[]): RuleBuilder;
  /** Import categories this rule forbids. */
  mayNotImport(...categories: Category[]): RuleBuilder;
  /** Start the next rule. */
  rule(description: string): RuleBuilder;
  check(): string[];
  checkEach(): RuleResult[];
  toTestCases(): ArchTestCase[];
  /** Throw if any rule is violated - for asserting inline in a test. */
  assert(): void;
}

export interface ArchRulesOptions {
  /** Repo root the globs resolve against (default: the current working directory). */
  readonly root?: string;
  /** Globs always excluded (default: test files + test harnesses). */
  readonly ignore?: string[];
}

/** Start a rule set. */
export function archRules(options: ArchRulesOptions = {}): ArchRules {
  return new ArchRules(options);
}

/**
 * Start a single rule against the current working directory - the inline form for a
 * `*.test.ts`, where the test name is the description and `.assert()` is the assertion:
 *
 *   test("the domain core has no database", () => {
 *     rule().filesMatching("packages/*-core/src/**\/*.ts").mayNotImport(ORM).assert();
 *   });
 */
export function rule(description = ""): RuleBuilder {
  return new ArchRules().rule(description);
}

export class ArchRules {
  readonly #root: string;
  readonly #ignore: string[];
  readonly #rules: RuleSpec[] = [];

  constructor(options: ArchRulesOptions = {}) {
    this.#root = options.root ?? process.cwd();
    this.#ignore = options.ignore ?? TEST_GLOBS;
  }

  /** Declare a rule; chain `.filesMatching(...).mayNotImport(...)`, then `.rule(...)` again. */
  rule(description: string): RuleBuilder {
    const spec: RuleSpec = { description, include: [], exclude: [...this.#ignore], forbidden: [] };
    this.#rules.push(spec);
    // A closure (not Object.create) so the terminal methods reach this instance's
    // private #rules - private fields do not traverse a prototype chain.
    const builder: RuleBuilder = {
      filesMatching: (...globs) => {
        spec.include.push(...globs.map(toFileGlob));
        return builder;
      },
      except: (...globs) => {
        spec.exclude.push(...globs.map(toFileGlob));
        return builder;
      },
      mayNotImport: (...categories) => {
        spec.forbidden.push(...categories);
        return builder;
      },
      rule: (next) => this.rule(next),
      check: () => this.check(),
      checkEach: () => this.checkEach(),
      toTestCases: () => this.toTestCases(),
      assert: () => this.assert(),
    };
    return builder;
  }

  /** Each rule with the violations it found - one entry per rule (so each can be a test). */
  checkEach(): RuleResult[] {
    return this.#rules.map((spec) => ({
      description: spec.description,
      violations: this.#violationsFor(spec),
    }));
  }

  /** Every violation across all rules, prefixed by rule (a flat list, for a CLI). */
  check(): string[] {
    return this.checkEach().flatMap((r) => r.violations.map((v) => `[${r.description}]\n  ${v}`));
  }

  /** Throw if any rule is violated (listing them) - for asserting inline in a test. */
  assert(): void {
    const violations = this.check();
    if (violations.length > 0) {
      throw new Error(`architecture: ${violations.length} violation(s):\n${violations.join("\n")}`);
    }
  }

  /** One test case per rule; `assert` throws (listing the offending imports) on violation. */
  toTestCases(): ArchTestCase[] {
    return this.checkEach().map((r) => ({
      name: r.description,
      assert: () => {
        if (r.violations.length > 0) {
          throw new Error(`${r.violations.length} violation(s):\n  ${r.violations.join("\n  ")}`);
        }
      },
    }));
  }

  #violationsFor(spec: RuleSpec): string[] {
    const violations: string[] = [];
    const excluded = spec.exclude.map((g) => new Glob(g));
    for (const rel of this.#filesFor(spec.include)) {
      if (excluded.some((g) => g.match(rel))) continue;
      const source = stripComments(readFileSync(join(this.#root, rel), "utf8"));
      for (const specifier of specifiers(source)) {
        const hit = spec.forbidden.find((c) => c.test(specifier));
        if (hit !== undefined) violations.push(`${rel} imports "${specifier}" (${hit.label})`);
      }
    }
    return violations;
  }

  #filesFor(globs: string[]): Set<string> {
    const files = new Set<string>();
    for (const glob of globs) {
      for (const rel of new Glob(glob).scanSync(this.#root)) files.add(rel);
    }
    return files;
  }
}
