import { describe, expect, test } from "bun:test";
import { createInjector } from "@brika/di";
import { transaction } from "@brika/tx";
import { AssetsBucket, AssetsPublicUrl, CfR2BlobStore } from "@/server/adapters/cf-r2-blob-store";

/**
 * The web's R2 adapter is a transactional resource: a put self-enlists its own rollback, so any saga
 * that wraps a put + a D1 write in transaction() compensates the staged object on failure, with no
 * onRollback at the call site.
 */

/** Minimal in-memory R2 bucket: only the put/delete the adapter touches. */
function fakeBucket() {
  const objects = new Map<string, Uint8Array | string>();
  const bucket = {
    put: async (key: string, value: Uint8Array | string) => {
      objects.set(key, value);
      return {};
    },
    delete: async (key: string) => {
      objects.delete(key);
    },
  };
  return { bucket: bucket as unknown as R2Bucket, objects };
}

function makeStore(bucket: R2Bucket): CfR2BlobStore {
  return createInjector([
    { provide: AssetsBucket, useValue: bucket },
    { provide: AssetsPublicUrl, useValue: undefined },
  ]).get(CfR2BlobStore);
}

describe("CfR2BlobStore", () => {
  test("put self-enlists its rollback: a failed unit deletes the staged object", async () => {
    const { bucket, objects } = fakeBucket();
    const blob = makeStore(bucket);
    await expect(
      transaction(async () => {
        await blob.put("k", new Uint8Array([1]), "image/webp");
        throw new Error("commit failed");
      }),
    ).rejects.toThrow("commit failed");
    expect(objects.has("k")).toBe(false);
  });

  test("a committed unit keeps the staged object", async () => {
    const { bucket, objects } = fakeBucket();
    const blob = makeStore(bucket);
    await transaction(async () => {
      await blob.put("k", new Uint8Array([1]));
    });
    expect(objects.has("k")).toBe(true);
  });

  test("a put outside a transaction stores the object and registers no rollback", async () => {
    const { bucket, objects } = fakeBucket();
    const blob = makeStore(bucket);
    await blob.put("k", new Uint8Array([1]));
    expect(objects.has("k")).toBe(true);
  });
});
