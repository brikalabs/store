import { describe, test } from "bun:test";
import { modules, rule } from "@brika/archunit";

/**
 * The repo's architecture rules, written directly as tests (ArchUnit-style). Each rule is
 * a normal `bun test` case: declare what a layer may not import, then `.assert()`. A
 * violation fails the test, naming the offending file + import. Globs resolve from the
 * repo root (the cwd `bun test` runs in). Add a package/app/layer by adding a `test`.
 */

// Import categories: named sets of module specifiers.
const PLATFORM = modules("cloudflare:", "@cloudflare/", "wrangler");
const ORM = modules("drizzle-orm", "@brika/store-db");
const HTTP = modules("hono", "@brika/router");

describe("architecture", () => {
  // Shared packages are Cloudflare-free - only apps wire the platform. (db is the driver
  // package and may import the ORM; no package imports Cloudflare.)
  test("shared packages are Cloudflare-free (only apps use Cloudflare)", () => {
    rule().filesMatching("packages/*/src").mayNotImport(PLATFORM).assert();
  });

  // The domain core (any *-core package) speaks only ports.
  test("the domain core (*-core) depends on no database/ORM or HTTP framework", () => {
    rule().filesMatching("packages/*-core/src").mayNotImport(ORM, HTTP).assert();
  });

  // The router is a platform-free HTTP layer (Hono is allowed; the database is not).
  test("the router is database-free", () => {
    rule().filesMatching("packages/router/src").mayNotImport(ORM).assert();
  });

  // Controllers go through ports on `ctx`, never the database, in any app.
  test("controllers never import the database/ORM (use a port on ctx)", () => {
    rule().filesMatching("apps/*/src/controllers").mayNotImport(ORM).assert();
  });

  // In the registry app, the database is reached only through adapters + the composition
  // root (services.ts / index.ts). (apps/web is not yet hexagonal; add it once it is.)
  test("the database is reached only through adapters + the composition root", () => {
    rule()
      .filesMatching("apps/registry/src")
      .except("apps/registry/src/adapters", "apps/registry/src/services.ts", "apps/registry/src/index.ts")
      .mayNotImport(ORM)
      .assert();
  });
});
