import { inject } from "@brika/di";
import { ResolveService } from "@brika/registry-core";
import { notFound } from "@brika/router";
import { type PackageParams, PKG, packageName } from "@brika/router/npm";
import { controller, route } from "../http/router";
import { parseTarballVersion } from "../npm-url";
import { Downloads } from "../services";

/** The npm read protocol: packuments and tarballs, the cacheable reads (own cache headers, not no-store). */

const ABBREVIATED_ACCEPT = "application/vnd.npm.install-v1+json";

/**
 * `GET /:name`. bun/npm request smaller abbreviated install metadata via `Accept`; the response
 * varies by `Accept`, so caches must key on it (`Vary`).
 */
async function packument({
  params,
  req,
}: {
  readonly params: PackageParams;
  readonly req: Request;
}): Promise<Response> {
  const abbreviated = (req.headers.get("accept") ?? "").includes(ABBREVIATED_ACCEPT);
  const doc = await inject(ResolveService).packument(packageName(params), { abbreviated });
  if (doc === null) throw notFound();
  return new Response(JSON.stringify(doc), {
    status: 200,
    headers: {
      "content-type": abbreviated ? ABBREVIATED_ACCEPT : "application/json",
      "cache-control": "public, max-age=60",
      vary: "accept",
    },
  });
}

/**
 * `GET /:name/-/:file`. The install count is recorded off the response path via `waitUntil`, so the
 * download never waits on (or fails from) the counter. Edge-cached repeats skip the Worker, so counts
 * are a lower bound. Tarballs are immutable, so cached forever.
 */
async function tarball({
  params,
  waitUntil,
}: {
  readonly params: PackageParams & { readonly file: string };
  readonly waitUntil: (promise: Promise<unknown>) => void;
}): Promise<Response> {
  const name = packageName(params);
  const version = parseTarballVersion(name, params.file);
  if (version === null) throw notFound();
  const stream = await inject(ResolveService).tarball(name, version);
  if (stream === null) throw notFound();

  waitUntil(
    inject(Downloads)
      .record(name)
      .catch(() => {}),
  );

  return new Response(stream, {
    status: 200,
    headers: {
      "content-type": "application/octet-stream",
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
}

// Tarball before packument: the `/-/:file` pattern is more specific and must win.
export const packagesController = controller({
  name: "packages",
  routes: [
    route.get({ path: `/${PKG}/-/:file`, handler: tarball }),
    route.get({ path: `/${PKG}`, handler: packument }),
  ],
});
