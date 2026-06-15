import { env } from "cloudflare:workers";
import { ResolveService } from "@brika/registry-core";
import { getDb } from "@brika/store-db";
import { type Context, Hono } from "hono";
import { D1MetadataReader } from "./adapters/d1-metadata";
import { R2TarballReader } from "./adapters/r2-tarball";
import { handleDeviceCode, handleDeviceToken } from "./device";
import { decodeSegment, parseTarballVersion } from "./npm-url";
import { handlePublish } from "./publish";

/**
 * The Brika registry: an npm-compatible resolve surface so `bun add` installs
 * `@brika/*` from us, plus authenticated publish and device-flow endpoints.
 * Routing with Hono; all domain logic lives in `@brika/registry-core` and this
 * worker is the thin HTTP + Cloudflare adapter layer.
 */

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
  const doc = await resolver(new URL(c.req.url).origin).packument(name, { abbreviated });
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
  const stream = await resolver(new URL(c.req.url).origin).tarball(name, version);
  if (stream === null) return c.json({ error: "Not found" }, 404);
  return c.body(stream, 200, {
    "content-type": "application/octet-stream",
    // Tarballs are immutable, so they can be cached forever.
    "cache-control": "public, max-age=31536000, immutable",
  });
}

const app = new Hono();

app.get("/", (c) => c.json({ name: "Brika registry", protocol: "npm" }));

// Authenticated publish + device authorization (RFC 8628).
app.post("/-/publish", (c) => handlePublish(c.req.raw));
app.post("/-/device/code", () => handleDeviceCode());
app.post("/-/device/token", (c) => handleDeviceToken(c.req.raw));

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
