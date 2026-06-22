import { expect, test } from "bun:test";
import { provide, testBed } from "@brika/di";
import { MetadataReader, TarballReader } from "./ports";
import { RegistryBaseUrl, ResolveService } from "./resolve";
import type { PackageRecord } from "./types";

const record: PackageRecord = {
  name: "@brika/plugin-x",
  distTags: { latest: "1.0.0" },
  createdAt: "2026-01-01T00:00:00.000Z",
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
    },
  ],
};

const meta: MetadataReader = {
  getPackage: (name) => Promise.resolve(name === record.name ? record : null),
};
const tarballs: TarballReader = {
  get: (key) =>
    Promise.resolve(
      key === "@brika/plugin-x/-/plugin-x-1.0.0.tgz" ? new Response("TARBALL").body : null,
    ),
};

const service = testBed(
  provide(MetadataReader, meta),
  provide(TarballReader, tarballs),
  provide(RegistryBaseUrl, "https://registry.brika.dev"),
).inject(ResolveService);

test("resolves a known packument and null for unknown", async () => {
  expect((await service.packument("@brika/plugin-x"))?.name).toBe("@brika/plugin-x");
  expect(await service.packument("@brika/missing")).toBeNull();
});

test("streams a tarball by name + version, null when absent", async () => {
  expect(await service.tarball("@brika/plugin-x", "1.0.0")).not.toBeNull();
  expect(await service.tarball("@brika/plugin-x", "9.9.9")).toBeNull();
});
