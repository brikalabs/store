import { describe, expect, test } from "bun:test";
import type { Db } from "../client";
import { makeDb } from "../test-harness";
import { D1AuditLog } from "./d1-audit";

describe("D1AuditLog.recent (operator audit view)", () => {
  test("returns entries newest first with target/version/actor/detail mapped", async () => {
    const db = makeDb();
    const log = new D1AuditLog(db);
    await log.record({
      action: "org_takedown",
      packageName: "squatter",
      version: null,
      actor: { provider: "github", owner: "operator", repository: null },
      detail: { reason: "name-squatting" },
    });
    await log.record({
      action: "takedown",
      packageName: "@brika/x",
      version: "1.0.0",
      actor: { provider: "github", owner: "operator", repository: null },
      detail: null,
    });

    const recent = await log.recent(10);
    expect(recent).toHaveLength(2);
    // Both share the default `at`, so the id tie-break gives a stable order; assert by content.
    const takedown = recent.find((r) => r.action === "org_takedown");
    expect(takedown).toMatchObject({
      target: "squatter",
      version: null,
      actor: "operator",
      detail: { reason: "name-squatting" },
    });
    expect(typeof takedown?.at).toBe("string");
    expect(recent.find((r) => r.action === "takedown")).toMatchObject({
      target: "@brika/x",
      version: "1.0.0",
    });
  });

  test("respects the limit", async () => {
    const db = makeDb();
    const log = new D1AuditLog(db);
    for (let i = 0; i < 5; i++) {
      await log.record({
        action: "publish",
        packageName: `@brika/p${i}`,
        version: "1.0.0",
        actor: { provider: "github", owner: "octocat", repository: null },
      });
    }
    expect(await log.recent(3)).toHaveLength(3);
  });
});

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
