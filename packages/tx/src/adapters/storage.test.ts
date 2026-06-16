import { describe, expect, test } from "bun:test";
import { requiresNew } from "../core/propagation";
import { transaction } from "../core/transaction";
import { InMemoryFiles } from "../testing/in-memory-files";
import { type FileStore, transactionalStorage } from "./storage";

describe("transactionalStorage", () => {
  test("keeps a put when the transaction commits", async () => {
    const files = new InMemoryFiles();
    const tx = transactionalStorage(files);
    await transaction(async () => {
      await tx.put("k", "v");
    });
    expect(files.has("k")).toBe(true);
  });

  test("rolls back the put when the transaction fails", async () => {
    const files = new InMemoryFiles();
    const tx = transactionalStorage(files);
    await expect(
      transaction(async () => {
        await tx.put("k", "v");
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(files.has("k")).toBe(false);
  });

  test("rolls back multiple puts in reverse order", async () => {
    const deleted: string[] = [];
    const raw = new InMemoryFiles();
    const tracked: FileStore = {
      put: (key, value) => raw.put(key, value),
      delete: (key) => {
        deleted.push(key);
        return raw.delete(key);
      },
    };
    const tx = transactionalStorage(tracked);
    await expect(
      transaction(async () => {
        await tx.put("a", "1");
        await tx.put("b", "2");
        await tx.put("c", "3");
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(deleted).toEqual(["c", "b", "a"]);
    expect(raw.objects.size).toBe(0);
  });

  test("a requiresNew put survives an outer rollback", async () => {
    const files = new InMemoryFiles();
    const tx = transactionalStorage(files);
    await expect(
      transaction(async () => {
        await tx.put("outer.tgz", "x");
        await transaction(async () => {
          await tx.put("inner.tgz", "y");
        }, requiresNew);
        throw new Error("outer fails");
      }),
    ).rejects.toThrow("outer fails");
    expect(files.has("outer.tgz")).toBe(false); // rolled back
    expect(files.has("inner.tgz")).toBe(true); // independent inner committed
  });

  test("preserves the wrapped store's other methods (the overlay is transparent)", async () => {
    const files = new InMemoryFiles();
    const tx = transactionalStorage(files);
    await tx.put("k", "v");
    expect(await tx.get("k")).toBe("v"); // delegated `get`
    expect(tx.has("k")).toBe(true); // a non-FileStore method, still usable
  });

  test("outside a transaction a put is a plain write (nothing to roll back)", async () => {
    const files = new InMemoryFiles();
    const tx = transactionalStorage(files);
    await tx.put("k", "v");
    expect(files.has("k")).toBe(true);
  });
});
