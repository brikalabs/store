import { env } from "cloudflare:workers";
import { inject, runInContext } from "@brika/di";
import { ScopeService } from "@brika/registry-core";
import { devError, jsonLogger, reply } from "@brika/router";
import { getDb } from "@brika/store-db";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { deviceController } from "./controllers/device";
import { manageController } from "./controllers/manage";
import { packagesController } from "./controllers/packages";
import { publishController } from "./controllers/publish";
import { scopeController } from "./controllers/scope";
import { searchController } from "./controllers/search";
import { statsController } from "./controllers/stats";
import { isDevelopment, registryAdmins, vars } from "./env";
import { logRoutes, mount, type RegistryEnv } from "./http/router";
import { provideRegistry } from "./services";

/** Run `fn` in the registry's per-request DI context, built from the request bindings (the one place `env` is read). */
function withRegistry<R>(bindings: Cloudflare.Env, baseUrl: string, fn: () => R): R {
  return runInContext(
    provideRegistry({
      db: getDb(bindings.DB),
      tarballs: bindings.TARBALLS,
      baseUrl,
      admins: registryAdmins(),
      domainSecret: vars().DOMAIN_VERIFY_SECRET,
    }),
    fn,
  );
}

/**
 * The Brika registry: an npm-compatible resolve surface so `bun add` installs `@brika/*` from us,
 * plus authenticated publish and device-flow endpoints. Domain logic lives in `@brika/registry-core`;
 * this worker is the HTTP + Cloudflare adapter layer.
 */

/** The origin tarball URLs are built from: pinned `REGISTRY_URL`, else the request origin (avoids trusting `Host`). */
function baseUrlFor(requestUrl: string): string {
  return vars().REGISTRY_URL || new URL(requestUrl).origin;
}

const app = new Hono<RegistryEnv>();

// Open CORS so any browser client can read the read-only npm protocol cross-origin, as npm does.
app.use("/*", cors({ origin: "*", allowMethods: ["GET", "HEAD", "OPTIONS"] }));

app.get("/", (c) => c.json({ name: "Brika registry", protocol: "npm" }));

const controllers = [
  searchController,
  statsController,
  publishController,
  deviceController,
  manageController,
  scopeController,
  packagesController,
];

// The `PKG` pattern is regex-constrained so package routes never shadow the `/-/...` endpoints.
mount(app, controllers, {
  around: (c, run) => withRegistry(c.env, baseUrlFor(c.req.url), run),
  logger: jsonLogger("registry request"),
});

// A non-`HttpError` that reaches here is a real bug (the router serializes HttpErrors itself and
// re-throws the rest; the request logger already recorded it). In local dev, surface the message +
// stack to make it debuggable from the response; in production, a generic 500 (no internals leak).
app.onError((error) =>
  isDevelopment() ? devError(error) : reply({ error: "Internal Server Error" }, 500),
);

// Log the full route table once on cold start, so the deployed worker's logs show what it serves.
logRoutes(app);

/**
 * Cron re-verification of scope domains (ORG-010-AC3): re-check every verified domain's TXT and
 * revoke any that no longer resolve. A transient DNS failure is skipped, never revoked.
 */
async function scheduled(): Promise<void> {
  const revoked = await withRegistry(env, vars().REGISTRY_URL, () =>
    inject(ScopeService).reverifyDomains(),
  );
  if (revoked.length > 0) {
    console.log(JSON.stringify({ msg: "scope domain re-verification revoked badges", revoked }));
  }
}

export default { fetch: app.fetch, scheduled };
