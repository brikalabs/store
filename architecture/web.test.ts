import { kebabFilename, modules, rule } from "@brika/archunit";
import { describe, test } from "bun:test";

/**
 * Layering rules for the store web app (apps/web), the same way the registry's are enforced.
 * The web is not fully hexagonal, but it now has a clear repository boundary: the social tables
 * are reached only through `server/stores/*` (a Spring-`@Repository`-style layer), composed by
 * `server/services/*`; routes and components see a service, never SQL.
 */

/** The social tables (the store's own drizzle schema) + the raw ORM + the shared D1 adapters. */
const SOCIAL_SCHEMA = modules("@/server/db/schema");
const RAW_ORM = modules("drizzle-orm");
const D1_ADAPTERS = modules("@brika/store-db/adapters");
/** The server's composition layer (repositories + services). `lib/` read models stay off it. */
const SERVER_COMPOSITION = modules(
  "@/server/stores",
  "@/server/services",
  "@/server/registry-services",
);

describe("apps/web layering", () => {
  test("routes + components never touch the ORM or the social tables (they go through a service)", () => {
    rule()
      .filesMatching("apps/web/src/routes", "apps/web/src/components")
      .mayNotImport(RAW_ORM, SOCIAL_SCHEMA)
      .assert();
  });

  test("the shared lib layer is pure read-models/utils (no server stores/services, no inject())", () => {
    rule()
      .filesMatching("apps/web/src/lib")
      .mayNotImport(SERVER_COMPOSITION)
      .assert();
  });

  test("only the stores read/write the social tables (plus the BetterAuth adapter + db client)", () => {
    rule()
      .filesMatching("apps/web/src/server")
      .except(
        "apps/web/src/server/stores",
        "apps/web/src/server/db",
        "apps/web/src/server/auth.ts",
      )
      .mayNotImport(SOCIAL_SCHEMA)
      .assert();
  });

  test("the raw ORM is confined to the stores + the db client (not the wider app)", () => {
    rule()
      .filesMatching("apps/web/src")
      .except("apps/web/src/server/stores", "apps/web/src/server/db")
      .mayNotImport(RAW_ORM)
      .assert();
  });

  test("the shared D1 adapters reach the app only through the stores + the composition root", () => {
    rule()
      .filesMatching("apps/web/src")
      .except(
        "apps/web/src/server/stores",
        "apps/web/src/server/registry-services.ts",
      )
      .mayNotImport(D1_ADAPTERS)
      .assert();
  });

  // The web's analog of the registry's binding-confinement rule (apps.test.ts): bindings enter at
  // the composition root, the env schema, and the cf seams; every other server file injects.
  test("the Cloudflare bindings are read only at the composition root + env + cf seams", () => {
    rule()
      .filesMatching("apps/web/src/server")
      .except(
        "apps/web/src/server/injector.ts",
        "apps/web/src/server/env.ts",
        "apps/web/src/server/adapters",
        "apps/web/src/server/rate-limit.ts",
      )
      .mayNotImport(modules("cloudflare:workers"))
      .assert();
  });
});

describe("apps/web stores", () => {
  test("are kebab-case files", () => {
    rule().filesMatching("apps/web/src/server/stores").mustBeNamed(kebabFilename()).assert();
  });

  test("repository classes are suffixed Store", () => {
    rule().filesMatching("apps/web/src/server/stores").classesMustBeSuffixed("Store").assert();
  });

  // Composition points one way: a service composes stores, a store never reaches back up to a service.
  test("stores do not import services", () => {
    rule()
      .filesMatching("apps/web/src/server/stores")
      .mayNotImport(modules("@/server/services"))
      .assert();
  });
});
