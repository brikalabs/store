import { expect, test } from "bun:test";
import { archTest, modules, rule } from "./test";

// `archTest` registers a real bun test; this rule is clean (the package imports no
// lodash), so it passes - and running it exercises archTest's body for coverage.
archTest(
  "archTest registers a passing rule",
  rule().filesMatching("packages/archunit/src").mayNotImport(modules("lodash")),
);

test("the engine is re-exported from the /test entry", () => {
  expect(typeof archTest).toBe("function");
  expect(typeof rule).toBe("function");
  expect(typeof modules).toBe("function");
});
