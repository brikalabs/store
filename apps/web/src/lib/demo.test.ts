import { describe, expect, test } from "bun:test";
import type { DeveloperProfile, PluginDetail, PluginSummary } from "@brika/registry-contract";
import { demoDetail, demoGrants, demoLocales, demoProfile, demoSummary } from "./demo";

const baseSummary: PluginSummary = {
  name: "@brika/plugin-x",
  version: "1.0.0",
  keywords: [],
  downloadsWeekly: 0,
  brikaEngine: "^0.1.0",
  verified: false,
  featured: false,
};

describe("demoSummary", () => {
  test("fills missing rating, downloads, and curation deterministically", () => {
    const a = demoSummary(baseSummary);
    const b = demoSummary(baseSummary);
    expect(a).toEqual(b);
    expect(a.rating?.average).toBeGreaterThanOrEqual(0);
    expect(a.downloadsWeekly).toBeGreaterThan(0);
  });

  test("preserves real values when present", () => {
    const withReal = { ...baseSummary, downloadsWeekly: 1234, rating: { average: 4.2, count: 9 } };
    const out = demoSummary(withReal);
    expect(out.downloadsWeekly).toBe(1234);
    expect(out.rating).toEqual({ average: 4.2, count: 9 });
  });
});

describe("demoGrants", () => {
  test("synthesizes 2-4 described grants when none are declared", () => {
    const grants = demoGrants("@brika/plugin-x", {});
    const count = Object.keys(grants).length;
    expect(count).toBeGreaterThanOrEqual(2);
    expect(count).toBeLessThanOrEqual(4);
    for (const grant of Object.values(grants)) expect(grant.description.length).toBeGreaterThan(0);
  });

  test("backfills descriptions for real grants", () => {
    const grants = demoGrants("@brika/plugin-x", { "dev.brika.net.fetch": {} });
    expect(grants["dev.brika.net.fetch"]?.description).toContain("HTTPS");
  });

  test("uses an explicit description on the grant value when present", () => {
    const grants = demoGrants("@brika/plugin-x", { "x.custom": { description: "Custom reason" } });
    expect(grants["x.custom"]?.description).toBe("Custom reason");
  });
});

describe("demoDetail", () => {
  test("enriches a detail with summary fields and described grants", () => {
    const detail: PluginDetail = { ...baseSummary, grants: {}, screenshots: [] };
    const out = demoDetail(detail);
    expect(Object.keys(out.grants).length).toBeGreaterThanOrEqual(2);
    expect(out.downloadsWeekly).toBeGreaterThan(0);
  });
});

describe("demoLocales", () => {
  test("returns the real list when non-empty", () => {
    expect(demoLocales("x", ["en", "fr"])).toEqual(["en", "fr"]);
  });

  test("synthesizes a stable list starting with en otherwise", () => {
    const locales = demoLocales("@brika/plugin-x", []);
    expect(locales[0]).toBe("en");
    expect(locales.length).toBeGreaterThanOrEqual(1);
    expect(demoLocales("@brika/plugin-x", [])).toEqual(locales);
  });
});

describe("demoProfile", () => {
  test("fills a missing bio referencing the plugin count", () => {
    const profile: DeveloperProfile = { id: "dev", verified: false, pluginCount: 3 };
    const out = demoProfile(profile, 3);
    expect(out.bio).toContain("3");
  });

  test("keeps a real bio", () => {
    const profile: DeveloperProfile = { id: "dev", verified: true, pluginCount: 1, bio: "Hi" };
    expect(demoProfile(profile, 1).bio).toBe("Hi");
  });
});
