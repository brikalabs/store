import { afterEach, describe, expect, test } from "bun:test";
import { gzipSync } from "node:zlib";
import { getDeveloperPage, getPluginPage, getPluginVersions, searchPlugins } from "./registry";

/**
 * Orchestration tests for the store's read model: it merges `@brika/*` plugins
 * (our registry) with npm results and prefers the registry for detail/versions.
 * `fetch` is stubbed per URL so no network is touched; the registry tarball is a
 * real gzipped USTAR archive so the readme/locale extraction path runs for real.
 */

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

const BLOCK = 512;

/** Build a minimal gzipped USTAR archive (the shape `readTarGzEntries` reads). */
function makeTarGz(entries: { path: string; text: string }[]): Uint8Array {
  const enc = new TextEncoder();
  const blocks: Uint8Array[] = [];
  for (const entry of entries) {
    const data = enc.encode(entry.text);
    const header = new Uint8Array(BLOCK);
    header.set(enc.encode(`package/${entry.path}`), 0); // name
    header.set(enc.encode(`${data.byteLength.toString(8).padStart(11, "0")}\0`), 124); // size (octal)
    header[156] = 0x30; // typeflag '0' (regular file)
    header.set(enc.encode("ustar\0"), 257);
    blocks.push(header, data);
    const pad = (BLOCK - (data.byteLength % BLOCK)) % BLOCK;
    if (pad > 0) blocks.push(new Uint8Array(pad));
  }
  blocks.push(new Uint8Array(BLOCK * 2)); // terminator
  const total = blocks.reduce((sum, b) => sum + b.byteLength, 0);
  const tar = new Uint8Array(total);
  let offset = 0;
  for (const b of blocks) {
    tar.set(b, offset);
    offset += b.byteLength;
  }
  return new Uint8Array(gzipSync(tar));
}

const registryManifest = {
  name: "@brika/plugin-i18n",
  version: "0.1.0",
  displayName: "i18n Toolkit",
  description: "Localize",
  engines: { brika: "^0.1.0" },
  icon: "./assets/icon.svg",
  readme: { en: "./README.md", fr: "./README.fr.md" },
  // The registry packument carries the computed integrity on the version's dist.
  dist: { integrity: "sha512-TESTINTEGRITY==", shasum: "deadbeef" },
};

const registryPackument = {
  name: "@brika/plugin-i18n",
  "dist-tags": { latest: "0.1.0" },
  versions: { "0.1.0": registryManifest },
  time: { created: "2026-06-16T00:00:00.000Z", "0.1.0": "2026-06-16T00:00:00.000Z" },
};

const catalog = {
  packages: [
    {
      name: "@brika/plugin-i18n",
      version: "0.1.0",
      manifest: registryManifest,
      publishedAt: "2026-06-16T00:00:00.000Z",
      createdAt: "2026-06-16T00:00:00.000Z",
      downloads: { total: 5000, weekly: 120 },
    },
  ],
  total: 1,
};

const tarball = makeTarGz([
  { path: "README.md", text: "# i18n Toolkit\nEnglish readme" },
  { path: "README.fr.md", text: "# Boite i18n\nFrench readme" },
  {
    path: "locales/fr/store.json",
    text: JSON.stringify({ title: "Boite i18n", description: "Localisez tout" }),
  },
]);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/** Route a stubbed fetch by URL to the registry, tarball, or npm responses. */
function stubAll() {
  globalThis.fetch = ((input: string | URL | Request) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.includes("/-/v1/packages")) return Promise.resolve(json(catalog));
    if (url.includes("/-/v1/downloads")) {
      return Promise.resolve(
        json({ name: "@brika/plugin-i18n", total: 1234, weekly: 42, series: [1, 0, 3, 5] }),
      );
    }
    if (url.endsWith(".tgz")) {
      return Promise.resolve(new Response(tarball, { status: 200 }));
    }
    if (url.includes("registry.brika.dev")) return Promise.resolve(json(registryPackument));
    if (url.includes("/-/v1/search")) return Promise.resolve(json({ objects: [], total: 0 }));
    if (url.includes("api.npmjs.org")) return Promise.resolve(json({ downloads: 0 }));
    return Promise.resolve(json({ error: "not found" }, 404));
  }) as typeof fetch;
}

