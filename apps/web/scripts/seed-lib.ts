/**
 * Shared seed helpers for the local registry. Both the developer seed
 * (`scripts/seed.ts`, `bun run seed`) and the e2e seed (`e2e/seed.ts`) build on
 * these: ensure an org owns a scope, mint a publish token straight into the
 * shared local D1, and publish the example `@brika/*` plugins through the real
 * CLI so the storefront has registry-backed listings to show.
 *
 * Local only: the org/token rows are written directly to the miniflare D1 sqlite,
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

export interface OrgSeed {
  /** The org slug, e.g. `brika`. */
  readonly slug: string;
  /** The org's verified display name. */
  readonly displayName: string;
  /** The npm scope it owns, e.g. `@brika`. */
  readonly scope: string;
  /** The GitHub login made admin of the org (and the publish token's owner). */
  readonly owner: string;
}

/**
 * Ensure an org owns a scope, with `owner` as its admin member + a `users` row.
 * Publishing never claims a scope implicitly (the ownership policy resolves scope
 * -> owning org -> membership), so this must exist before any publish to the scope.
 * Idempotent via INSERT OR IGNORE / REPLACE, so it is safe to re-run.
 */
export function ensureOrg(org: OrgSeed): void {
  const db = new Database(findLocalD1());
  db.run("INSERT OR IGNORE INTO reg_orgs (slug, display_name) VALUES (?, ?)", [
    org.slug,
    org.displayName,
  ]);
  db.run(
    "INSERT OR IGNORE INTO reg_org_members (org_slug, provider, member_id, role) VALUES (?, 'github', ?, 'admin')",
    [org.slug, org.owner],
  );
  db.run("INSERT OR IGNORE INTO reg_scopes (scope, org_id) VALUES (?, ?)", [org.scope, org.slug]);
  const now = Math.floor(Date.now() / 1000);
  db.run(
    "INSERT OR REPLACE INTO users (id, github_id, login, name, created_at) VALUES (?, ?, ?, ?, ?)",
    [`u-${org.owner}`, 990_002, org.owner, org.owner, now],
  );
  db.close();
  log(`ensured org ${org.slug} (admin ${org.owner}) owning ${org.scope}`);
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
