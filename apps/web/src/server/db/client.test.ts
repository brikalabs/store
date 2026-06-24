import { describe, expect, test } from "bun:test";
import { readOnlyTransaction, transaction } from "@brika/tx";
import { plugins } from "@/server/db/schema";
import { makeStoreDb } from "@/server/stores/test-harness";

/**
 * The store's D1 client is linked to @brika/tx (like the registry's metadata writer): a write is
 * blocked inside a read-only unit, and a deferBatch lands as one unit at the commit point, so it
 * rolls back with the rest of a saga instead of committing independently.
 */

const row = (name: string) => ({ name, latestVersion: "1.0.0", brikaEngine: "^0.1.0" });

describe("the store Database is transaction-aware", () => {
  test("a write inside a readOnlyTransaction is rejected, leaving the table untouched", async () => {
    const db = makeStoreDb();
    await expect(
      readOnlyTransaction(async () => {
        await db.insert(plugins).values(row("@brika/x"));
      }),
    ).rejects.toThrow("read-only");
    expect(await db.select().from(plugins)).toHaveLength(0);
  });

  test("deferBatch holds its writes until the unit commits, then lands them together", async () => {
    const db = makeStoreDb();
    await transaction(async () => {
      await db.deferBatch([
        db.insert(plugins).values(row("@brika/a")),
        db.insert(plugins).values(row("@brika/b")),
      ]);
      // Deferred: nothing is written yet, mid-unit.
      expect(await db.select().from(plugins)).toHaveLength(0);
    });
    expect(await db.select().from(plugins)).toHaveLength(2);
  });

  test("deferBatch does not apply when the unit rolls back", async () => {
    const db = makeStoreDb();
    await expect(
      transaction(async () => {
        await db.deferBatch([db.insert(plugins).values(row("@brika/a"))]);
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(await db.select().from(plugins)).toHaveLength(0);
  });
});
