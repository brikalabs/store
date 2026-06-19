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

  test("shared packages are database-free (only the db package touches the ORM)", () => {
    rule()
      .filesMatching("packages/*/src")
      .except("packages/db/src")
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
