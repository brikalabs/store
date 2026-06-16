/**
 * E2E seed (run with bun). Ensures the example `@brika/*` plugins are published
 * to the local registry so the storefront has registry-backed listings to show.
 *
 * Mints a publish token straight into the shared local D1 (the same row shape
 * `issueToken` writes), then runs `brika publish` for each example. Already-
 * published versions return 409 and are treated as success, so the seed is
 * idempotent and safe to run before every Playwright run.
 */
import { Database } from "bun:sqlite";
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";

const REGISTRY_URL = process.env.BRIKA_REGISTRY ?? "http://localhost:8787";
const REPO_ROOT = join(import.meta.dir, "../../..");
const EXAMPLES = ["plugin-i18n", "plugin-snapshot", "plugin-clock"];
const TOKEN_TTL_SECONDS = 60 * 60;

function log(message: string): void {
  process.stderr.write(`[e2e seed] ${message}\n`);
}

async function waitForRegistry(timeoutMs = 60_000): Promise<void> {
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
function findLocalD1(): string {
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

/**
 * Insert a fresh publish token into reg_tokens and return the raw token. The
 * token's login must own the `@brika` scope to publish, so reuse whoever already
 * claimed it; on a pristine registry no one has, and the first publish claims it.
 */
async function mintToken(): Promise<string> {
  const token = `brika_${base64Url(crypto.getRandomValues(new Uint8Array(32)))}`;
  const db = new Database(findLocalD1());
  const owner = db
    .query("SELECT github_owner AS owner FROM reg_scopes WHERE scope = '@brika'")
    .get() as { owner: string } | null;
  const login = owner?.owner ?? "e2e-bot";
  const now = Math.floor(Date.now() / 1000);
  db.run(
    "INSERT OR REPLACE INTO reg_tokens (token_hash, github_login, created_at, expires_at) VALUES (?, ?, ?, ?)",
    [await sha256Hex(token), login, now, now + TOKEN_TTL_SECONDS],
  );
  db.close();
  log(`minted token for ${login}`);
  return token;
}

async function publish(plugin: string, token: string): Promise<void> {
  const dir = join(REPO_ROOT, "examples", plugin);
  const proc = Bun.spawn(["bun", join(REPO_ROOT, "apps/cli/src/index.ts"), "publish", dir], {
    env: { ...process.env, BRIKA_REGISTRY: REGISTRY_URL, BRIKA_TOKEN: token },
    stderr: "pipe",
    stdout: "pipe",
  });
  const code = await proc.exited;
  const output = `${await new Response(proc.stdout).text()}${await new Response(proc.stderr).text()}`;
  if (code === 0) {
    log(`published ${plugin}`);
  } else if (output.includes("already exists") || output.includes("exists")) {
    log(`${plugin} already published`);
  } else {
    throw new Error(`failed to publish ${plugin}:\n${output}`);
  }
}

/**
 * Attach simulated CI provenance to one published version, so the e2e covers the
 * Integrity & provenance section. A real OIDC publish sets this from the verified
 * token; the local seed has only a token, so it writes the row directly.
 */
function seedProvenance(): void {
  const db = new Database(findLocalD1());
  const provenance = JSON.stringify({
    repository: "brikalabs/store",
    sha: "0c59e6f7a1b2c3d4",
    ref: "refs/heads/main",
    workflowRef: "brikalabs/store/.github/workflows/publish.yml@refs/heads/main",
    runId: "16899001",
    transparencyLog: {
      provider: "sigstore",
      logUrl: "https://search.sigstore.dev/?logIndex=148293001",
      logIndex: "148293001",
      integrity:
        "sha512-1tEMdJEPukZTJS6f20hU3Vo54eqDBmvcNvDJlGpRjZdD/cQef1pO7chuh89oevsMTCG2g+MVCfBebHU1Mt4BWA==",
    },
  });
  db.run("UPDATE reg_versions SET provenance = ? WHERE name = ? AND version = ?", [
    provenance,
    "@brika/plugin-i18n",
    "0.1.0",
  ]);
  db.close();
  log("seeded CI provenance on @brika/plugin-i18n@0.1.0");
}

/**
 * Ensure @brika/plugin-i18n@0.1.0's stored manifest carries the dependencies
 * declared in its fixture, so the Dependencies table is populated. A fresh
 * publish already includes them; this covers the already-published case (publish
 * is a 409 no-op) by merging them into the stored manifest JSON.
 */
function seedDependencies(): void {
  const db = new Database(findLocalD1());
  const row = db
    .query("SELECT manifest FROM reg_versions WHERE name = ? AND version = ?")
    .get("@brika/plugin-i18n", "0.1.0") as { manifest: string } | null;
  if (row !== null) {
    const manifest = JSON.parse(row.manifest);
    manifest.dependencies = {
      "@brika/sdk": "^0.1.0",
      "@formatjs/intl": "^2.10.0",
      "bcp-47": "^2.1.0",
    };
    // Resolved versions (from the lockfile at publish time) and the digest, so
    // the Dependencies table + integrity Digest match the design.
    manifest.resolvedDependencies = {
      "@brika/sdk": "0.1.4",
      "@formatjs/intl": "2.10.5",
      "bcp-47": "2.1.0",
    };
    manifest.devDependencies = { typescript: "^6.0.3", "@types/bun": "^1.3.5" };
    manifest.unpackedSize = 10752;
    manifest.fileCount = 11;
    db.run("UPDATE reg_versions SET manifest = ? WHERE name = ? AND version = ?", [
      JSON.stringify(manifest),
      "@brika/plugin-i18n",
      "0.1.0",
    ]);
    log("seeded dependencies + digest on @brika/plugin-i18n@0.1.0");
  }
  db.close();
}

/**
 * Seed a smooth ~30-day install history so the sidebar download chart shows a
 * rising trend like the design, instead of the spike a same-day-only count makes.
 */
function seedDownloadHistory(): void {
  const db = new Database(findLocalD1());
  const today = Math.floor(Date.now() / 86_400_000);
  for (let i = 29; i >= 0; i--) {
    const day = today - i;
    // Gentle S-curve growth, 4 -> ~30/day.
    const count = Math.max(1, Math.round(4 + (26 * (29 - i)) / 29));
    db.run("INSERT OR REPLACE INTO reg_downloads (name, day, count) VALUES (?, ?, ?)", [
      "@brika/plugin-i18n",
      day,
      count,
    ]);
  }
  db.close();
  log("seeded 30-day download history on @brika/plugin-i18n");
}

await waitForRegistry();
const token = await mintToken();
for (const plugin of EXAMPLES) await publish(plugin, token);
seedProvenance();
seedDependencies();
seedDownloadHistory();
log(`done (dir: ${dirname(findLocalD1())})`);
