import { env } from "cloudflare:workers";
import { ResolveService } from "@brika/registry-core";
import { getDb } from "@brika/store-db";
import { type Context, Hono } from "hono";
import { cors } from "hono/cors";
import { D1DownloadStore } from "./adapters/d1-downloads";
import { D1MetadataReader } from "./adapters/d1-metadata";
import { R2TarballReader } from "./adapters/r2-tarball";
import { revokeToken } from "./adapters/token";
import { handleCatalog } from "./catalog";
import { handleDeviceCode, handleDeviceToken } from "./device";
import { vars } from "./env";
import { handleDeprecate, handleYank } from "./manage";
import { decodeSegment, parseTarballVersion } from "./npm-url";
import { handlePublish } from "./publish";
import { handleDownloads } from "./stats";

/**
 * The Brika registry: an npm-compatible resolve surface so `bun add` installs
 * `@brika/*` from us, plus authenticated publish and device-flow endpoints.
 * Routing with Hono; all domain logic lives in `@brika/registry-core` and this
 * worker is the thin HTTP + Cloudflare adapter layer.
 */

/**
 * The public origin tarball URLs are built from: the pinned `REGISTRY_URL` when
 * configured, otherwise the request origin (correct once a single custom domain
 * is attached). Pinning avoids trusting a client-supplied `Host` header.
 */
function baseUrlFor(requestUrl: string): string {
  return vars().REGISTRY_URL || new URL(requestUrl).origin;
}

function resolver(baseUrl: string): ResolveService {
  return new ResolveService(
    new D1MetadataReader(getDb(env.DB)),
    new R2TarballReader(env.TARBALLS),
    {
      baseUrl,
    },
  );
}

const ABBREVIATED_ACCEPT = "application/vnd.npm.install-v1+json";

async function packument(c: Context, name: string): Promise<Response> {
  // bun/npm request the abbreviated install metadata via Accept; it is much
  // smaller (no readme/scripts) for packages with many versions.
  const abbreviated = (c.req.header("accept") ?? "").includes(ABBREVIATED_ACCEPT);
  const doc = await resolver(baseUrlFor(c.req.url)).packument(name, { abbreviated });
  if (doc === null) return c.json({ error: "Not found" }, 404);
  return c.body(JSON.stringify(doc), 200, {
    "content-type": abbreviated ? ABBREVIATED_ACCEPT : "application/json",
    "cache-control": "public, max-age=60",
    // The response varies by Accept, so caches must key on it.
    vary: "accept",
  });
}

async function tarball(c: Context, name: string, file: string): Promise<Response> {
  const version = parseTarballVersion(name, file);
  if (version === null) return c.json({ error: "Not found" }, 404);
  const stream = await resolver(baseUrlFor(c.req.url)).tarball(name, version);
  if (stream === null) return c.json({ error: "Not found" }, 404);

  // A served tarball is an install signal: count it off the response path so the
  // download never waits on (or fails from) the counter. Edge-cached repeat
  // installs skip the Worker, so counts are a lower bound, like npm's own.
  c.executionCtx.waitUntil(new D1DownloadStore(getDb(env.DB)).record(name).catch(() => {}));

  return c.body(stream, 200, {
    "content-type": "application/octet-stream",
    // Tarballs are immutable, so they can be cached forever.
    "cache-control": "public, max-age=31536000, immutable",
  });
}

const app = new Hono();

// Public, read-only npm protocol: open CORS so the storefront (and any browser
// client) can read packuments, tarballs, and the catalog cross-origin, exactly
// as the public npm registry does.
app.use("/*", cors({ origin: "*", allowMethods: ["GET", "HEAD", "OPTIONS"] }));

app.get("/", (c) => c.json({ name: "Brika registry", protocol: "npm" }));

// Catalog of published packages so the store can enumerate `@brika/*` plugins.
app.get("/-/v1/packages", (c) => handleCatalog(c.req.raw));

// Install stats (all-time + trailing week), scoped and unscoped.
app.get("/-/v1/downloads/:scope/:pkg", (c) =>
  handleDownloads(`${decodeSegment(c.req.param("scope"))}/${c.req.param("pkg")}`),
);
app.get("/-/v1/downloads/:pkg", (c) => handleDownloads(decodeSegment(c.req.param("pkg"))));

// Authenticated publish + device authorization (RFC 8628).
app.post("/-/publish", (c) => handlePublish(c.req.raw));
app.post("/-/device/code", () => handleDeviceCode());
app.post("/-/device/token", (c) => handleDeviceToken(c.req.raw));

// Authenticated post-publish management (deprecate / yank), scoped + unscoped.
app.post("/-/package/:scope/:pkg/:version/deprecate", (c) =>
  handleDeprecate(
    c.req.raw,
    `${decodeSegment(c.req.param("scope"))}/${c.req.param("pkg")}`,
    c.req.param("version"),
  ),
);
app.post("/-/package/:pkg/:version/deprecate", (c) =>
  handleDeprecate(c.req.raw, decodeSegment(c.req.param("pkg")), c.req.param("version")),
);
app.post("/-/package/:scope/:pkg/:version/yank", (c) =>
  handleYank(
    c.req.raw,
    `${decodeSegment(c.req.param("scope"))}/${c.req.param("pkg")}`,
    c.req.param("version"),
  ),
);
app.post("/-/package/:pkg/:version/yank", (c) =>
  handleYank(c.req.raw, decodeSegment(c.req.param("pkg")), c.req.param("version")),
);

// Revoke the presented publish token (used by `brika logout`). Idempotent.
app.post("/-/token/revoke", async (c) => {
  const authorization = c.req.header("authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) return c.json({ error: "Unauthorized" }, 401);
  await revokeToken(getDb(env.DB), authorization.slice("Bearer ".length));
  return c.json({ ok: true });
});

// Tarballs: `/-/` separates the package name from the filename.
app.get("/:scope/:pkg/-/:file", (c) =>
  tarball(c, `${decodeSegment(c.req.param("scope"))}/${c.req.param("pkg")}`, c.req.param("file")),
);
app.get("/:pkg/-/:file", (c) => tarball(c, decodeSegment(c.req.param("pkg")), c.req.param("file")));

// Packuments: scoped `/@scope/name` and the encoded `/@scope%2fname` form.
app.get("/:scope/:pkg", (c) =>
  packument(c, `${decodeSegment(c.req.param("scope"))}/${c.req.param("pkg")}`),
);
app.get("/:pkg", (c) => packument(c, decodeSegment(c.req.param("pkg"))));

export default app;
