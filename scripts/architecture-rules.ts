/**
 * The repo's architecture rules, declared once with `@brika/archunit` and shared by both
 * runners: `check-architecture.ts` (the lint CLI) and `architecture.test.ts` (bun test).
 * Side-effect-free - importing only builds the rule set - so it is safe from a test.
 */
import { archRules, modules } from "@brika/archunit";

const ROOT = `${import.meta.dir}/..`;

// Import categories: named sets of module specifiers.
const PLATFORM = modules("cloudflare:", "@cloudflare/", "wrangler");
const ORM = modules("drizzle-orm", "@brika/store-db");
const HTTP = modules("hono", "@brika/router");

/** The configured rule set. Add a package/app/layer by chaining another `.rule(...)`. */
export const architecture = archRules({ root: ROOT })
  // Shared packages are Cloudflare-free - only apps wire the platform. (db is the driver
  // package and may import the ORM; no package imports Cloudflare.)
  .rule("shared packages are Cloudflare-free (only apps use Cloudflare)")
  .filesMatching("packages/*/src/**/*.ts", "packages/*/src/**/*.tsx")
  .mayNotImport(PLATFORM)
  // The domain core (any *-core package) speaks only ports: no database, no HTTP framework.
  .rule("the domain core (*-core) depends on no database/ORM or HTTP framework")
  .filesMatching("packages/*-core/src/**/*.ts")
  .mayNotImport(ORM, HTTP)
  // The router is a platform-free HTTP layer (Hono is allowed; the database is not).
  .rule("the router is database-free")
  .filesMatching("packages/router/src/**/*.ts")
  .mayNotImport(ORM)
  // Controllers go through ports on `ctx`, never the database, in any app.
  .rule("controllers never import the database/ORM (use a port on ctx)")
  .filesMatching("apps/*/src/controllers/**/*.ts")
  .mayNotImport(ORM)
  // In the registry app, the database is reached only through adapters + the composition
  // root (services.ts / index.ts). (apps/web is not yet hexagonal; add it here once it is.)
  .rule("the database is reached only through adapters + the composition root")
  .filesMatching("apps/registry/src/**/*.ts")
  .except("apps/registry/src/adapters/**", "apps/registry/src/services.ts", "apps/registry/src/index.ts")
  .mayNotImport(ORM);
