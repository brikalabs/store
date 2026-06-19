import { describe, test } from "bun:test";
import { modules, rule } from "@brika/archunit";

/**
 * The repo's architecture rules (ArchUnit-style), written as ordinary tests so they group
 * naturally with `describe` and split into as many cases as you like. Each rule ends in
 * `.assert()`, which fails the test naming the offending file + import. Globs resolve from
 * the repo root. Add a layer by adding a `test`.
 */

// Import categories: named sets of module specifiers.
const PLATFORM = modules("cloudflare:", "@cloudflare/", "wrangler");
const ORM = modules("drizzle-orm", "@brika/store-db");
const HTTP = modules("hono", "@brika/router");

describe("packages", () => {
  // Shared packages are Cloudflare-free - only apps wire the platform. (db is the driver
  // package and may import the ORM; no package imports Cloudflare.)
  test("are Cloudflare-free (only apps use Cloudflare)", () => {
    rule()
      .filesMatching("packages/*/src")
      .mayNotImport(PLATFORM)
      .assert();
  });

  // The domain core (any *-core package) speaks only ports.
  test("the domain core (*-core) depends on no database/ORM or HTTP framework", () => {
    rule()
      .filesMatching("packages/*-core/src")
      .mayNotImport(ORM, HTTP)
      .assert();
  });

  // The domain core stays runtime-agnostic: no Node built-ins, so it runs identically
  // under Bun (tests) and workerd (prod).
  test("the domain core (*-core) is runtime-agnostic (no Node built-ins)", () => {
    rule()
      .filesMatching("packages/*-core/src")
      .mayNotImport(modules("node:"))
      .assert();
  });

  // Persistence lives in the db package; every other shared package is database-free.
  test("shared packages are database-free (only the db package touches the ORM)", () => {
    rule()
      .filesMatching("packages/*/src")
      .except("packages/db/src")
      .mayNotImport(ORM)
      .assert();
  });

  // The router is a platform-free HTTP layer (Hono is allowed; the database is not).
  test("the router is database-free", () => {
    rule()
      .filesMatching("packages/router/src")
      .mayNotImport(ORM)
      .assert();
  });

  // The router is generic HTTP plumbing - it must not depend on the registry domain.
  test("the router does not depend on the domain core", () => {
    rule()
      .filesMatching("packages/router/src")
      .mayNotImport(modules("@brika/registry-core"))
      .assert();
  });
});

describe("apps", () => {
  // Apps are leaves: they share code through packages, never by importing each other.
  test("do not import each other", () => {
    rule()
      .filesMatching("apps/*/src")
      .mayNotImport(modules("@brika/registry", "@brika/registry-cli", "@brika/store-web"))
      .assert();
  });
});

describe("apps/registry", () => {
  // Controllers go through ports on `ctx`, never the database.
  test("controllers never import the database/ORM (use a port on ctx)", () => {
    rule()
      .filesMatching("apps/*/src/controllers")
      .mayNotImport(ORM)
      .assert();
  });

  // The database is reached only through adapters + the composition root (services.ts /
  // index.ts). (apps/web is not yet hexagonal; add it once it is.)
  test("the database is reached only through adapters + the composition root", () => {
    rule()
      .filesMatching("apps/registry/src")
      .except(
        "apps/registry/src/adapters",
        "apps/registry/src/services.ts",
        "apps/registry/src/index.ts",
      )
      .mayNotImport(ORM)
      .assert();
  });
});
