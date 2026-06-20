import { describe, expect, test } from "bun:test";
import type { Db } from "../client";
import { D1AuditLog } from "./d1-audit";

describe("D1AuditLog.record", () => {
  test("swallows a write failure so a committed action is never turned into a 500", async () => {
    // A db whose audit insert rejects (e.g. transient D1 failure).
    const failingDb = {
      insert: () => ({
        values: async () => {
          throw new Error("d1 unavailable");
        },
      }),
    } as unknown as Db;

    const captured: unknown[] = [];
    const original = console.error;
    console.error = (...args: unknown[]) => captured.push(args);
    try {
      await expect(
        new D1AuditLog(failingDb).record({
          action: "publish",
          packageName: "@brika/x",
          version: "1.0.0",
          actor: { owner: "octocat", repository: null },
        }),
      ).resolves.toBeUndefined();
    } finally {
      console.error = original;
    }

    // The failure is swallowed but logged, so it stays visible in the worker's logs.
    expect(captured).toHaveLength(1);
  });
});
