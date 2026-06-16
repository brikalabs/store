import { describe, expect, test } from "bun:test";
import {
  assetUrl,
  compareVersionsDesc,
  contentTypeFor,
  docLocales,
  isRegistryName,
  isSafeAssetPath,
  type Manifest,
  manifestToDetail,
  manifestToSummary,
  pickDocPath,
  versionsFromPackument,
} from "./registry-source";

const i18nManifest: Manifest = {
  name: "@brika/plugin-i18n",
  version: "0.1.0",
  displayName: "i18n Toolkit",
  description: "Translate and localize content",
  license: "MIT",
  engines: { brika: "^0.1.0" },
  icon: "./assets/icon.svg",
  keywords: ["i18n", "localization"],
  repository: { url: "git+https://github.com/brikalabs/store.git" },
  author: "Brika Labs <hi@brika.dev>",
  readme: { en: "./README.md", fr: "./README.fr.md" },
  screenshots: [{ src: "./assets/a.svg", caption: "One", alt: "first" }, "./assets/b.svg"],
  tools: [{ id: "translate" }, { id: "detect" }],
  blocks: [{ id: "localize" }],
};

describe("isRegistryName", () => {
  test("matches the @brika scope only", () => {
    expect(isRegistryName("@brika/plugin-i18n")).toBe(true);
    expect(isRegistryName("@other/plugin")).toBe(false);
    expect(isRegistryName("plugin-i18n")).toBe(false);
  });
});

describe("assetUrl", () => {
  test("builds a path-based, version-pinned URL (npm/unpkg style)", () => {
    const url = assetUrl("@brika/plugin-i18n", "0.1.0", "./assets/icon.svg");
    expect(url).toBe("/v1/plugins/%40brika%2Fplugin-i18n/v/0.1.0/files/assets/icon.svg");
  });

  test("strips a leading ./ or / and keeps the path segments", () => {
    expect(assetUrl("@brika/x", "1.0.0", "/a/b.png")).toBe(
      "/v1/plugins/%40brika%2Fx/v/1.0.0/files/a/b.png",
    );
    expect(assetUrl("@brika/x", "1.0.0", "./a/b.png")).toBe(
      "/v1/plugins/%40brika%2Fx/v/1.0.0/files/a/b.png",
    );
  });
});

describe("manifestToDetail", () => {
  test("maps a valid manifest with relative asset URLs and capability counts", () => {
    const detail = manifestToDetail(i18nManifest, {
      publishedAt: "2026-06-16T00:00:00.000Z",
      updatedAt: "2026-06-16T01:00:00.000Z",
    });
    expect(detail).not.toBeNull();
    expect(detail?.name).toBe("@brika/plugin-i18n");
    expect(detail?.displayName).toBe("i18n Toolkit");
    expect(detail?.brikaEngine).toBe("^0.1.0");
    expect(detail?.iconUrl).toContain("/v1/plugins/");
    expect(detail?.capabilities).toEqual({ tools: 2, blocks: 1, bricks: 0, sparks: 0, pages: 0 });
    expect(detail?.screenshots).toHaveLength(2);
    expect(detail?.screenshots[0]?.caption).toBe("One");
    expect(detail?.repository).toBe("https://github.com/brikalabs/store");
    expect(detail?.author?.name).toBe("Brika Labs");
  });

  test("returns null when engines.brika is absent (not a Brika plugin)", () => {
    const { engines: _engines, ...notAPlugin } = i18nManifest;
    expect(manifestToDetail(notAPlugin as Manifest)).toBeNull();
  });

  test("omits the icon URL when no icon is declared", () => {
    const { icon: _icon, ...noIcon } = i18nManifest;
    expect(manifestToDetail(noIcon as Manifest)?.iconUrl).toBeUndefined();
  });
});

describe("manifestToSummary", () => {
  test("projects to a summary and drops detail-only fields", () => {
    const summary = manifestToSummary(i18nManifest);
    expect(summary?.name).toBe("@brika/plugin-i18n");
    expect(summary).not.toHaveProperty("screenshots");
    expect(summary).not.toHaveProperty("grants");
  });

  test("returns null for a non-plugin manifest", () => {
    const { engines: _e, ...notAPlugin } = i18nManifest;
    expect(manifestToSummary(notAPlugin as Manifest)).toBeNull();
  });
});

