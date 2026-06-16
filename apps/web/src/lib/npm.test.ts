import { afterEach, describe, expect, test } from "bun:test";
import {
  cdnFileUrl,
  docLocales,
  getPackument,
  getWeeklyDownloads,
  pickDocPath,
  searchNpm,
  toPluginDetail,
  toPluginSummary,
} from "./npm";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

function stubFetch(handler: (url: string) => { body: unknown; status?: number }) {
  globalThis.fetch = ((input: string | URL | Request) => {
    const url = typeof input === "string" ? input : input.toString();
    const { body, status = 200 } = handler(url);
    return Promise.resolve(
      new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
      }),
    );
  }) as typeof fetch;
}

const packument = {
  name: "@brika/plugin-x",
  "dist-tags": { latest: "1.2.0" },
  description: "top-level desc",
  maintainers: [{ name: "octocat" }],
  versions: {
    "1.2.0": {
      version: "1.2.0",
      displayName: "Plugin X",
      description: "A plugin",
      engines: { brika: "^0.1.0" },
      icon: "./icon.svg",
      keywords: ["a"],
      author: "Octo Cat <o@cat.dev>",
      repository: { url: "git+https://github.com/o/x.git" },
      screenshots: [{ src: "s1.png", caption: "One" }, "s2.png"],
      tools: [{}, {}],
      blocks: [{}],
    },
  },
  time: { created: "2026-01-01T00:00:00.000Z", "1.2.0": "2026-02-01T00:00:00.000Z" },
};

describe("cdnFileUrl", () => {
  test("builds a jsDelivr URL, stripping ./", () => {
    expect(cdnFileUrl("@brika/plugin-x", "1.0.0", "./icon.svg")).toBe(
      "https://cdn.jsdelivr.net/npm/@brika/plugin-x@1.0.0/icon.svg",
    );
  });
});

describe("pickDocPath / docLocales", () => {
  test("resolves localized docs and lists locales", () => {
    const doc = { en: "README.md", fr: "README.fr.md" };
    expect(pickDocPath(doc, "fr")).toBe("README.fr.md");
    expect(pickDocPath(doc, "zz")).toBe("README.md");
    expect(pickDocPath("README.md")).toBe("README.md");
    expect(docLocales(doc)).toEqual(["en", "fr"]);
    expect(docLocales("README.md")).toEqual([]);
  });
});

describe("toPluginDetail", () => {
  test("maps the latest version, jsDelivr assets, and capability counts", () => {
    const detail = toPluginDetail(packument, 42);
    expect(detail?.name).toBe("@brika/plugin-x");
    expect(detail?.displayName).toBe("Plugin X");
    expect(detail?.downloadsWeekly).toBe(42);
    expect(detail?.iconUrl).toContain("cdn.jsdelivr.net");
    expect(detail?.capabilities).toEqual({ tools: 2, blocks: 1, bricks: 0, sparks: 0, pages: 0 });
    expect(detail?.author?.id).toBe("octocat");
    expect(detail?.repository).toBe("https://github.com/o/x");
    expect(detail?.screenshots).toHaveLength(2);
  });

  test("returns null when the latest version is not a Brika plugin", () => {
    const notPlugin = { ...packument, versions: { "1.2.0": { version: "1.2.0" } } };
    expect(toPluginDetail(notPlugin, 0)).toBeNull();
  });

  test("toPluginSummary drops detail-only fields", () => {
    const detail = toPluginDetail(packument, 0);
    if (detail === null) throw new Error("expected a detail");
    expect(toPluginSummary(detail)).not.toHaveProperty("screenshots");
  });
});

describe("network helpers", () => {
  test("getPackument parses a valid packument", async () => {
    stubFetch(() => ({ body: packument }));
    expect((await getPackument("@brika/plugin-x"))?.name).toBe("@brika/plugin-x");
  });

  test("getPackument returns null on a 404", async () => {
    stubFetch(() => ({ body: { error: "Not found" }, status: 404 }));
    expect(await getPackument("@brika/missing")).toBeNull();
  });

  test("getWeeklyDownloads reads the downloads point", async () => {
    stubFetch(() => ({ body: { downloads: 987 } }));
    expect(await getWeeklyDownloads("@brika/plugin-x")).toBe(987);
  });

  test("getWeeklyDownloads is 0 on failure", async () => {
    stubFetch(() => ({ body: {}, status: 500 }));
    expect(await getWeeklyDownloads("@brika/plugin-x")).toBe(0);
  });

  test("searchNpm maps hits", async () => {
    stubFetch(() => ({
      body: { objects: [{ package: { name: "@brika/plugin-x", version: "1.2.0" } }], total: 1 },
    }));
    const { hits, total } = await searchNpm("x", 10, 0);
    expect(total).toBe(1);
    expect(hits[0]?.name).toBe("@brika/plugin-x");
  });
});
