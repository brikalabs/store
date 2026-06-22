import { Database } from "bun:sqlite";
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { mintBetterAuthSession, SESSION_COOKIE_NAME } from "../../e2e/session";
import * as schema from "./db/schema";

/**
 * Headless proof that the forged session cookie from `mintBetterAuthSession` is
 * byte-identical to what BetterAuth's `getSession` expects (AUTH-012). This
 * removes the guesswork from the e2e/operator fixtures: if `getSession` resolves
 * the forged cookie to the seeded user, the e2e cookies authenticate for real.
 *
 * We build a BetterAuth instance with the SAME config shape as `buildAuth()` (the
 * Drizzle adapter over our schema, `secret` = SESSION_SECRET) but over an
 * in-memory SQLite built from the shipped migrations (mirroring social-data.test.ts).
 */

const MIGRATIONS_DIR = join(import.meta.dir, "../../drizzle");
const SECRET = "dev-only-secret-not-for-production";

function makeDb() {
  const sqlite = new Database(":memory:");
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(".sql"))
    .sort();
  for (const file of files) {
    for (const statement of readFileSync(join(MIGRATIONS_DIR, file), "utf8").split(
      "--> statement-breakpoint",
    )) {
      const trimmed = statement.trim();
      if (trimmed.length > 0) sqlite.run(trimmed);
    }
  }
  return { sqlite, db: drizzle(sqlite, { schema }) };
}

/** Mirror buildAuth()'s config shape over the in-memory db (no real GitHub creds needed). */
function makeAuth(db: ReturnType<typeof drizzle>) {
  return betterAuth({
    database: drizzleAdapter(db, { provider: "sqlite", schema }),
    secret: SECRET,
    baseURL: "http://localhost:3000",
    trustedOrigins: ["http://localhost:3000"],
    user: { modelName: "users" },
  });
}

describe("mintBetterAuthSession", () => {
  test("forges a cookie that BetterAuth's getSession resolves to the user", async () => {
    const { sqlite, db } = makeDb();
    const auth = makeAuth(db);

    const now = Math.floor(Date.now() / 1000);
    sqlite.run(
      "INSERT INTO users (id, name, email_verified, created_at, updated_at) VALUES (?, ?, 0, ?, ?)",
      ["u-test", "Octo Cat", now, now],
    );

    // Forge the session against the SAME in-memory db (the sqlite handle).
    const { name, value } = await mintBetterAuthSession(sqlite, {
      userId: "u-test",
      secret: SECRET,
    });
    expect(name).toBe(SESSION_COOKIE_NAME);

    const session = await auth.api.getSession({
      headers: new Headers({ cookie: `${name}=${value}` }),
    });

    expect(session).not.toBeNull();
    expect(session?.user.id).toBe("u-test");
  });

  test("a tampered cookie does NOT resolve (signature is verified)", async () => {
    const { sqlite, db } = makeDb();
    const auth = makeAuth(db);
    const now = Math.floor(Date.now() / 1000);
    sqlite.run(
      "INSERT INTO users (id, email_verified, created_at, updated_at) VALUES (?, 0, ?, ?)",
      ["u-test", now, now],
    );

    const { name, value } = await mintBetterAuthSession(sqlite, {
      userId: "u-test",
      secret: "the-wrong-secret",
    });
    const session = await auth.api.getSession({
      headers: new Headers({ cookie: `${name}=${value}` }),
    });
    expect(session).toBeNull();
  });
});