describe("searchPlugins", () => {
  test("includes registry plugins with real install counts on the first page", async () => {
    stubAll();
    const { plugins, total } = await searchPlugins(undefined, 12, 0);
    const i18n = plugins.find((p) => p.name === "@brika/plugin-i18n");
    expect(i18n).toBeDefined();
    expect(i18n?.installs).toBe(5000);
    expect(total).toBeGreaterThanOrEqual(1);
  });

  test("skips the registry for qualifier searches (maintainer:)", async () => {
    let catalogHit = false;
    globalThis.fetch = ((input: string | URL | Request) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/-/v1/packages")) catalogHit = true;
      if (url.includes("/-/v1/search")) return Promise.resolve(json({ objects: [], total: 0 }));
      return Promise.resolve(json({ error: "x" }, 404));
    }) as typeof fetch;
    await searchPlugins("maintainer:octo", 12, 0);
    expect(catalogHit).toBe(false);
  });
});

describe("getPluginPage", () => {
  test("renders an @brika plugin from the registry with localized copy", async () => {
    stubAll();
    const page = await getPluginPage("@brika/plugin-i18n", "fr");
    expect(page).not.toBeNull();
    expect(page?.detail.name).toBe("@brika/plugin-i18n");
    // Localized store.json overrides the title/description for the fr locale.
    expect(page?.detail.displayName).toBe("Boite i18n");
    expect(page?.readme).toContain("French readme");
    expect(page?.readmeLocales).toEqual(["en", "fr"]);
    // Install stats are read from the registry's downloads endpoint.
    expect(page?.detail.installs).toBe(1234);
    // The tarball SHA-512 integrity is surfaced from the packument's dist.
    expect(page?.detail.integrity).toBe("sha512-TESTINTEGRITY==");
    // The per-day install series feeds the sidebar sparkline.
    expect(page?.downloadsSeries).toEqual([1, 0, 3, 5]);
  });

  test("falls through to a 404 for an unknown registry plugin", async () => {
    globalThis.fetch = (() => Promise.resolve(json({ error: "x" }, 404))) as typeof fetch;
    expect(await getPluginPage("@brika/missing")).toBeNull();
  });
});

describe("getPluginVersions", () => {
  test("returns the registry release list for an @brika plugin", async () => {
    stubAll();
    const versions = await getPluginVersions("@brika/plugin-i18n");
    expect(versions?.[0]?.version).toBe("0.1.0");
  });

  test("returns null for an unknown package", async () => {
    globalThis.fetch = (() => Promise.resolve(json({ error: "x" }, 404))) as typeof fetch;
    expect(await getPluginVersions("totally-unknown")).toBeNull();
  });
});

const npmPackument = {
  name: "brika-plugin-community",
  "dist-tags": { latest: "2.0.0" },
  versions: {
    "2.0.0": {
      version: "2.0.0",
      displayName: "Community",
      engines: { brika: "^0.1.0" },
      readme: "./README.md",
    },
  },
  time: { created: "2026-01-01T00:00:00.000Z", "2.0.0": "2026-02-01T00:00:00.000Z" },
};

/** Stub for a non-`@brika` (npm-hosted) plugin: packument, downloads, jsDelivr readme. */
function stubNpm() {
  globalThis.fetch = ((input: string | URL | Request) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.includes("api.npmjs.org")) return Promise.resolve(json({ downloads: 7 }));
    if (url.includes("cdn.jsdelivr.net"))
      return Promise.resolve(new Response("# Community readme"));
    if (url.includes("registry.npmjs.org")) return Promise.resolve(json(npmPackument));
    return Promise.resolve(json({ error: "x" }, 404));
  }) as typeof fetch;
}

describe("npm fallback", () => {
  test("getPluginPage resolves a non-@brika plugin from npm + jsDelivr", async () => {
    stubNpm();
    const page = await getPluginPage("brika-plugin-community");
    expect(page?.detail.name).toBe("brika-plugin-community");
    expect(page?.detail.downloadsWeekly).toBe(7);
    expect(page?.readme).toContain("Community readme");
  });

  test("getPluginVersions resolves a non-@brika plugin from npm", async () => {
    stubNpm();
    expect((await getPluginVersions("brika-plugin-community"))?.[0]?.version).toBe("2.0.0");
  });
});

describe("getDeveloperPage", () => {
  test("builds a profile from the maintainer's plugins", async () => {
    globalThis.fetch = ((input: string | URL | Request) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/-/v1/search")) {
        return Promise.resolve(
          json({
            objects: [{ package: { name: "brika-plugin-community", version: "2.0.0" } }],
            total: 1,
          }),
        );
      }
      if (url.includes("registry.npmjs.org")) return Promise.resolve(json(npmPackument));
      return Promise.resolve(json({ error: "x" }, 404));
    }) as typeof fetch;
    const { profile } = await getDeveloperPage("octo");
    expect(profile.id).toBe("octo");
    expect(profile.pluginCount).toBeGreaterThanOrEqual(0);
  });
});
