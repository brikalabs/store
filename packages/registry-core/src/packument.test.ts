import { expect, test } from "bun:test";
import { buildAbbreviatedPackument, buildPackument, tarballPath, unscopedName } from "./packument";
import type { PackageRecord } from "./types";

const record: PackageRecord = {
  name: "@brika/plugin-x",
  distTags: { latest: "1.1.0" },
  createdAt: "2026-01-01T00:00:00.000Z",
  publisher: null,
  versions: [
    {
      name: "@brika/plugin-x",
      version: "1.0.0",
      manifest: { dependencies: { foo: "^1.0.0" } },
      integrity: "sha512-aaa",
      shasum: "abc123",
      size: 10,
      publishedAt: "2026-01-01T00:00:00.000Z",
      deprecated: null,
      yanked: false,
    },
    {
      name: "@brika/plugin-x",
      version: "1.1.0",
      manifest: {},
      integrity: "sha512-bbb",
      shasum: "def456",
      size: 20,
      publishedAt: "2026-02-01T00:00:00.000Z",
      deprecated: "use 2.x",
      yanked: false,
    },
    {
      name: "@brika/plugin-x",
      version: "0.9.0",
      manifest: {},
      integrity: "sha512-ccc",
      shasum: "old",
      size: 5,
      publishedAt: "2025-12-01T00:00:00.000Z",
      deprecated: null,
      yanked: true,
    },
  ],
};

test("unscopedName + tarballPath follow npm convention", () => {
  expect(unscopedName("@brika/plugin-x")).toBe("plugin-x");
  expect(unscopedName("unscoped")).toBe("unscoped");
  expect(tarballPath("@brika/plugin-x", "1.0.0")).toBe("@brika/plugin-x/-/plugin-x-1.0.0.tgz");
});

test("builds an npm packument with dist and dist-tags", () => {
  const packument = buildPackument(record, "https://registry.brika.dev/");
  expect(packument.name).toBe("@brika/plugin-x");
  expect(packument["dist-tags"]).toEqual({ latest: "1.1.0" });
  expect(packument.versions["1.0.0"]?.dist).toEqual({
    tarball: "https://registry.brika.dev/@brika/plugin-x/-/plugin-x-1.0.0.tgz",
    integrity: "sha512-aaa",
    shasum: "abc123",
    size: 10,
  });
  expect(packument.versions["1.0.0"]?.dependencies).toEqual({ foo: "^1.0.0" });
});

test("hides yanked versions and surfaces deprecation + modified time", () => {
  const packument = buildPackument(record, "https://registry.brika.dev");
  expect(Object.keys(packument.versions).sort()).toEqual(["1.0.0", "1.1.0"]);
  expect(packument.versions["1.1.0"]?.deprecated).toBe("use 2.x");
  expect(packument.time.modified).toBe("2026-02-01T00:00:00.000Z");
  expect(packument.time.created).toBe("2026-01-01T00:00:00.000Z");
});

test("buildAbbreviatedPackument keeps install fields and drops the rest", () => {
  const fat: PackageRecord = {
    name: "@brika/plugin-y",
    distTags: { latest: "2.0.0" },
    createdAt: "2026-01-01T00:00:00.000Z",
    publisher: null,
    versions: [
      {
        name: "@brika/plugin-y",
        version: "2.0.0",
        manifest: {
          name: "@brika/plugin-y",
          version: "2.0.0",
          dependencies: { foo: "^1.0.0" },
          engines: { brika: "^0.3.0" },
          readme: "a very long readme",
          scripts: { postinstall: "node setup.js", build: "tsc" },
          description: "trimmed away",
        },
        integrity: "sha512-zzz",
        shasum: "abc",
        size: 100,
        publishedAt: "2026-02-01T00:00:00.000Z",
        deprecated: null,
        yanked: false,
      },
    ],
  };

  const packument = buildAbbreviatedPackument(fat, "https://registry.brika.dev");
  const version = packument.versions["2.0.0"];
  expect(packument.modified).toBe("2026-02-01T00:00:00.000Z");
  expect("time" in packument).toBe(false);
  expect(version?.dependencies).toEqual({ foo: "^1.0.0" });
  expect(version?.engines).toEqual({ brika: "^0.3.0" });
  expect(version?.dist).toBeDefined();
  expect(version?.hasInstallScript).toBe(true);
  expect(version?.readme).toBeUndefined();
  expect(version?.scripts).toBeUndefined();
  expect(version?.description).toBeUndefined();
});

test("hides a taken-down version and surfaces its reason under takedowns", () => {
  const withTakedown: PackageRecord = {
    name: "@brika/plugin-x",
    distTags: { latest: "1.1.0" },
    createdAt: "2026-01-01T00:00:00.000Z",
    publisher: null,
    versions: [
      {
        name: "@brika/plugin-x",
        version: "1.0.0",
        manifest: {},
        integrity: "sha512-aaa",
        shasum: "abc",
        size: 10,
        publishedAt: "2026-01-01T00:00:00.000Z",
        deprecated: null,
        yanked: false,
        takedownReason: "malware: exfiltrates env",
      },
      {
        name: "@brika/plugin-x",
        version: "1.1.0",
        manifest: {},
        integrity: "sha512-bbb",
        shasum: "def",
        size: 20,
        publishedAt: "2026-02-01T00:00:00.000Z",
        deprecated: null,
        yanked: false,
        takedownReason: null,
      },
    ],
  };

  const full = buildPackument(withTakedown, "https://registry.brika.dev");
  expect(Object.keys(full.versions)).toEqual(["1.1.0"]); // taken-down version hidden
  expect(full.takedowns).toEqual({ "1.0.0": "malware: exfiltrates env" });

  // The abbreviated (install) packument hides it too, with no takedowns surface.
  const abbreviated = buildAbbreviatedPackument(withTakedown, "https://registry.brika.dev");
  expect(Object.keys(abbreviated.versions)).toEqual(["1.1.0"]);
  expect("takedowns" in abbreviated).toBe(false);
});

test("emits the verified publisher (id+name+verified) on the full packument only", () => {
  const withPublisher: PackageRecord = {
    name: "@brika/plugin-x",
    distTags: { latest: "1.0.0" },
    createdAt: "2026-01-01T00:00:00.000Z",
    publisher: { id: "brika", name: "Brika Labs" },
    versions: [
      {
        name: "@brika/plugin-x",
        version: "1.0.0",
        manifest: {},
        integrity: "sha512-aaa",
        shasum: "abc",
        size: 10,
        publishedAt: "2026-01-01T00:00:00.000Z",
        deprecated: null,
        yanked: false,
        takedownReason: null,
      },
    ],
  };

  const full = buildPackument(withPublisher, "https://registry.brika.dev");
  expect(full.publisher).toEqual({ id: "brika", name: "Brika Labs", verified: true });

  // No publisher -> the field is omitted entirely (not null/undefined noise).
  expect("publisher" in buildPackument(record, "https://registry.brika.dev")).toBe(false);

  // The abbreviated install document never carries publisher (bun ignores it anyway).
  expect(
    "publisher" in buildAbbreviatedPackument(withPublisher, "https://registry.brika.dev"),
  ).toBe(false);
});
