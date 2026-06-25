import { expect, test } from "bun:test";
import { provide, testBed } from "@brika/di";
import { MetadataReader, TarballReader } from "./ports";
import { RegistryBaseUrl, ResolveService } from "./resolve";
import type { PackageRecord } from "./types";

function record(over: Partial<PackageRecord> = {}): PackageRecord {
  return {
    name: "@brika/plugin-x",
    distTags: { latest: "1.0.0" },
    createdAt: "2026-01-01T00:00:00.000Z",
    publisher: null,
    verified: false,
    takedown: null,
    scopeTakedown: null,
    versions: [
      {
        name: "@brika/plugin-x",
        version: "1.0.0",
        manifest: {},
        integrity: "sha512-aaa",
        shasum: "abc123",
        size: 10,
        publishedAt: "2026-01-01T00:00:00.000Z",
        deprecated: null,
        yanked: false,
        takedownReason: null,
        provenance: null,
      },
    ],
    ...over,
  };
}

function makeService(rec: PackageRecord | null) {
  const meta: MetadataReader = {
    getPackage: (name) => Promise.resolve(rec !== null && name === rec.name ? rec : null),
  };
  const tarballs: TarballReader = {
    get: (key) =>
      Promise.resolve(
        key === "@brika/plugin-x/-/plugin-x-1.0.0.tgz" ? new Response("TARBALL").body : null,
      ),
  };
  return testBed(
    provide(MetadataReader, meta),
    provide(TarballReader, tarballs),
    provide(RegistryBaseUrl, "https://registry.brika.dev"),
  ).inject(ResolveService);
}

test("resolves a known packument and null for unknown", async () => {
  const service = makeService(record());
  expect((await service.packument("@brika/plugin-x"))?.name).toBe("@brika/plugin-x");
  expect(await service.packument("@brika/missing")).toBeNull();
});

test("streams a tarball by name + version, null when absent", async () => {
  const service = makeService(record());
  expect(await service.tarball("@brika/plugin-x", "1.0.0")).not.toBeNull();
  expect(await service.tarball("@brika/plugin-x", "9.9.9")).toBeNull();
});

test("a whole-package takedown hides the packument AND the tarball bytes", async () => {
  const service = makeService(record({ takedown: "policy violation" }));
  expect(await service.packument("@brika/plugin-x")).toBeNull();
  expect(await service.packument("@brika/plugin-x", { abbreviated: true })).toBeNull();
  expect(await service.tarball("@brika/plugin-x", "1.0.0")).toBeNull();
});

test("a taken-down scope hides every package under it, packument and tarball", async () => {
  const service = makeService(record({ scopeTakedown: "scope squatting" }));
  expect(await service.packument("@brika/plugin-x")).toBeNull();
  expect(await service.tarball("@brika/plugin-x", "1.0.0")).toBeNull();
});
