import { modules, rule } from "@brika/archunit";
import { describe, test } from "bun:test";
import { ORM } from "./categories";

/** Architecture rules for the apps: the Dependency Rule (controllers never reach the DB). */

describe("apps", () => {
  test("do not import each other", () => {
    rule()
      .filesMatching("apps/*/src")
      .mayNotImport(modules("@brika/registry", "@brika/registry-cli", "@brika/store-web"))
      .assert();
  });
});

describe("apps/registry", () => {
  test("controllers never import the database/ORM (use a port on ctx)", () => {
    rule()
      .filesMatching("apps/*/src/controllers")
      .mayNotImport(ORM)
      .assert();
  });

  // Scoped to apps/registry (not apps/*) because apps/web is not yet hexagonal.
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

  test("the Cloudflare bindings are read only at the entry + env + cf adapters (handlers inject)", () => {
    rule()
      .filesMatching("apps/registry/src")
      .except(
        "apps/registry/src/index.ts",
        "apps/registry/src/env.ts",
        "apps/registry/src/adapters",
      )
      .mayNotImport(modules("cloudflare:workers"))
      .assert();
  });
});
