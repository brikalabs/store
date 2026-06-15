import { Database } from "bun:sqlite";
import { beforeEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { drizzle } from "drizzle-orm/bun-sqlite";
import type { Db } from "../db/client";
import * as schema from "../db/schema";
import { comments, plugins, reviews, users } from "../db/schema";
import { listComments, listReviews, toggleCommentUpvote, toggleReviewHelpful } from "./social";

/**
 * Voting integration tests against a real in-memory SQLite, set up from the same
 * drizzle migrations the app ships. The store's `Db` is a D1 client; bun-sqlite
 * exposes the same query API, so the production code runs unchanged here.
 */

const MIGRATIONS_DIR = join(import.meta.dir, "../../drizzle");
const MIGRATIONS = ["0000_abandoned_bloodscream.sql", "0001_overrated_wild_child.sql"];

function makeDb(): Db {
  const sqlite = new Database(":memory:");
  for (const file of MIGRATIONS) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
    for (const statement of sql.split("--> statement-breakpoint")) {
      const trimmed = statement.trim();
      if (trimmed.length > 0) sqlite.run(trimmed);
    }
  }
  return drizzle(sqlite, { schema }) as unknown as Db;
}

const PLUGIN = "@brika/plugin-i18n";

async function seed(
  db: Db,
): Promise<{ author: string; voter: string; reviewId: string; commentId: string }> {
  await db.insert(plugins).values({ name: PLUGIN, latestVersion: "0.1.0", brikaEngine: "^0.1.0" });
  await db.insert(users).values([
    { id: "author", githubId: 1, login: "author" },
    { id: "voter", githubId: 2, login: "voter" },
  ]);
  const reviewId = "rev-1";
  await db
    .insert(reviews)
    .values({ id: reviewId, pluginName: PLUGIN, userId: "author", rating: 5, body: "Great" });
  const commentId = "com-1";
  await db
    .insert(comments)
    .values({ id: commentId, pluginName: PLUGIN, userId: "author", body: "Question?" });
  return { author: "author", voter: "voter", reviewId, commentId };
}

let db: Db;
beforeEach(() => {
  db = makeDb();
});

describe("toggleReviewHelpful", () => {
  test("adds, reflects in count + viewer state, then removes on a second call", async () => {
    const { voter, reviewId } = await seed(db);

    expect(await toggleReviewHelpful(db, reviewId, voter)).toBe(true);
    let list = await listReviews(db, PLUGIN, voter);
    expect(list[0]?.helpfulCount).toBe(1);
    expect(list[0]?.viewerVotedHelpful).toBe(true);

    // A different viewer sees the count but not their own vote.
    list = await listReviews(db, PLUGIN, "author");
    expect(list[0]?.helpfulCount).toBe(1);
    expect(list[0]?.viewerVotedHelpful).toBe(false);

    // Toggling off.
    expect(await toggleReviewHelpful(db, reviewId, voter)).toBe(true);
    list = await listReviews(db, PLUGIN, voter);
    expect(list[0]?.helpfulCount).toBe(0);
    expect(list[0]?.viewerVotedHelpful).toBe(false);
  });

  test("the author may not vote on their own review", async () => {
    const { author, reviewId } = await seed(db);
    expect(await toggleReviewHelpful(db, reviewId, author)).toBe(false);
    expect((await listReviews(db, PLUGIN))[0]?.helpfulCount).toBe(0);
  });

  test("returns false for an unknown review", async () => {
    await seed(db);
    expect(await toggleReviewHelpful(db, "missing", "voter")).toBe(false);
  });

  test("anonymous viewer never shows a vote", async () => {
    const { voter, reviewId } = await seed(db);
    await toggleReviewHelpful(db, reviewId, voter);
    expect((await listReviews(db, PLUGIN))[0]?.viewerVotedHelpful).toBe(false);
  });
});

describe("toggleCommentUpvote", () => {
  test("adds, reflects in upvotes + viewer state, then removes", async () => {
    const { voter, commentId } = await seed(db);

    expect(await toggleCommentUpvote(db, commentId, voter)).toBe(true);
    let list = await listComments(db, PLUGIN, voter);
    expect(list[0]?.upvotes).toBe(1);
    expect(list[0]?.viewerUpvoted).toBe(true);

    expect(await toggleCommentUpvote(db, commentId, voter)).toBe(true);
    list = await listComments(db, PLUGIN, voter);
    expect(list[0]?.upvotes).toBe(0);
    expect(list[0]?.viewerUpvoted).toBe(false);
  });

  test("the author may not upvote their own comment", async () => {
    const { author, commentId } = await seed(db);
    expect(await toggleCommentUpvote(db, commentId, author)).toBe(false);
  });

  test("returns false for an unknown comment", async () => {
    await seed(db);
    expect(await toggleCommentUpvote(db, "missing", "voter")).toBe(false);
  });
});
