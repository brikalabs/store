import { expect, test } from "bun:test";
import { z } from "zod";
import {
  PageQuery,
  PluginDetail,
  PluginSummary,
  pageSchema,
  RegistryCapabilities,
  SearchQuery,
} from "./index";

test("PageQuery coerces and clamps the window", () => {
  expect(PageQuery.parse({})).toEqual({ limit: 20, offset: 0 });
  expect(PageQuery.parse({ limit: "5", offset: "40" })).toEqual({ limit: 5, offset: 40 });
  expect(PageQuery.safeParse({ limit: "0" }).success).toBe(false);
  expect(PageQuery.safeParse({ limit: "101" }).success).toBe(false);
});

test("pageSchema validates a paginated response over its item", () => {
  const Page = pageSchema(z.object({ name: z.string() }));
  expect(Page.parse({ items: [{ name: "a" }], total: 1, limit: 20, offset: 0 }).items).toEqual([
    { name: "a" },
  ]);
  expect(Page.safeParse({ items: [{ name: "a" }], total: -1, limit: 20, offset: 0 }).success).toBe(
    false,
  );
});

test("SearchQuery coerces strings and applies defaults", () => {
  const parsed = SearchQuery.parse({ limit: "30", offset: "10" });
  expect(parsed.limit).toBe(30);
  expect(parsed.offset).toBe(10);
  expect(parsed.sort).toBe("downloads");
  expect(SearchQuery.parse({}).limit).toBe(20);
});

test("SearchQuery rejects out-of-range limits", () => {
  expect(SearchQuery.safeParse({ limit: "0" }).success).toBe(false);
  expect(SearchQuery.safeParse({ limit: "1000" }).success).toBe(false);
});

test("SearchQuery accepts tags/capabilities as a comma string or an array, defaulting to none", () => {
  expect(SearchQuery.parse({ tags: "geo,maps" }).tags).toEqual(["geo", "maps"]);
  expect(SearchQuery.parse({ tags: ["geo"] }).tags).toEqual(["geo"]);
  expect(SearchQuery.parse({ tags: "geo,," }).tags).toEqual(["geo"]);
  expect(SearchQuery.parse({}).tags).toEqual([]);
  expect(SearchQuery.parse({ capabilities: "tools,pages" }).capabilities).toEqual([
    "tools",
    "pages",
  ]);
  expect(SearchQuery.parse({ capabilities: ["blocks"] }).capabilities).toEqual(["blocks"]);
  expect(SearchQuery.parse({}).capabilities).toEqual([]);
  expect(SearchQuery.safeParse({ capabilities: "tools,bogus" }).success).toBe(false);
});

test("PluginSummary applies sensible defaults", () => {
  const plugin = PluginSummary.parse({ name: "@brika/x", version: "1.0.0", brikaEngine: "^0.3.0" });
  expect(plugin.keywords).toEqual([]);
  expect(plugin.verified).toBe(false);
  expect(plugin.featured).toBe(false);
  expect(plugin.downloadsWeekly).toBe(0);
});

test("PluginDetail defaults grants and screenshots", () => {
  const detail = PluginDetail.parse({ name: "@brika/x", version: "1.0.0", brikaEngine: "^0.3.0" });
  expect(detail.grants).toEqual({});
  expect(detail.screenshots).toEqual([]);
});

test("PluginDetail accepts screenshots with resolved caption and alt", () => {
  const detail = PluginDetail.parse({
    name: "@brika/x",
    version: "1.0.0",
    brikaEngine: "^0.3.0",
    screenshots: [
      { url: "https://cdn.example/1.png" },
      { url: "https://cdn.example/2.png", caption: "The board", alt: "A board of bricks" },
    ],
  });
  expect(detail.screenshots).toHaveLength(2);
  expect(detail.screenshots[1]?.caption).toBe("The board");
  expect(
    PluginDetail.safeParse({
      name: "@brika/x",
      version: "1.0.0",
      brikaEngine: "^0.3.0",
      screenshots: ["https://cdn.example/1.png"],
    }).success,
  ).toBe(false);
});

test("RegistryCapabilities validates the feature set", () => {
  const caps = RegistryCapabilities.parse({
    name: "Store",
    contractVersion: "1.0",
    features: ["search", "plugins"],
  });
  expect(caps.features).toContain("search");
  expect(
    RegistryCapabilities.safeParse({ name: "x", contractVersion: "1.0", features: ["nope"] })
      .success,
  ).toBe(false);
});
