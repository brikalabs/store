import { kebabFilename, modules, rule } from "@brika/archunit";
import { describe, test } from "bun:test";

/**
 * Layering rules for the store web app (apps/web), the same way the registry's are enforced.
 * The web is not fully hexagonal, but it now has a clear repository boundary: the social tables
 * are reached only through `server/stores/*` (a Spring-`@Repository`-style layer), composed by
 * `server/services/*`; routes and components see a service, never SQL.
 */

/** The social tables (the store's own drizzle schema) + the raw ORM. */
const SOCIAL_SCHEMA = modules("@/server/db/schema");
const RAW_ORM = modules("drizzle-orm");

describe("apps/web layering", () => {
  test("routes + components never touch the ORM or the social tables (they go through a service)", () => {
    rule()
      .filesMatching("apps/web/src/routes", "apps/web/src/components")
      .mayNotImport(RAW_ORM, SOCIAL_SCHEMA)
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
});

describe("apps/web stores", () => {
  test("are kebab-case files", () => {
    rule().filesMatching("apps/web/src/server/stores").mustBeNamed(kebabFilename()).assert();
  });

  test("repository classes are suffixed Store", () => {
    rule().filesMatching("apps/web/src/server/stores").classesMustBeSuffixed("Store").assert();
  });
});
