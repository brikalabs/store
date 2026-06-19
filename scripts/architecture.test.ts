import { archTest, modules, rule } from "@brika/archunit/test";

/**
 * The repo's architecture rules (ArchUnit-style): each `archTest` is a `bun test` case
 * that fails - naming the offending file + import - if a layer imports something it may
 * not. Globs resolve from the repo root (the cwd `bun test` runs in). Add a layer by
 * adding an `archTest`.
 */

// Import categories: named sets of module specifiers.
const PLATFORM = modules("cloudflare:", "@cloudflare/", "wrangler");
const ORM = modules("drizzle-orm", "@brika/store-db");
const HTTP = modules("hono", "@brika/router");

// Shared packages are Cloudflare-free - only apps wire the platform. (db is the driver
// package and may import the ORM; no package imports Cloudflare.)
archTest(
  "shared packages are Cloudflare-free (only apps use Cloudflare)",
  rule().filesMatching("packages/*/src").mayNotImport(PLATFORM),
);

// The domain core (any *-core package) speaks only ports.
archTest(
  "the domain core (*-core) depends on no database/ORM or HTTP framework",
  rule().filesMatching("packages/*-core/src").mayNotImport(ORM, HTTP),
);

// The router is a platform-free HTTP layer (Hono is allowed; the database is not).
archTest("the router is database-free", rule().filesMatching("packages/router/src").mayNotImport(ORM));

// Controllers go through ports on `ctx`, never the database, in any app.
archTest(
  "controllers never import the database/ORM (use a port on ctx)",
  rule().filesMatching("apps/*/src/controllers").mayNotImport(ORM),
);

// In the registry app, the database is reached only through adapters + the composition
// root (services.ts / index.ts). (apps/web is not yet hexagonal; add it once it is.)
archTest(
  "the database is reached only through adapters + the composition root",
  rule()
    .filesMatching("apps/registry/src")
    .except("apps/registry/src/adapters", "apps/registry/src/services.ts", "apps/registry/src/index.ts")
    .mayNotImport(ORM),
);
