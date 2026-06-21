/**
 * Shared seed helpers for the local registry. Both the developer seed
 * (`scripts/seed.ts`, `bun run seed`) and the e2e seed (`e2e/seed.ts`) build on
 * these: ensure a scope exists with an admin member, mint a publish token straight
 * into the shared local D1, and publish the example `@brika/*` plugins through the
 * real CLI so the storefront has registry-backed listings to show.
 *
 * Local only: the scope/token rows are written directly to the miniflare D1 sqlite,
 * so this seeds a dev machine, not a remote deployment. To populate a remote
 * registry, publish with the portable CLI (`brika publish`) using a real token.
 */
import { Database } from "bun:sqlite";
import { readdirSync } from "node:fs";
import { join } from "node:path";

export const REGISTRY_URL = process.env.BRIKA_REGISTRY ?? "http://localhost:8787";
export const REPO_ROOT = join(import.meta.dir, "../../..");

export function log(message: string): void {
  process.stderr.write(`[seed] ${message}\n`);
}

/** Block until the local registry answers, so the seed never races `wrangler dev`. */
export async function waitForRegistry(timeoutMs = 60_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${REGISTRY_URL}/`);
      if (res.ok) return;
    } catch {
      // not up yet
    }
    await Bun.sleep(1000);
  }
  throw new Error(`registry at ${REGISTRY_URL} did not become ready`);
}

/** The shared local D1 sqlite holding the registry tables (`reg_tokens` exists). */
export function findLocalD1(): string {
  const dir = join(REPO_ROOT, "apps/web/.wrangler/state/v3/d1/miniflare-D1DatabaseObject");
  const candidates = readdirSync(dir)
    .filter((name) => name.endsWith(".sqlite") && name !== "metadata.sqlite")
    .map((name) => join(dir, name));
  for (const file of candidates) {
    try {
      const db = new Database(file);
      const found = db
        .query("SELECT name FROM sqlite_master WHERE type='table' AND name='reg_tokens'")
        .get();
      db.close();
      if (found != null) return file;
    } catch {
      // Not a readable sqlite (or a stale db); try the next candidate.
    }
  }
  throw new Error(`no local D1 with the registry schema found under ${dir}`);
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function base64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64url");
}

export interface ScopeSeed {
  /** The npm scope, e.g. `@brika`. It is the ownership entity (npm/JSR model). */
  readonly scope: string;
  /** The scope's verified display name. */
  readonly displayName: string;
  /** The GitHub login made admin of the scope (and the publish token's owner). */
  readonly owner: string;
}

/**
 * Ensure a scope exists with `owner` as its admin member + a `users` row. The scope IS the
 * ownership entity (there is no org layer): publishing is gated on scope membership, so this
 * must exist before any publish to the scope. Idempotent via INSERT OR IGNORE / REPLACE, so
 * it is safe to re-run.
 */
export function ensureScope(seed: ScopeSeed): void {
  const db = new Database(findLocalD1());
  db.run("INSERT OR IGNORE INTO reg_scopes (scope, display_name) VALUES (?, ?)", [
    seed.scope,
    seed.displayName,
  ]);
  db.run(
    "INSERT OR IGNORE INTO reg_scope_members (scope, provider, member_id, role) VALUES (?, 'github', ?, 'admin')",
    [seed.scope, seed.owner],
  );
  const now = Math.floor(Date.now() / 1000);
  // A BetterAuth `users` row (USER-001): `login` is the GitHub username the scope
  // membership + session resolve against; `github_id` no longer exists (provider
  // ids live in the `account` table now).
  db.run(
    "INSERT OR REPLACE INTO users (id, login, name, image, email_verified, created_at, updated_at) VALUES (?, ?, ?, ?, 0, ?, ?)",
    [`u-${seed.owner}`, seed.owner, seed.owner, null, now, now],
  );
  db.close();
  log(`ensured scope ${seed.scope} (admin ${seed.owner})`);
}

const TOKEN_TTL_SECONDS = 60 * 60;

/** Insert a fresh publish token into reg_tokens for `owner` and return the raw token. */
export async function mintToken(owner: string, ttlSeconds = TOKEN_TTL_SECONDS): Promise<string> {
  const token = `brika_${base64Url(crypto.getRandomValues(new Uint8Array(32)))}`;
  const db = new Database(findLocalD1());
  const now = Math.floor(Date.now() / 1000);
  db.run(
    "INSERT OR REPLACE INTO reg_tokens (token_hash, github_login, created_at, expires_at) VALUES (?, ?, ?, ?)",
    [await sha256Hex(token), owner, now, now + ttlSeconds],
  );
  db.close();
  log(`minted token for ${owner}`);
  return token;
}

/** Run a `brika` subcommand against the local registry; returns code + output. */
export async function runCli(
  args: string[],
  token: string,
): Promise<{ code: number; output: string }> {
  const proc = Bun.spawn(["bun", join(REPO_ROOT, "apps/cli/src/index.ts"), ...args], {
    env: { ...process.env, BRIKA_REGISTRY: REGISTRY_URL, BRIKA_TOKEN: token },
    stderr: "pipe",
    stdout: "pipe",
  });
  const code = await proc.exited;
  const output = `${await new Response(proc.stdout).text()}${await new Response(proc.stderr).text()}`;
  return { code, output };
}

/** Publish one `examples/<plugin>` package; an already-published version is a no-op. */
export async function publish(plugin: string, token: string): Promise<void> {
  const dir = join(REPO_ROOT, "examples", plugin);
  const { code, output } = await runCli(["publish", dir], token);
  if (code === 0) {
    log(`published ${plugin}`);
  } else if (output.includes("already exists") || output.includes("exists")) {
    log(`${plugin} already published`);
  } else {
    throw new Error(`failed to publish ${plugin}:\n${output}`);
  }
}

/**
 * Seed a smooth ~30-day install history for a plugin so the sidebar download
 * chart shows a rising trend instead of the spike a same-day-only count makes.
 */
export function seedDownloadHistory(name: string): void {
  const db = new Database(findLocalD1());
  const today = Math.floor(Date.now() / 86_400_000);
  for (let i = 29; i >= 0; i--) {
    const day = today - i;
    // Gentle S-curve growth, 4 -> ~30/day.
    const count = Math.max(1, Math.round(4 + (26 * (29 - i)) / 29));
    db.run("INSERT OR REPLACE INTO reg_downloads (name, day, count) VALUES (?, ?, ?)", [
      name,
      day,
      count,
    ]);
  }
  db.close();
  log(`seeded 30-day download history on ${name}`);
}
