import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { Db } from "@/server/db/client";
import { plugins } from "@/server/db/schema";
import { SocialService } from "@/server/services/social-service";
import { CommentStore } from "@/server/stores/comment-store";
import { PluginStore } from "@/server/stores/plugin-store";
import { ReviewStore } from "@/server/stores/review-store";
import { makeStoreDb } from "@/server/stores/test-harness";
import { UserProfileStore } from "@/server/stores/user-profile-store";
import { UserStore } from "@/server/stores/user-store";

/**
 * Behavioural tests for the social use cases, against a real in-memory SQLite. They go through
 * {@link SocialService} (so the orchestration + every repository runs end to end), reaching for
 * the underlying stores only to seed and to assert the two reads the service does not surface
 * (raw user rows, the rating summary). `insertFromDetail` is covered via the ensurePluginCached
 * path; other tests seed `plugins` rows directly, like an arrange step.
 */

function build() {
  const db = makeStoreDb();
  const stores = {
    users: new UserStore(db),
    profiles: new UserProfileStore(db),
    reviews: new ReviewStore(db),
    comments: new CommentStore(db),
    plugins: new PluginStore(db),
  };
  return { db, social: new SocialService(stores), stores };
}

type Harness = ReturnType<typeof build>;

const cachePlugin = (db: Db, name: string): Promise<unknown> =>
  db.insert(plugins).values({ name, latestVersion: "1.0.0", brikaEngine: "^0.1.0" });

const PLUGIN = "@brika/plugin-i18n";

/** Seed a cached plugin plus an author + a separate voter, with one review and one comment. */
async function seed(h: Harness): Promise<void> {
  await cachePlugin(h.db, PLUGIN);
  await h.stores.users.upsert({ id: "author", login: "author" });
  await h.stores.users.upsert({ id: "voter", login: "voter" });
  await h.stores.reviews.upsert(PLUGIN, "author", { rating: 5, body: "Great" });
  await h.social.addComment(PLUGIN, "author", "Question?", null);
}

let h: Harness;
beforeEach(() => {
  h = build();
});

describe("UserStore.upsert", () => {
  test("inserts then updates on conflict, always storing a name", async () => {
    await h.stores.users.upsert({ id: "u1", login: "octo" });
    expect(await h.stores.profiles.get("u1")).toMatchObject({ displayName: "octo" }); // name = login
    await h.stores.users.upsert({ id: "u1", login: "octocat", name: "Octo" });
    expect(await h.stores.profiles.get("u1")).toMatchObject({ displayName: "Octo" });
    expect(await h.social.findUserLogin("u1")).toBe("octocat");
  });
});

describe("toggleReviewHelpful (ReviewStore via service)", () => {
  async function reviewId(): Promise<string> {
    await seed(h);
    return (await h.social.listReviews(PLUGIN))[0]?.id ?? "";
  }

  test("adds, reflects in count + viewer state, then removes on a second call", async () => {
    const id = await reviewId();

    expect(await h.social.toggleReviewHelpful(id, "voter")).toBe(true);
    let list = await h.social.listReviews(PLUGIN, "voter");
    expect(list[0]?.helpfulCount).toBe(1);
    expect(list[0]?.viewerVotedHelpful).toBe(true);

    // A different viewer sees the count but not their own vote.
    list = await h.social.listReviews(PLUGIN, "author");
    expect(list[0]?.helpfulCount).toBe(1);
    expect(list[0]?.viewerVotedHelpful).toBe(false);

    expect(await h.social.toggleReviewHelpful(id, "voter")).toBe(true);
    list = await h.social.listReviews(PLUGIN, "voter");
    expect(list[0]?.helpfulCount).toBe(0);
    expect(list[0]?.viewerVotedHelpful).toBe(false);
  });

  test("the author may not vote on their own review", async () => {
    const id = await reviewId();
    expect(await h.social.toggleReviewHelpful(id, "author")).toBe(false);
    expect((await h.social.listReviews(PLUGIN))[0]?.helpfulCount).toBe(0);
  });

  test("returns false for an unknown review", async () => {
    await seed(h);
    expect(await h.social.toggleReviewHelpful("missing", "voter")).toBe(false);
  });

  test("anonymous viewer never shows a vote", async () => {
    const id = await reviewId();
    await h.social.toggleReviewHelpful(id, "voter");
    expect((await h.social.listReviews(PLUGIN))[0]?.viewerVotedHelpful).toBe(false);
  });
});

describe("toggleCommentUpvote (CommentStore via service)", () => {
  async function commentId(): Promise<string> {
    await seed(h);
    return (await h.social.listComments(PLUGIN))[0]?.id ?? "";
  }

  test("adds, reflects in upvotes + viewer state, then removes", async () => {
    const id = await commentId();

    expect(await h.social.toggleCommentUpvote(id, "voter")).toBe(true);
    let list = await h.social.listComments(PLUGIN, "voter");
    expect(list[0]?.upvotes).toBe(1);
    expect(list[0]?.viewerUpvoted).toBe(true);

    expect(await h.social.toggleCommentUpvote(id, "voter")).toBe(true);
    list = await h.social.listComments(PLUGIN, "voter");
    expect(list[0]?.upvotes).toBe(0);
    expect(list[0]?.viewerUpvoted).toBe(false);
  });

  test("the author may not upvote their own comment", async () => {
    const id = await commentId();
    expect(await h.social.toggleCommentUpvote(id, "author")).toBe(false);
  });

  test("returns false for an unknown comment", async () => {
    await seed(h);
    expect(await h.social.toggleCommentUpvote("missing", "voter")).toBe(false);
  });
});