describe("pickDocPath / docLocales", () => {
  test("resolves requested -> en -> first declared", () => {
    const doc = { en: "./README.md", fr: "./README.fr.md" };
    expect(pickDocPath(doc, "fr")).toBe("./README.fr.md");
    expect(pickDocPath(doc, "de")).toBe("./README.md");
    expect(pickDocPath("./README.md", "fr")).toBe("./README.md");
    expect(pickDocPath(undefined)).toBeUndefined();
  });

  test("docLocales lists declared locales, empty for a single path", () => {
    expect(docLocales({ en: "a", fr: "b" })).toEqual(["en", "fr"]);
    expect(docLocales("./README.md")).toEqual([]);
    expect(docLocales(undefined)).toEqual([]);
  });
});

describe("isSafeAssetPath", () => {
  test("accepts relative paths inside the package", () => {
    expect(isSafeAssetPath("assets/icon.svg")).toBe(true);
    expect(isSafeAssetPath("locales/fr/store.json")).toBe(true);
  });

  test("rejects empty, absolute, and traversal paths", () => {
    expect(isSafeAssetPath("")).toBe(false);
    expect(isSafeAssetPath("/etc/passwd")).toBe(false);
    expect(isSafeAssetPath("../../etc/passwd")).toBe(false);
    expect(isSafeAssetPath("assets/../../secret")).toBe(false);
    expect(isSafeAssetPath("a\\..\\b")).toBe(false);
  });
});

describe("contentTypeFor", () => {
  test("maps known extensions and defaults to octet-stream", () => {
    expect(contentTypeFor("icon.svg")).toBe("image/svg+xml");
    expect(contentTypeFor("a.PNG")).toBe("image/png");
    expect(contentTypeFor("store.json")).toContain("application/json");
    expect(contentTypeFor("README.md")).toContain("text/markdown");
    expect(contentTypeFor("blob.bin")).toBe("application/octet-stream");
    expect(contentTypeFor("noext")).toBe("application/octet-stream");
  });
});

describe("versionsFromPackument", () => {
  test("returns releases newest-first with engine + deprecation", () => {
    const versions = versionsFromPackument({
      name: "@brika/plugin-i18n",
      "dist-tags": { latest: "0.2.0" },
      versions: {
        "0.1.0": { name: "@brika/plugin-i18n", version: "0.1.0", engines: { brika: "^0.1.0" } },
        "0.2.0": {
          name: "@brika/plugin-i18n",
          version: "0.2.0",
          engines: { brika: "^0.1.0" },
          deprecated: "use 0.3",
        },
      },
      time: { "0.1.0": "2026-01-01T00:00:00.000Z", "0.2.0": "2026-02-01T00:00:00.000Z" },
    });
    expect(versions.map((v) => v.version)).toEqual(["0.2.0", "0.1.0"]);
    expect(versions[0]?.deprecated).toBe("use 0.3");
  });

  test("orders by semver when versions share a publish timestamp", () => {
    // Three versions published in the same second must still order newest-first.
    const sameTime = "2026-01-01T00:00:00.000Z";
    const mk = (version: string) => ({ name: "@brika/p", version, engines: { brika: "^0.1.0" } });
    const versions = versionsFromPackument({
      name: "@brika/p",
      "dist-tags": { latest: "1.2.0" },
      versions: { "1.1.0": mk("1.1.0"), "1.2.0": mk("1.2.0"), "1.0.0": mk("1.0.0") },
      time: { "1.0.0": sameTime, "1.1.0": sameTime, "1.2.0": sameTime },
    });
    expect(versions.map((v) => v.version)).toEqual(["1.2.0", "1.1.0", "1.0.0"]);
  });
});

describe("compareVersionsDesc", () => {
  test("orders core versions newest-first", () => {
    expect([..."1.0.0 2.0.0 1.2.0 1.10.0".split(" ")].sort(compareVersionsDesc)).toEqual([
      "2.0.0",
      "1.10.0",
      "1.2.0",
      "1.0.0",
    ]);
  });

  test("a release outranks its prerelease", () => {
    expect(compareVersionsDesc("1.0.0", "1.0.0-rc.1")).toBeLessThan(0);
    expect(compareVersionsDesc("1.0.0-rc.2", "1.0.0-rc.1")).toBeLessThan(0);
  });
});
