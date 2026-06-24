import { describe, expect, test } from "bun:test";
import { createInjector, runInInjectionContext } from "@brika/di";
import { onRollback } from "@brika/tx";
import { MAX_AVATAR_BYTES, userAvatarKey } from "@/lib/avatar";
import { Db } from "@/server/db/client";
import { BlobStore } from "@/server/ports/blob-store";
import { makeStoreDb } from "@/server/stores/test-harness";
import { UserProfileStore } from "@/server/stores/user-profile-store";
import { UserStore } from "@/server/stores/user-store";
import { uploadUserAvatar } from "@/server/user-avatar";

/**
 * uploadUserAvatar stages an R2 blob then commits the D1 pointer in one tx unit. The load-bearing
 * case is the rollback: a failed D1 write must compensate the staged blob so no orphan is left in R2.
 */

/** A BlobStore that records its put/delete calls, so a test can assert what the saga staged or compensated. */
function recordingBlob() {
  const puts: { key: string; type?: string }[] = [];
  const deletes: string[] = [];
  const del = async (key: string) => {
    deletes.push(key);
  };
  const store: BlobStore = {
    get: async () => null,
    url: (key) => `https://cdn.test/${key}`,
    // Mirror CfR2BlobStore: a put self-enlists its rollback (a no-op outside a transaction), so the
    // test proves uploadUserAvatar opens the unit, not that the fake compensates.
    put: async (key, _value, contentType) => {
      puts.push({ key, type: contentType });
      onRollback(() => del(key));
    },
    delete: del,
  };
  return { store, puts, deletes };
}

/** A UserProfileStore whose D1 write fails, to drive the rollback path. */
class ThrowingProfileStore extends UserProfileStore {
  override setAvatarVersion(): Promise<void> {
    return Promise.reject(new Error("d1 write failed"));
  }
}

/** Minimal valid WebP: a RIFF container tagged WEBP, so sniffImageMime accepts it. */
function webpBytes(size = 64): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(size);
  bytes.set([0x52, 0x49, 0x46, 0x46], 0); // "RIFF"
  bytes.set([0x57, 0x45, 0x42, 0x50], 8); // "WEBP"
  return bytes;
}

describe("uploadUserAvatar", () => {
  test("stores the blob, persists the version, and returns the cache-busted URL", async () => {
    const { store, puts, deletes } = recordingBlob();
    const injector = createInjector([
      { provide: Db, useValue: makeStoreDb() },
      { provide: BlobStore, useValue: store },
    ]);
    await injector.get(UserStore).upsert({ id: "user1", name: "octo" });

    const url = await runInInjectionContext(injector, () => uploadUserAvatar("user1", webpBytes()));

    expect(puts).toEqual([{ key: userAvatarKey("user1"), type: "image/webp" }]);
    expect(deletes).toHaveLength(0);
    expect(url).toMatch(/^https:\/\/cdn\.test\/user-avatars\/user1\.webp\?v=[0-9a-f]+$/);
    // The D1 pointer committed: the profile now resolves to the uploaded avatar.
    expect((await injector.get(UserProfileStore).get("user1"))?.avatarUrl).toBe(url);
  });

  test("rolls back the staged blob and re-throws when the D1 write fails", async () => {
    const { store, puts, deletes } = recordingBlob();
    const injector = createInjector([
      { provide: Db, useValue: makeStoreDb() },
      { provide: BlobStore, useValue: store },
      { provide: UserProfileStore, useClass: ThrowingProfileStore },
    ]);

    await expect(
      runInInjectionContext(injector, () => uploadUserAvatar("user1", webpBytes())),
    ).rejects.toThrow("d1 write failed");

    // The blob was staged then compensated: deleted with the same key, leaving no orphan.
    expect(puts).toEqual([{ key: userAvatarKey("user1"), type: "image/webp" }]);
    expect(deletes).toEqual([userAvatarKey("user1")]);
  });

  test("rejects an empty upload without touching R2", async () => {
    const { store, puts } = recordingBlob();
    const injector = createInjector([
      { provide: Db, useValue: makeStoreDb() },
      { provide: BlobStore, useValue: store },
    ]);
    await expect(
      runInInjectionContext(injector, () => uploadUserAvatar("user1", new Uint8Array(0))),
    ).rejects.toThrow("Empty upload");
    expect(puts).toHaveLength(0);
  });

  test("rejects an oversized upload without touching R2", async () => {
    const { store, puts } = recordingBlob();
    const injector = createInjector([
      { provide: Db, useValue: makeStoreDb() },
      { provide: BlobStore, useValue: store },
    ]);
    await expect(
      runInInjectionContext(injector, () =>
        uploadUserAvatar("user1", new Uint8Array(MAX_AVATAR_BYTES + 1)),
      ),
    ).rejects.toThrow("exceeds");
    expect(puts).toHaveLength(0);
  });

  test("rejects a non-WebP upload without touching R2", async () => {
    const { store, puts } = recordingBlob();
    const injector = createInjector([
      { provide: Db, useValue: makeStoreDb() },
      { provide: BlobStore, useValue: store },
    ]);
    const png = new Uint8Array(16);
    png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
    await expect(
      runInInjectionContext(injector, () => uploadUserAvatar("user1", png)),
    ).rejects.toThrow("WebP");
    expect(puts).toHaveLength(0);
  });
});
