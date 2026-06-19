import { rule } from "@brika/archunit";
import { describe, test } from "bun:test";

/**
 * Naming conventions, enforced the same way as the layering rules. `mustBeNamed` checks each
 * matched file's name; the `classesMust*` family checks the classes a file declares. Together
 * they keep the layers legible: a file's name tells you what it is, and a class's name tells
 * you which layer it belongs to (and which infra, if any, it binds to).
 */

// A source file is kebab-case: lowercase words joined by single hyphens, then `.ts`.
const KEBAB_TS = /^[a-z0-9]+(-[a-z0-9]+)*\.ts$/;
// A class is PascalCase: an uppercase letter then letters/digits, no separators.
const PASCAL_CASE = /^[A-Z][A-Za-z0-9]*$/;

describe("filenames", () => {
  test("the domain core is kebab-case", () => {
    rule()
      .filesMatching("packages/registry-core/src")
      .mustBeNamed(KEBAB_TS)
      .assert();
  });

  test("registry controllers are kebab-case", () => {
    rule()
      .filesMatching("apps/registry/src/controllers")
      .mustBeNamed(KEBAB_TS)
      .assert();
  });

  test("registry adapters are kebab-case", () => {
    rule()
      .filesMatching("apps/registry/src/adapters")
      .mustBeNamed(KEBAB_TS)
      .assert();
  });
});

describe("class names", () => {
  test("domain services are suffixed Service", () => {
    rule()
      .filesMatching("packages/registry-core/src")
      .classesMustBeSuffixed("Service")
      .assert();
  });

  test("the domain core leaks no infra into its class names (no D1*/R2*/Cf*)", () => {
    rule()
      .filesMatching("packages/registry-core/src")
      .classesMustNotBeNamed(/^(D1|R2|Cf|Cloudflare)/)
      .assert();
  });

  test("adapter classes are PascalCase", () => {
    rule()
      .filesMatching("apps/registry/src/adapters")
      .classesMustBeNamed(PASCAL_CASE)
      .assert();
  });

  test("D1-backed adapters (d1-*.ts) declare D1-prefixed classes", () => {
    rule()
      .filesMatching("apps/registry/src/adapters/d1-*.ts")
      .classesMustBePrefixed("D1")
      .assert();
  });

  test("R2-backed adapters (r2-*.ts) declare R2-prefixed classes", () => {
    rule()
      .filesMatching("apps/registry/src/adapters/r2-*.ts")
      .classesMustBePrefixed("R2")
      .assert();
  });
});
