import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/bun-sqlite";
import {
  addComment,
  ensurePluginCached,
  getRatingSummary,
  getUserProfile,
  listComments,
  listReviews,
  listReviewsByUser,
  updateUserProfile,
  upsertReview,
  upsertUser,
} from "@/lib/social/social";
import type { Db } from "@/server/db/client";
import * as schema from "@/server/db/schema";
import { plugins, users } from "@/server/db/schema";

/** In-memory SQLite from the shipped migrations (see social.test.ts). */
const MIGRATIONS_DIR = join(import.meta.dir, "../../../drizzle");
const MIGRATIONS = ["0000_parched_sauron.sql", "0001_betterauth.sql", "0002_user_profiles.sql"];

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
    await upsertUser(db, { id: "u1", login: "octo" });
    await upsertUser(db, { id: "u1", login: "octocat", name: "Octo" });
    const rows = await db.select().from(users).where(eq(users.id, "u1"));
    expect(rows[0]?.login).toBe("octocat");
    expect(rows[0]?.name).toBe("Octo");
  });
});

describe("ensurePluginCached", () => {
  const NAME = "@brika/plugin-demo";
  // The registry packument; the version manifest carries the Brika engine + display name,
  // and the publisher (the scope) becomes the cached plugin's author/developer.
  const packument = {
    name: NAME,
    "dist-tags": { latest: "1.0.0" },
    publisher: { id: "brika", name: "Brika Labs", verified: true },
    versions: {
      "1.0.0": { name: NAME, version: "1.0.0", displayName: "Demo", engines: { brika: "^0.1.0" } },
    },
    time: { created: "2026-01-01T00:00:00.000Z", "1.0.0": "2026-01-01T00:00:00.000Z" },
  };

  /** Registry packument for the `@brika` plugin; downloads + tarball 404 (zeros / no files). */
  function stubRegistry() {
    globalThis.fetch = ((input: string | URL | Request) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.endsWith(".tgz") || url.includes("/-/v1/downloads")) {
        return Promise.resolve(new Response("", { status: 404 }));
      }
      return Promise.resolve(
        new Response(JSON.stringify(packument), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
    }) as typeof fetch;
  }

  test("caches a plugin row + developer from the registry, and is idempotent", async () => {
    stubRegistry();
    expect(await ensurePluginCached(db, NAME)).toBe(true);
    const rows = await db.select().from(plugins).where(eq(plugins.name, NAME));
    expect(rows[0]?.displayName).toBe("Demo");
    // Second call short-circuits on the existing row (no fetch needed).
    globalThis.fetch = (() => {
      throw new Error("should not fetch again");
    }) as typeof fetch;
    expect(await ensurePluginCached(db, NAME)).toBe(true);
  });

  test("returns false for a non-registry (npm) name without fetching", async () => {
    globalThis.fetch = (() => {
      throw new Error("should not fetch for a non-registry name");
    }) as typeof fetch;
    expect(await ensurePluginCached(db, "lodash")).toBe(false);
  });

  test("returns false when the registry has no such plugin", async () => {
    globalThis.fetch = (() => Promise.resolve(new Response("", { status: 404 }))) as typeof fetch;
    expect(await ensurePluginCached(db, "@brika/missing")).toBe(false);
  });
});

describe("reviews + ratings", () => {
  async function seedPlugin() {
    await db.insert(plugins).values({ name: "p", latestVersion: "1.0.0", brikaEngine: "^0.1.0" });
    await upsertUser(db, { id: "u1", login: "a" });
    await upsertUser(db, { id: "u2", login: "b" });
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
    await upsertUser(db, { id: "u1", login: "asker", name: "Asker" });
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

describe("user profile", () => {
  test("unknown account id is null", async () => {
    expect(await getUserProfile(db, "nobody")).toBeNull();
  });

  test("falls back to the GitHub name + avatar until edited, then reflects updates", async () => {
    await upsertUser(db, {
      id: "u1",
      login: "octo",
      name: "Octo",
      avatarUrl: "https://avatars.example/octo.png",
    });

    // Unset profile: display name falls back to the user's GitHub name, avatar to
    // the GitHub image, bio/website absent (never back-filled from npm).
    const initial = await getUserProfile(db, "u1");
    expect(initial?.displayName).toBe("Octo");
    expect(initial?.avatarUrl).toBe("https://avatars.example/octo.png");
    expect(initial?.bio).toBeUndefined();
    expect(initial?.links).toEqual([]);

    await updateUserProfile(db, "u1", {
      displayName: "Octo Cat",
      bio: "Hi",
      website: "https://o.dev",
      links: [{ label: "GitHub", url: "https://github.com/octo" }],
    });
    const updated = await getUserProfile(db, "u1");
    expect(updated?.displayName).toBe("Octo Cat");
    expect(updated?.bio).toBe("Hi");
    expect(updated?.website).toBe("https://o.dev");
    expect(updated?.links).toEqual([{ label: "GitHub", url: "https://github.com/octo" }]);
    // The avatar still comes from the GitHub image, not the profile row.
    expect(updated?.avatarUrl).toBe("https://avatars.example/octo.png");
  });
});

describe("listReviewsByUser", () => {
  test("returns the account's reviews, newest first, with the plugin name", async () => {
    await db.insert(plugins).values({ name: "p1", latestVersion: "1.0.0", brikaEngine: "^0.1.0" });
    await db.insert(plugins).values({ name: "p2", latestVersion: "1.0.0", brikaEngine: "^0.1.0" });
    await upsertUser(db, { id: "u1", login: "a", name: "A" });
    await upsertUser(db, { id: "u2", login: "b" });
    await upsertReview(db, "p1", "u1", { rating: 5, body: "great" });
    await upsertReview(db, "p2", "u1", { rating: 3, title: "ok", body: "fine" });
    await upsertReview(db, "p1", "u2", { rating: 1, body: "nope" });

    const mine = await listReviewsByUser(db, "u1");
    expect(mine).toHaveLength(2);
    expect(mine.every((r) => r.author.id === "u1")).toBe(true);
    expect(new Set(mine.map((r) => r.pluginName))).toEqual(new Set(["p1", "p2"]));
  });
});
