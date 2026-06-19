import { expect, test } from "bun:test";
import {
  type ManifestValidator,
  type MetadataWriter,
  type OwnershipPolicy,
  type PublishInput,
  PublishService,
  type TarballScanner,
  type TarballWriter,
} from "./publish";
import type { PackageVersion } from "./types";

function fakes() {
  const versions: PackageVersion[] = [];
  const tags: Array<{ name: string; tag: string; version: string }> = [];
  const puts: string[] = [];
  const meta: MetadataWriter = {
    versionExists: (name, version) =>
      Promise.resolve(versions.some((v) => v.name === name && v.version === version)),
    commitVersion: ({ version, tag }) => {
      versions.push(version);
      tags.push({ name: version.name, tag, version: version.version });
      return Promise.resolve();
    },
  };
  const tarballs: TarballWriter = {
    put: (key) => {
      puts.push(key);
      return Promise.resolve();
    },
    delete: () => Promise.resolve(),
  };
  return { versions, tags, puts, meta, tarballs };
}

const allow: OwnershipPolicy = { canPublish: () => Promise.resolve({ ok: true }) };
const deny: OwnershipPolicy = {
  canPublish: () => Promise.resolve({ ok: false, message: "not your scope" }),
};
const rejectingScanner: TarballScanner = {
  scan: () => Promise.resolve({ ok: false, message: "matched signature EICAR-Test" }),
};
const validManifest: ManifestValidator = { validate: () => Promise.resolve({ ok: true }) };
const invalidManifest: ManifestValidator = {
  validate: () => Promise.resolve({ ok: false, message: "icon required" }),
};

const input: PublishInput = {
  name: "@brika/plugin-x",
  version: "1.0.0",
  tarball: new TextEncoder().encode("TARBALL-BYTES"),
  manifest: { name: "@brika/plugin-x", version: "1.0.0" },
  identity: { owner: "brika", repository: "brika/plugin-x" },
};

test("publishes: integrity computed, tarball + version + dist-tag written", async () => {
  const f = fakes();
  const service = new PublishService(f.meta, f.tarballs, validManifest, allow, {
    clock: () => "2026-01-01T00:00:00.000Z",
  });
  const result = await service.publish(input);
  expect(result.ok).toBe(true);
  if (result.ok) {
    expect(result.integrity.startsWith("sha512-")).toBe(true);
    expect(result.size).toBe(13);
  }
  expect(f.puts).toEqual(["@brika/plugin-x/-/plugin-x-1.0.0.tgz"]);
  expect(f.versions).toHaveLength(1);
  expect(f.versions[0]?.provenance).toBeNull();
  expect(f.tags).toEqual([{ name: "@brika/plugin-x", tag: "latest", version: "1.0.0" }]);
});

test("persists CI provenance from the publish identity", async () => {
  const f = fakes();
  const service = new PublishService(f.meta, f.tarballs, validManifest, allow);
  const result = await service.publish({
    ...input,
    identity: {
      owner: "brikalabs",
      repository: "brikalabs/plugin-x",
      provenance: { repository: "brikalabs/plugin-x", sha: "a96a3a4", runId: "123" },
    },
  });
  expect(result.ok).toBe(true);
  expect(f.versions[0]?.provenance).toEqual({
    repository: "brikalabs/plugin-x",
    sha: "a96a3a4",
    runId: "123",
  });
});

test("rejects when ownership denies, without writing", async () => {
  const f = fakes();
  const result = await new PublishService(f.meta, f.tarballs, validManifest, deny).publish(input);
  expect(result).toEqual({ ok: false, code: "forbidden", message: "not your scope" });
  expect(f.puts).toEqual([]);
  expect(f.versions).toEqual([]);
});

test("rejects an invalid manifest (data gate), without writing", async () => {
  const f = fakes();
  const result = await new PublishService(f.meta, f.tarballs, invalidManifest, allow).publish(
    input,
  );
  expect(result).toEqual({ ok: false, code: "invalid", message: "icon required" });
  expect(f.puts).toEqual([]);
});

test("rejects an oversized tarball (413) before validating or writing", async () => {
  const f = fakes();
  const service = new PublishService(f.meta, f.tarballs, validManifest, allow, {
    maxTarballBytes: 4,
  });
  const result = await service.publish({
    ...input,
    tarball: new TextEncoder().encode("more than four bytes"),
  });
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.code).toBe("too_large");
  expect(f.puts).toEqual([]);
  expect(f.versions).toEqual([]);
});

test("rejects when the scanner refuses the bytes, without writing", async () => {
  const f = fakes();
  const service = new PublishService(f.meta, f.tarballs, validManifest, allow, {
    scanner: rejectingScanner,
  });
  const result = await service.publish(input);
  expect(result).toEqual({
    ok: false,
    code: "rejected",
    message: "matched signature EICAR-Test",
  });
  expect(f.puts).toEqual([]);
  expect(f.versions).toEqual([]);
});

test("scans only after immutability: an existing version is rejected before the scanner runs", async () => {
  const f = fakes();
  let scanned = false;
  const spyScanner: TarballScanner = {
    scan: () => {
      scanned = true;
      return Promise.resolve({ ok: true });
    },
  };
  f.versions.push({
    name: "@brika/plugin-x",
    version: "1.0.0",
    manifest: {},
    integrity: "x",
    shasum: "y",
    size: 1,
    publishedAt: "2026-01-01T00:00:00.000Z",
    deprecated: null,
    yanked: false,
  });
  const result = await new PublishService(f.meta, f.tarballs, validManifest, allow, {
    scanner: spyScanner,
  }).publish(input);
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.code).toBe("exists");
  expect(scanned).toBe(false);
});

test("publishes when the scanner passes (explicit scanner wired)", async () => {
  const f = fakes();
  const service = new PublishService(f.meta, f.tarballs, validManifest, allow, {
    scanner: { scan: () => Promise.resolve({ ok: true }) },
    clock: () => "2026-01-01T00:00:00.000Z",
  });
  const result = await service.publish(input);
  expect(result.ok).toBe(true);
  expect(f.puts).toEqual(["@brika/plugin-x/-/plugin-x-1.0.0.tgz"]);
  expect(f.versions).toHaveLength(1);
});

test("rejects re-publishing an existing version (immutability), without writing", async () => {
  const f = fakes();
  f.versions.push({
    name: "@brika/plugin-x",
    version: "1.0.0",
    manifest: {},
    integrity: "x",
    shasum: "y",
    size: 1,
    publishedAt: "2026-01-01T00:00:00.000Z",
    deprecated: null,
    yanked: false,
  });
  const result = await new PublishService(f.meta, f.tarballs, validManifest, allow).publish(input);
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.code).toBe("exists");
  expect(f.puts).toEqual([]);
});
