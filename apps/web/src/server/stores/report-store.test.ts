import { beforeEach, expect, test } from "bun:test";
import { provide, testBed } from "@brika/di";
import { Db } from "@/server/db/client";
import { plugins, users } from "@/server/db/schema";
import { BlobStore } from "@/server/ports/blob-store";
import { ReportStore } from "@/server/stores/report-store";
import { makeStoreDb } from "@/server/stores/test-harness";

const blob: BlobStore = {
  url: () => undefined,
  get: async () => null,
  put: async () => {},
  delete: async () => {},
};

let db: Db;
let store: ReportStore;

beforeEach(async () => {
  db = makeStoreDb();
  store = testBed(provide(Db, db), provide(BlobStore, blob)).inject(ReportStore);
  await db.insert(users).values({ id: "u1", name: "Alice" });
  await db.insert(users).values({ id: "u2", name: "Bob" });
  await db
    .insert(plugins)
    .values({ name: "@brika/x", displayName: "Brika X", latestVersion: "1.0.0", brikaEngine: "1" });
});

async function fileReport(reporter = "u1", target = "@brika/x", reason = "security") {
  await store.create({
    targetType: "plugin",
    targetId: target,
    reporterUserId: reporter,
    reason,
    details: "ships an obfuscated post-install",
  });
}

test("list (open) returns the report joined to plugin + reporter", async () => {
  await fileReport();
  const page = await store.list({ status: "open", limit: 20, offset: 0 });
  expect(page.total).toBe(1);
  expect(page.items).toHaveLength(1);
  const row = page.items[0];
  expect(row?.pluginName).toBe("@brika/x");
  expect(row?.pluginDisplayName).toBe("Brika X");
  expect(row?.reason).toBe("security");
  expect(row?.details).toBe("ships an obfuscated post-install");
  expect(row?.reporter.id).toBe("u1");
  expect(row?.reporter.displayName).toBe("Alice");
});

test("hasOpenFrom is true only for the same reporter+target while open", async () => {
  await fileReport();
  expect(await store.hasOpenFrom("u1", "plugin", "@brika/x")).toBe(true);
  expect(await store.hasOpenFrom("u2", "plugin", "@brika/x")).toBe(false);
  expect(await store.hasOpenFrom("u1", "plugin", "@brika/other")).toBe(false);
});

test("topReasonByTarget picks the most-reported open reason per package", async () => {
  await fileReport("u1", "@brika/x", "spam");
  await fileReport("u2", "@brika/x", "security");
  // a third spam report makes spam the clear top reason for @brika/x
  await db.insert(users).values({ id: "u3", name: "Cara" });
  await store.create({
    targetType: "plugin",
    targetId: "@brika/x",
    reporterUserId: "u3",
    reason: "spam",
  });

  expect(await store.topReasonByTarget([])).toEqual(new Map());
  const top = await store.topReasonByTarget(["@brika/x"]);
  expect(top.get("@brika/x")).toBe("spam");
});

test("openCountsByScope sums open reports per scope across the scope's plugins", async () => {
  await db
    .insert(plugins)
    .values({ name: "@brika/a", scope: "@brika", latestVersion: "1.0.0", brikaEngine: "1" });
  await db
    .insert(plugins)
    .values({ name: "@acme/b", scope: "@acme", latestVersion: "1.0.0", brikaEngine: "1" });
  await fileReport("u1", "@brika/a");
  await fileReport("u1", "@acme/b");
  await fileReport("u2", "@acme/b");

  expect(await store.openCountsByScope([])).toEqual(new Map());
  const counts = await store.openCountsByScope(["@brika", "@acme"]);
  expect(counts.get("@brika")).toBe(1);
  expect(counts.get("@acme")).toBe(2);
});

test("openCountsByTarget aggregates open reports and ignores empty input", async () => {
  await fileReport("u1");
  await fileReport("u2");
  expect(await store.openCountsByTarget([])).toEqual(new Map());
  const counts = await store.openCountsByTarget(["@brika/x", "@brika/missing"]);
  expect(counts.get("@brika/x")).toBe(2);
  expect(counts.has("@brika/missing")).toBe(false);
});

test("setStatus resolves an open report, dropping it from the queue and counts", async () => {
  await fileReport();
  const [open] = (await store.list({ status: "open", limit: 20, offset: 0 })).items;
  const target = await store.setStatus(open?.id ?? "", "resolved");
  expect(target).toBe("@brika/x");

  // Gone from the open queue, but still visible under the resolved filter.
  expect((await store.list({ status: "open", limit: 20, offset: 0 })).total).toBe(0);
  expect((await store.list({ status: "resolved", limit: 20, offset: 0 })).total).toBe(1);
  expect((await store.openCountsByTarget(["@brika/x"])).has("@brika/x")).toBe(false);

  // Already handled: a second transition finds no open row.
  expect(await store.setStatus(open?.id ?? "", "dismissed")).toBeNull();
});

test("list filters by reason and free-text q; statusCounts reflects active filters", async () => {
  await db
    .insert(plugins)
    .values({ name: "@brika/spammy", scope: "@brika", latestVersion: "1.0.0", brikaEngine: "1" });
  await fileReport("u1", "@brika/x", "security");
  await fileReport("u2", "@brika/spammy", "spam");

  // reason filter
  const spam = await store.list({ status: "open", reason: "spam", limit: 20, offset: 0 });
  expect(spam.total).toBe(1);
  expect(spam.items[0]?.pluginName).toBe("@brika/spammy");

  // q matches the plugin name
  const byName = await store.list({ status: "open", q: "spammy", limit: 20, offset: 0 });
  expect(byName.total).toBe(1);

  // q matches the reporter (Bob = u2)
  const byReporter = await store.list({ status: "open", q: "bob", limit: 20, offset: 0 });
  expect(byReporter.total).toBe(1);
  expect(byReporter.items[0]?.reporter.id).toBe("u2");

  // counts honor the reason filter
  const counts = await store.statusCounts({ reason: "security" });
  expect(counts).toEqual({ open: 1, resolved: 0, dismissed: 0 });
});