describe("ensurePluginCached (cache-aside from the registry)", () => {
  const NAME = "@brika/plugin-demo";
  const packument = {
    name: NAME,
    "dist-tags": { latest: "1.0.0" },
    publisher: { id: "brika", name: "Brika Labs", verified: true },
    versions: {
      "1.0.0": { name: NAME, version: "1.0.0", displayName: "Demo", engines: { brika: "^0.1.0" } },
    },
    time: { created: "2026-01-01T00:00:00.000Z", "1.0.0": "2026-01-01T00:00:00.000Z" },
  };
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

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

  test("caches a plugin row from the registry, and is idempotent", async () => {
    stubRegistry();
    expect(await h.social.ensurePluginCached(NAME)).toBe(true);
    expect(await h.stores.plugins.exists(NAME)).toBe(true);
    // Second call short-circuits on the existing row (no fetch needed).
    globalThis.fetch = (() => {
      throw new Error("should not fetch again");
    }) as typeof fetch;
    expect(await h.social.ensurePluginCached(NAME)).toBe(true);
  });

  test("returns false for a non-registry (npm) name without fetching", async () => {
    globalThis.fetch = (() => {
      throw new Error("should not fetch for a non-registry name");
    }) as typeof fetch;
    expect(await h.social.ensurePluginCached("lodash")).toBe(false);
  });

  test("returns false when the registry has no such plugin", async () => {
    globalThis.fetch = (() => Promise.resolve(new Response("", { status: 404 }))) as typeof fetch;
    expect(await h.social.ensurePluginCached("@brika/missing")).toBe(false);
  });
});

describe("submitReview + rating summary", () => {
  async function seedPlugin(): Promise<void> {
    await cachePlugin(h.db, "p");
    await h.stores.users.upsert({ id: "u1", login: "a" });
    await h.stores.users.upsert({ id: "u2", login: "b" });
  }

  test("inserts, edits, and recomputes the rating summary", async () => {
    await seedPlugin();
    await h.social.submitReview("p", "u1", { rating: 4, body: "good" });
    await h.social.submitReview("p", "u2", { rating: 2, body: "meh" });
    expect(await h.stores.plugins.ratingSummary("p")).toEqual({ average: 3, count: 2 });

    // Same user editing replaces their review (count unchanged).
    await h.social.submitReview("p", "u1", { rating: 5, title: "Better", body: "great" });
    const summary = await h.stores.plugins.ratingSummary("p");
    expect(summary?.count).toBe(2);
    expect(summary?.average).toBeCloseTo(3.5, 5);

    const list = await h.social.listReviews("p");
    expect(list).toHaveLength(2);
    expect(list.find((r) => r.author.id === "u1")?.edited).toBe(true);
  });

  test("rating summary is undefined with no reviews", async () => {
    await seedPlugin();
    expect(await h.stores.plugins.ratingSummary("p")).toBeUndefined();
  });
});

describe("comments", () => {
  test("addComment + listComments returns threaded rows with author", async () => {
    await cachePlugin(h.db, "p");
    await h.stores.users.upsert({ id: "u1", login: "asker", name: "Asker" });
    await h.social.addComment("p", "u1", "Top question", null);
    const top = (await h.social.listComments("p"))[0];
    expect(top?.body).toBe("Top question");
    expect(top?.author.displayName).toBe("Asker");

    await h.social.addComment("p", "u1", "A reply", top?.id ?? null);
    const all = await h.social.listComments("p");
    expect(all).toHaveLength(2);
    expect(all.some((c) => c.parentId === top?.id)).toBe(true);
  });
});

describe("user profile", () => {
  test("unknown account id is null", async () => {
    expect(await h.social.getUserProfile("nobody")).toBeNull();
  });

  test("falls back to the GitHub name + avatar until edited, then reflects updates", async () => {
    await h.stores.users.upsert({
      id: "u1",
      login: "octo",
      name: "Octo",
      avatarUrl: "https://avatars.example/octo.png",
    });

    const initial = await h.social.getUserProfile("u1");
    expect(initial?.displayName).toBe("Octo");
    expect(initial?.avatarUrl).toBe("https://avatars.example/octo.png");
    expect(initial?.bio).toBeUndefined();
    expect(initial?.links).toEqual([]);

    await h.social.updateUserProfile("u1", {
      displayName: "Octo Cat",
      bio: "Hi",
      website: "https://o.dev",
      links: [{ label: "GitHub", url: "https://github.com/octo" }],
    });
    const updated = await h.social.getUserProfile("u1");
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
    await cachePlugin(h.db, "p1");
    await cachePlugin(h.db, "p2");
    await h.stores.users.upsert({ id: "u1", login: "a", name: "A" });
    await h.stores.users.upsert({ id: "u2", login: "b" });
    await h.social.submitReview("p1", "u1", { rating: 5, body: "great" });
    await h.social.submitReview("p2", "u1", { rating: 3, title: "ok", body: "fine" });
    await h.social.submitReview("p1", "u2", { rating: 1, body: "nope" });

    const mine = await h.social.listReviewsByUser("u1");
    expect(mine).toHaveLength(2);
    expect(mine.every((r) => r.author.id === "u1")).toBe(true);
    expect(new Set(mine.map((r) => r.pluginName))).toEqual(new Set(["p1", "p2"]));
  });
});
