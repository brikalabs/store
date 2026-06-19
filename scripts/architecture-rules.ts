/**
 * The repo's architecture rules, declared once (ArchUnit-style) and shared by both
 * runners: `check-architecture.ts` (the lint CLI) and `architecture.test.ts` (bun test).
 * This module is side-effect-free - importing it only builds the rule set, it does not
 * run or exit - so it is safe to import from a test.
 */
import { ArchRules, category } from "./archunit";

const ROOT = `${import.meta.dir}/..`;

// Import categories: named classes of module specifier.
const PLATFORM = category(
  "a Cloudflare/platform module",
  (s) => s.startsWith("cloudflare:") || s.startsWith("@cloudflare/") || s === "wrangler",
);
const ORM = category(
  "the database/ORM",
  (s) => s === "drizzle-orm" || s.startsWith("drizzle-orm/") || s === "@brika/store-db",
);
const HTTP = category(
  "an HTTP framework/router",
  (s) => s === "hono" || s.startsWith("hono/") || s === "@brika/router" || s.startsWith("@brika/router/"),
);

/** The configured rule set. Add a package/app/layer by writing another `.rule(...)`. */
export const architecture = new ArchRules(ROOT);

// Shared packages are Cloudflare-free - only apps wire the platform. (db is the driver
// package and may import the ORM; no package imports Cloudflare.)
architecture
  .rule("shared packages are Cloudflare-free (only apps use Cloudflare)")
  .filesMatching("packages/*/src/**/*.ts", "packages/*/src/**/*.tsx")
  .mayNotImport(PLATFORM);

// The domain core (any *-core package) speaks only ports: no database, no HTTP framework.
architecture
  .rule("the domain core (*-core) depends on no database/ORM or HTTP framework")
  .filesMatching("packages/*-core/src/**/*.ts")
  .mayNotImport(ORM, HTTP);

// The router is a platform-free HTTP layer (Hono is allowed; the database is not).
architecture
  .rule("the router is database-free")
  .filesMatching("packages/router/src/**/*.ts")
  .mayNotImport(ORM);

// Controllers go through ports on `ctx`, never the database, in any app.
architecture
  .rule("controllers never import the database/ORM (use a port on ctx)")
  .filesMatching("apps/*/src/controllers/**/*.ts")
  .mayNotImport(ORM);

// In the registry app, the database is reached only through adapters + the composition
// root (services.ts / index.ts). (apps/web is not yet hexagonal; add it here once it is.)
architecture
  .rule("the database is reached only through adapters + the composition root")
  .filesMatching("apps/registry/src/**/*.ts")
  .except("apps/registry/src/adapters/**", "apps/registry/src/services.ts", "apps/registry/src/index.ts")
  .mayNotImport(ORM);
