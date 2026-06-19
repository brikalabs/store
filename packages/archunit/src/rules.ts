/** The rule engine: a fluent builder over file checks, runnable as a CLI list or as tests. */

import { join } from "node:path";
import type { Category } from "./categories";
import { classesOf, importsOf, matchesGlob, scan, toFileGlob } from "./scan";

/** What a check sees for one file: its repo-relative path, basename, imports, and classes. */
export interface FileInfo {
  readonly rel: string;
  readonly basename: string;
  readonly imports: string[];
  readonly classes: string[];
}

/** A check over a single file: returns one message per violation (empty when it holds). */
export type FileCheck = (file: FileInfo) => string[];

/** A rule's result: its description and the violations found (empty when it holds). */
export interface RuleResult {
  readonly description: string;
  readonly violations: string[];
}

interface RuleSpec {
  readonly description: string;
  readonly include: string[];
  readonly exclude: string[];
  readonly checks: FileCheck[];
}

/** Fluent builder for one rule; also lets you start the next rule or run the checks. */
export interface RuleBuilder {
  /** Files this rule applies to (repo-relative globs; a directory expands to its TS sources). */
  filesMatching(...globs: string[]): RuleBuilder;
  /** Globs to exclude from this rule (on top of the always-ignored test files). */
  except(...globs: string[]): RuleBuilder;
  /** Forbid importing any of these module categories. */
  mayNotImport(...categories: Category[]): RuleBuilder;
  /** Require every matched file's name to match `pattern` (a filename convention). */
  mustBeNamed(pattern: RegExp): RuleBuilder;
  /** Require every class declared in a matched file to start with `prefix` (a naming convention). */
  classesMustBePrefixed(prefix: string): RuleBuilder;
  /** Start the next rule. */
  rule(description: string): RuleBuilder;
  /** Every violation across all rules, prefixed by rule (a flat list). */
  check(): string[];
  /** Each rule with the violations it found. */
  checkEach(): RuleResult[];
  /** Throw if any rule is violated - call inside a `test()` to make it an arch test. */
  assert(): void;
}

const TEST_GLOBS = ["**/*.test.ts", "**/*.test.tsx", "**/*.spec.ts", "**/test-harness.ts"];

export interface ArchRulesOptions {
  /** Repo root the globs resolve against (default: the current working directory). */
  readonly root?: string;
  /** Globs always excluded (default: test files + test harnesses). */
  readonly ignore?: string[];
}

function forbidImports(categories: Category[]): FileCheck {
  return (file) =>
    file.imports.flatMap((specifier) => {
      const hit = categories.find((c) => c.test(specifier));
      return hit !== undefined ? [`imports "${specifier}" (${hit.label})`] : [];
    });
}

function requireFilename(pattern: RegExp): FileCheck {
  return (file) => (pattern.test(file.basename) ? [] : [`is not named like ${pattern}`]);
}

function requireClassPrefix(prefix: string): FileCheck {
  return (file) =>
    file.classes
      .filter((name) => !name.startsWith(prefix))
      .map((name) => `declares class ${name}, not prefixed "${prefix}"`);
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
 *     rule().filesMatching("packages/*-core/src").mayNotImport(ORM).assert();
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

  /** Declare a rule; chain `.filesMatching(...)` + a check, then `.rule(...)` again. */
  rule(description: string): RuleBuilder {
    const spec: RuleSpec = { description, include: [], exclude: [...this.#ignore], checks: [] };
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
        spec.checks.push(forbidImports(categories));
        return builder;
      },
      mustBeNamed: (pattern) => {
        spec.checks.push(requireFilename(pattern));
        return builder;
      },
      classesMustBePrefixed: (prefix) => {
        spec.checks.push(requireClassPrefix(prefix));
        return builder;
      },
      rule: (next) => this.rule(next),
      check: () => this.check(),
      checkEach: () => this.checkEach(),
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

  /**
   * Throw if any rule is violated (listing the offending file). Call it inside a `test()`
   * so the rule becomes an architecture test - works with any runner:
   *
   *   test("the domain core has no database", () => {
   *     rule().filesMatching("packages/*-core/src").mayNotImport(ORM).assert();
   *   });
   */
  assert(): void {
    const violations = this.check();
    if (violations.length > 0) {
      throw new Error(`architecture: ${violations.length} violation(s):\n${violations.join("\n")}`);
    }
  }

  #violationsFor(spec: RuleSpec): string[] {
    const violations: string[] = [];
    for (const rel of this.#filesFor(spec.include)) {
      if (spec.exclude.some((g) => matchesGlob(g, rel))) continue;
      const absolutePath = join(this.#root, rel);
      const file: FileInfo = {
        rel,
        basename: rel.slice(rel.lastIndexOf("/") + 1),
        imports: importsOf(absolutePath),
        classes: classesOf(absolutePath),
      };
      for (const check of spec.checks) {
        for (const message of check(file)) violations.push(`${rel} ${message}`);
      }
    }
    return violations;
  }

  #filesFor(globs: string[]): Set<string> {
    const files = new Set<string>();
    for (const glob of globs) {
      for (const rel of scan(this.#root, glob)) files.add(rel);
    }
    return files;
  }
}
