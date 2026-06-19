import { rule } from "@brika/archunit";
import { describe, test } from "bun:test";

/**
 * Naming conventions, enforced the same way as the layering rules. `mustBeNamed` checks each
 * matched file's name; `classesMustBePrefixed` checks the classes a file declares. These keep
 * the adapter layer legible: a file's name tells you the vendor, and so does its class.
 */

describe("filenames", () => {
  test("registry adapters are kebab-case", () => {
    rule()
      .filesMatching("apps/registry/src/adapters")
      .mustBeNamed(/^[a-z0-9]+(-[a-z0-9]+)*\.ts$/)
      .assert();
  });
});

describe("class names", () => {
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
