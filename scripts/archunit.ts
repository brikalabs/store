/**
 * A tiny ArchUnit-style architecture-rule engine. Rules are declared fluently by
 * package/folder glob, not hardcoded per path, so they scale as packages, controllers,
 * and adapters are added:
 *
 *   arch.rule("the domain core imports no database")
 *     .filesMatching("packages/*-core/src/**\/*.ts")
 *     .mayNotImport(ORM, HTTP);
 *
 * An import "category" is a named predicate over a module specifier. `check()` scans the
 * matched files (comments stripped, so an import inside a JSDoc example is ignored) and
 * returns a violation line per banned import. Tests are excluded by default.
 */
import { Glob } from "bun";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/** A named class of module specifier, e.g. "the database/ORM". */
export interface Category {
  readonly label: string;
  readonly test: (specifier: string) => boolean;
}

export function category(label: string, test: (specifier: string) => boolean): Category {
  return { label, test };
}

/** Strip block + line comments so an `import ... from "x"` inside a comment is not counted. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

/** Every import/export module specifier in a source file. */
function specifiers(source: string): string[] {
  const out: string[] = [];
  const re = /\b(?:from|import)\b\s*\(?\s*["']([^"']+)["']/g;
  let match = re.exec(source);
  while (match !== null) {
    if (match[1] !== undefined) out.push(match[1]);
    match = re.exec(source);
  }
  return out;
}

const TEST_GLOBS = ["**/*.test.ts", "**/*.test.tsx", "**/*.spec.ts", "**/test-harness.ts"];

interface RuleSpec {
  readonly description: string;
  readonly include: string[];
  readonly exclude: string[];
  readonly forbidden: Category[];
}

interface RuleBuilder {
  filesMatching(...globs: string[]): RuleBuilder;
  except(...globs: string[]): RuleBuilder;
  mayNotImport(...categories: Category[]): RuleBuilder;
}

export class ArchRules {
  readonly #root: string;
  readonly #rules: RuleSpec[] = [];

  constructor(root: string) {
    this.#root = root;
  }

  rule(description: string): RuleBuilder {
    const spec: RuleSpec = { description, include: [], exclude: [...TEST_GLOBS], forbidden: [] };
    this.#rules.push(spec);
    const builder: RuleBuilder = {
      filesMatching: (...globs) => {
        spec.include.push(...globs);
        return builder;
      },
      except: (...globs) => {
        spec.exclude.push(...globs);
        return builder;
      },
      mayNotImport: (...categories) => {
        spec.forbidden.push(...categories);
        return builder;
      },
    };
    return builder;
  }

  /** Run every rule; returns a violation line per banned import (empty when all hold). */
  check(): string[] {
    const violations: string[] = [];
    for (const spec of this.#rules) {
      const excluded = spec.exclude.map((g) => new Glob(g));
      for (const rel of this.#filesFor(spec.include)) {
        if (excluded.some((g) => g.match(rel))) continue;
        const source = stripComments(readFileSync(join(this.#root, rel), "utf8"));
        for (const specifier of specifiers(source)) {
          const hit = spec.forbidden.find((c) => c.test(specifier));
          if (hit !== undefined) {
            violations.push(`[${spec.description}]\n  ${rel} imports "${specifier}" (${hit.label})`);
          }
        }
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
