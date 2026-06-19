import { jsonLogger } from "@brika/router";
import { getDb } from "@brika/store-db";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { catalogController } from "./controllers/catalog";
import { deviceController } from "./controllers/device";
import { manageController } from "./controllers/manage";
import { packagesController } from "./controllers/packages";
import { publishController } from "./controllers/publish";
import { scopeController } from "./controllers/scope";
import { statsController } from "./controllers/stats";
import { registryAdmins, vars } from "./env";
import { logRoutes, mount, type RegistryEnv } from "./http/router";
import { buildServices } from "./services";

/**
 * The Brika registry: an npm-compatible resolve surface so `bun add` installs
 * `@brika/*` from us, plus authenticated publish and device-flow endpoints.
 *
 * Routing is `@brika/router`, a thin typed superset over Hono: handlers live in
 * feature controllers, each declaring its routes next to its handlers and
 * receiving typed params + a validated body. All domain logic lives in
 * `@brika/registry-core`; this worker is the HTTP + Cloudflare adapter layer. The
 * Cloudflare bindings are read in exactly one place (the `context` factory below),
 * so every handler receives a typed `Services` graph rather than the ambient env.
 */

/**
 * The public origin tarball URLs are built from: the pinned `REGISTRY_URL` when
 * configured, otherwise the request origin (correct once a single custom domain
 * is attached). Pinning avoids trusting a client-supplied `Host` header.
 */
function baseUrlFor(requestUrl: string): string {
  return vars().REGISTRY_URL || new URL(requestUrl).origin;
}

const app = new Hono<RegistryEnv>();

// Public, read-only npm protocol: open CORS so the storefront (and any browser
// client) can read packuments, tarballs, and the catalog cross-origin, exactly
// as the public npm registry does.
app.use("/*", cors({ origin: "*", allowMethods: ["GET", "HEAD", "OPTIONS"] }));

app.get("/", (c) => c.json({ name: "Brika registry", protocol: "npm" }));

const controllers = [
  catalogController,
  statsController,
  publishController,
  deviceController,
  manageController,
  scopeController,
  packagesController,
];

// Mount the feature controllers. The composition root (the only place bindings are
// read) is the `context` factory, run per request. Package routes use the npm
// `PKG` pattern (an optional `@scope` segment, regex-constrained so it never
// shadows the `/-/...` endpoints); registration order is not load-bearing. Each
// request is logged as a structured JSON line (method, route, status, timing,
// controller/handler, client IP).
mount(app, controllers, {
  context: (c) =>
    buildServices(getDb(c.env.DB), c.env.TARBALLS, baseUrlFor(c.req.url), registryAdmins()),
  logger: jsonLogger("registry request"),
});

// Log the full route table once on cold start (read back from Hono, so it includes
// `GET /` and every concrete pattern), so the deployed worker's logs show exactly
// what it serves.
logRoutes(app);

export default app;
