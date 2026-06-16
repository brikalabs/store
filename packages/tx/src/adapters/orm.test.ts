import { describe, expect, test } from "bun:test";
import { transaction } from "../core/transaction";
import { FakeDb } from "../testing/fake-db";
import { InMemoryFiles } from "../testing/in-memory-files";
import { type Batchable, transactionalDb } from "./orm";
import { transactionalStorage } from "./storage";

describe("transactionalDb", () => {
  test("deferBatch defers the batch and flushes it at the commit point", async () => {
    const db = new FakeDb();
    const tx = transactionalDb(db);
    await transaction(async () => {
      await tx.deferBatch(["a", "b"]);
      expect(db.has("a")).toBe(false); // not yet: deferred to commit
    });
    expect(db.has("a")).toBe(true);
    expect(db.has("b")).toBe(true);
  });

  test("deferBatch does not flush when the transaction fails", async () => {
    const db = new FakeDb();
    const tx = transactionalDb(db);
    await expect(
      transaction(async () => {
        await tx.deferBatch(["a"]);
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(db.committed).toEqual([]);
  });

  test("multiple deferBatch calls flush in registration order at commit", async () => {
    const db = new FakeDb();
    const tx = transactionalDb(db);
    await transaction(async () => {
      await tx.deferBatch(["a"]);
      await tx.deferBatch(["b", "c"]);
      expect(db.committed).toEqual([]);
    });
    expect(db.committed).toEqual(["a", "b", "c"]);
  });

  test("deferBatch outside a transaction runs immediately", async () => {
    const db = new FakeDb();
    const tx = transactionalDb(db);
    await tx.deferBatch(["x"]);
    expect(db.has("x")).toBe(true);
  });

  test("preserves the wrapped client's other methods (the overlay is transparent)", async () => {
    const db = new FakeDb();
    const tx = transactionalDb(db);
    await tx.batch(["direct"]); // the original `batch` still works (immediate)
    expect(tx.has("direct")).toBe(true); // a non-batch method, delegated through
  });

  test("a failing commit batch rolls back the staged files (cross-adapter)", async () => {
    const raw = new InMemoryFiles();
    const files = transactionalStorage(raw);
    const failing: Batchable<string> = {
      batch: async () => {
        throw new Error("d1 down");
      },
    };
    const db = transactionalDb(failing);
    await expect(
      transaction(async () => {
        await files.put("x.tgz", "bytes"); // staged
        await db.deferBatch(["version:x"]); // flushed at commit -> throws -> rolls back the file
      }),
    ).rejects.toThrow("d1 down");
    expect(raw.has("x.tgz")).toBe(false);
  });
});
