import { expect, test } from "bun:test";
import { PluginDetail, PluginSummary, RegistryCapabilities, SearchQuery, V1_ROUTES } from "./index";

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

test("V1_ROUTES expose the contract paths", () => {
  expect(V1_ROUTES.plugin).toBe("/v1/plugins/:name");
  expect(V1_ROUTES.search).toBe("/v1/search");
});
