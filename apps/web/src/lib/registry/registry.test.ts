import { afterEach, describe, expect, test } from "bun:test";
import { gzipSync } from "node:zlib";
import {
  getPluginPage,
  getPluginVersions,
  getScopePage,
  searchPlugins,
} from "@/lib/registry/registry";

/**
 * Orchestration tests for the store's read model: every listed plugin is hosted on
 * the Brika registry and resolved through its npm-compatible HTTP surface - npm is
 * never a listing source. `fetch` is stubbed per URL so no network is touched; the
 * registry tarball is a real gzipped USTAR archive so the readme/locale extraction
 * path runs for real.
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
  provenance: { repository: "brikalabs/store", sha: "abc1234", runId: "99" },
  dependencies: { "@brika/sdk": "^0.1.0", zod: "^3.23.0" },
  devDependencies: { typescript: "^6.0.3", "@types/bun": "^1.3.5" },
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
      publisher: { id: "brika", name: "Brika Labs", verified: true },
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

/** Route a stubbed fetch by URL to the registry catalog, packument, or tarball. */
function stubAll() {
  globalThis.fetch = ((input: string | URL | Request) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.includes("/-/v1/packages") || url.includes("/-/v1/search"))
      return Promise.resolve(json(catalog));
    if (url.includes("/-/v1/downloads")) {
      return Promise.resolve(
        json({ name: "@brika/plugin-i18n", total: 1234, weekly: 42, series: [1, 0, 3, 5] }),
      );
    }
    if (url.endsWith(".tgz")) {
      return Promise.resolve(new Response(tarball, { status: 200 }));
    }
    if (url.includes("/-/scope/%40brika")) {
      return Promise.resolve(
        json({ ok: true, scope: "@brika", displayName: "Brika Labs", verified: true }),
      );
    }
    if (url.includes("registry.brika.dev")) return Promise.resolve(json(registryPackument));
    return Promise.resolve(json({ error: "not found" }, 404));
  }) as typeof fetch;
}

describe("searchPlugins", () => {
  test("lists registry plugins with real install counts", async () => {
    stubAll();
    const { plugins, total } = await searchPlugins(undefined, 12, 0);
    const i18n = plugins.find((p) => p.name === "@brika/plugin-i18n");
    expect(i18n).toBeDefined();
    expect(i18n?.installs).toBe(5000);
    expect(total).toBeGreaterThanOrEqual(1);
  });
});

describe("getScopePage", () => {
  test("lists a scope's plugins with the verified publisher for the header", async () => {
    stubAll();
    const page = await getScopePage("@brika");
    expect(page).not.toBeNull();
    expect(page?.scope).toBe("@brika");
    expect(page?.displayName).toBe("Brika Labs");
    expect(page?.verified).toBe(true);
    expect(page?.plugins.map((p) => p.name)).toContain("@brika/plugin-i18n");
  });

  test("returns null for a scope with no listed plugin", async () => {
    stubAll();
    expect(await getScopePage("@nobody")).toBeNull();
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
    // CI provenance from the packument version entry.
    expect(page?.detail.provenance).toEqual({
      repository: "brikalabs/store",
      sha: "abc1234",
      runId: "99",
    });
    // Dependencies + dev-dependency count come from the manifest.
    expect(page?.detail.dependencies).toEqual({ "@brika/sdk": "^0.1.0", zod: "^3.23.0" });
    expect(page?.detail.devDependencyCount).toBe(2);
  });

  test("returns null for an unknown registry plugin", async () => {
    globalThis.fetch = (() => Promise.resolve(json({ error: "x" }, 404))) as typeof fetch;
    expect(await getPluginPage("@brika/missing")).toBeNull();
  });

  test("returns null for a non-@brika name (npm packages are not listed)", async () => {
    stubAll();
    expect(await getPluginPage("lodash")).toBeNull();
  });
});

describe("getPluginVersions", () => {
  test("returns the registry release list for an @brika plugin", async () => {
    stubAll();
    const versions = await getPluginVersions("@brika/plugin-i18n");
    expect(versions?.[0]?.version).toBe("0.1.0");
  });

  test("returns null for a non-@brika name", async () => {
    stubAll();
    expect(await getPluginVersions("totally-unknown")).toBeNull();
  });
});
