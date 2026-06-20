import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/bun-sqlite";
import {
  addComment,
  ensurePluginCached,
  getDeveloperProfile,
  getRatingSummary,
  listComments,
  listReviews,
  markDeveloperVerified,
  updateDeveloperProfile,
  upsertReview,
  upsertUser,
} from "@/lib/social/social";
import type { Db } from "@/server/db/client";
import * as schema from "@/server/db/schema";
import { developers, plugins, users } from "@/server/db/schema";

/** In-memory SQLite from the shipped migrations (see social.test.ts). */
const MIGRATIONS_DIR = join(import.meta.dir, "../../drizzle");
const MIGRATIONS = ["0000_abandoned_bloodscream.sql", "0001_overrated_wild_child.sql"];

function makeDb(): Db {
  const sqlite = new Database(":memory:");
  for (const file of MIGRATIONS) {
    for (const statement of readFileSync(join(MIGRATIONS_DIR, file), "utf8").split(
      "--> statement-breakpoint",
    )) {
      const trimmed = statement.trim();
      if (trimmed.length > 0) sqlite.run(trimmed);
    }
  }
  return drizzle(sqlite, { schema }) as unknown as Db;
}

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

let db: Db;
beforeEach(() => {
  db = makeDb();
});

describe("upsertUser", () => {
  test("inserts then updates on conflict", async () => {
    await upsertUser(db, { id: "u1", githubId: 1, login: "octo" });
    await upsertUser(db, { id: "u1", githubId: 1, login: "octocat", name: "Octo" });
    const rows = await db.select().from(users).where(eq(users.id, "u1"));
    expect(rows[0]?.login).toBe("octocat");
    expect(rows[0]?.name).toBe("Octo");
  });
});

describe("markDeveloperVerified", () => {
  test("sets verified + githubLogin on an existing developer", async () => {
    await db.insert(developers).values({ id: "octo" });
    await markDeveloperVerified(db, "octo");
    const rows = await db.select().from(developers).where(eq(developers.id, "octo"));
    expect(rows[0]?.verified).toBe(true);
    expect(rows[0]?.githubLogin).toBe("octo");
  });
});

describe("ensurePluginCached", () => {
  function stubPackument(body: unknown, status = 200) {
    globalThis.fetch = (() =>
      Promise.resolve(
        new Response(JSON.stringify(body), {
          status,
          headers: { "content-type": "application/json" },
        }),
      )) as typeof fetch;
  }

  test("caches a plugin row + developer from npm, and is idempotent", async () => {
    stubPackument({
      name: "brika-plugin-demo",
      "dist-tags": { latest: "1.0.0" },
      maintainers: [{ name: "octo" }],
      versions: {
        "1.0.0": {
          version: "1.0.0",
          displayName: "Demo",
          engines: { brika: "^0.1.0" },
          author: "Octo",
        },
      },
      time: { created: "2026-01-01T00:00:00.000Z", "1.0.0": "2026-01-01T00:00:00.000Z" },
    });
    expect(await ensurePluginCached(db, "brika-plugin-demo")).toBe(true);
    const rows = await db.select().from(plugins).where(eq(plugins.name, "brika-plugin-demo"));
    expect(rows[0]?.displayName).toBe("Demo");
    // Second call short-circuits on the existing row (no fetch needed).
    globalThis.fetch = (() => {
      throw new Error("should not fetch again");
    }) as typeof fetch;
    expect(await ensurePluginCached(db, "brika-plugin-demo")).toBe(true);
  });

  test("returns false when the package is not a Brika plugin", async () => {
    stubPackument({ error: "Not found" }, 404);
    expect(await ensurePluginCached(db, "not-a-plugin")).toBe(false);
  });
});

describe("reviews + ratings", () => {
  async function seedPlugin() {
    await db.insert(plugins).values({ name: "p", latestVersion: "1.0.0", brikaEngine: "^0.1.0" });
    await upsertUser(db, { id: "u1", githubId: 1, login: "a" });
    await upsertUser(db, { id: "u2", githubId: 2, login: "b" });
  }

  test("upsertReview inserts, edits, and recomputes the rating summary", async () => {
    await seedPlugin();
    await upsertReview(db, "p", "u1", { rating: 4, body: "good" });
    await upsertReview(db, "p", "u2", { rating: 2, body: "meh" });
    let summary = await getRatingSummary(db, "p");
    expect(summary).toEqual({ average: 3, count: 2 });

    // Same user editing replaces their review (count unchanged).
    await upsertReview(db, "p", "u1", { rating: 5, title: "Better", body: "great" });
    summary = await getRatingSummary(db, "p");
    expect(summary?.count).toBe(2);
    expect(summary?.average).toBeCloseTo(3.5, 5);

    const list = await listReviews(db, "p");
    expect(list).toHaveLength(2);
    expect(list.find((r) => r.author.id === "u1")?.edited).toBe(true);
  });

  test("getRatingSummary is undefined with no reviews", async () => {
    await seedPlugin();
    expect(await getRatingSummary(db, "p")).toBeUndefined();
  });
});

describe("comments", () => {
  test("addComment + listComments returns threaded rows with author", async () => {
    await db.insert(plugins).values({ name: "p", latestVersion: "1.0.0", brikaEngine: "^0.1.0" });
    await upsertUser(db, { id: "u1", githubId: 1, login: "asker", name: "Asker" });
    await addComment(db, "p", "u1", "Top question", null);
    const top = (await listComments(db, "p"))[0];
    expect(top?.body).toBe("Top question");
    expect(top?.author.name).toBe("Asker");

    await addComment(db, "p", "u1", "A reply", top?.id ?? null);
    const all = await listComments(db, "p");
    expect(all).toHaveLength(2);
    expect(all.some((c) => c.parentId === top?.id)).toBe(true);
  });
});

describe("developer profile", () => {
  test("defaults to the id, then reflects updates", async () => {
    const initial = await getDeveloperProfile(db, "octo");
    expect(initial.displayName).toBe("octo");

    await updateDeveloperProfile(db, "octo", {
      displayName: "Octo Cat",
      bio: "Hi",
      website: "https://o.dev",
    });
    const updated = await getDeveloperProfile(db, "octo");
    expect(updated.displayName).toBe("Octo Cat");
    expect(updated.bio).toBe("Hi");
    expect(updated.website).toBe("https://o.dev");
  });
});
