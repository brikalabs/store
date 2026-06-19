import { test } from "bun:test";

/**
 * Bun-test binding for `@brika/archunit`. Import from `@brika/archunit/test` to register
 * an architecture rule as a `bun test` case in one line - the rule's `assert()` is the
 * test body, so a violation fails the test naming the offending file + import:
 *
 *   import { archTest, modules, rule } from "@brika/archunit/test";
 *
 *   archTest("the domain core has no database",
 *     rule().filesMatching("packages/*-core/src").mayNotImport(modules("drizzle-orm")));
 *
 * Re-exports the engine, so a test file imports everything from here.
 */
export * from "./index";

/** Register an architecture rule (anything with `assert()`) as a `bun test` case. */
export function archTest(name: string, rule: { assert: () => void }): void {
  test(name, () => {
    rule.assert();
  });
}
