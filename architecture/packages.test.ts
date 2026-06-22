import { modules, rule } from "@brika/archunit";
import { describe, test } from "bun:test";
import { HTTP, ORM, PLATFORM } from "./categories";

/**
 * Architecture rules for the shared packages, written as ordinary tests so they group with
 * `describe` and split into as many cases as you like. Each rule ends in `.assert()`, which
 * fails the test naming the offending file. Globs resolve from the repo root.
 */

describe("packages", () => {
  test("are Cloudflare-free (only apps use Cloudflare)", () => {
    rule()
      .filesMatching("packages/*/src")
      .mayNotImport(PLATFORM)
      .assert();
  });

  test("the domain core (*-core) depends on no database/ORM or HTTP framework", () => {
    rule()
      .filesMatching("packages/*-core/src")
      .mayNotImport(ORM, HTTP)
      .assert();
  });

  test("the domain core (*-core) is runtime-agnostic (no Node built-ins)", () => {
    rule()
      .filesMatching("packages/*-core/src")
      .mayNotImport(modules("node:"))
      .assert();
  });

  test("shared packages are database-free (only the db + wiring packages touch the ORM)", () => {
    rule()
      .filesMatching("packages/*/src")
      // db owns the ORM; registry-runtime is the composition/wiring tier that binds domain
      // ports to the db adapters, so it legitimately imports both (no domain logic lives here).
      .except("packages/db/src", "packages/registry-runtime/src")
      .mayNotImport(ORM)
      .assert();
  });

  test("the router is database-free", () => {
    rule()
      .filesMatching("packages/router/src")
      .mayNotImport(ORM)
      .assert();
  });

  test("the router does not depend on the domain core", () => {
    rule()
      .filesMatching("packages/router/src")
      .mayNotImport(modules("@brika/registry-core"))
      .assert();
  });
});
