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
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

const REGISTRY_URL = process.env.BRIKA_REGISTRY ?? "http://localhost:8787";
const REPO_ROOT = join(import.meta.dir, "../../..");
const EXAMPLES = ["plugin-i18n", "plugin-snapshot", "plugin-clock", "plugin-icon"];
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

/** Run a `brika` subcommand against the local registry; returns code + output. */
async function runCli(args: string[], token: string): Promise<{ code: number; output: string }> {
  const proc = Bun.spawn(["bun", join(REPO_ROOT, "apps/cli/src/index.ts"), ...args], {
    env: { ...process.env, BRIKA_REGISTRY: REGISTRY_URL, BRIKA_TOKEN: token },
    stderr: "pipe",
    stdout: "pipe",
  });
  const code = await proc.exited;
  const output = `${await new Response(proc.stdout).text()}${await new Response(proc.stderr).text()}`;
  return { code, output };
}

async function publish(plugin: string, token: string): Promise<void> {
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
    // Drop any resolved versions a prior seed left behind (no longer surfaced).
    manifest.resolvedDependencies = undefined;
    // The store only has package.json, so it shows declared ranges (not resolved
    // versions). Dev deps populate the Dev dependencies group; unpacked size and
    // file count are recomputed from the real tarball when the detail loads.
    manifest.devDependencies = {
      typescript: "^6.0.3",
      "@types/bun": "^1.3.5",
      "@biomejs/biome": "^2.3.0",
    };
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

/**
 * Ensure each example's stored manifest carries the permission grants declared
 * in its fixture, so the family-grouped Permissions section is populated. A
 * fresh publish already includes them; this covers the already-published case
 * (publish is a 409 no-op) by merging the fixture grants into the stored JSON.
 */
function seedGrants(): void {
  const db = new Database(findLocalD1());
  const targets = [
    { dir: "plugin-i18n", name: "@brika/plugin-i18n", version: "0.1.0" },
    { dir: "plugin-snapshot", name: "@brika/plugin-snapshot", version: "0.2.0" },
  ];
  for (const { dir, name, version } of targets) {
    const pkg = JSON.parse(readFileSync(join(REPO_ROOT, "examples", dir, "package.json"), "utf8"));
    if (pkg.grants === undefined) continue;
    const row = db
      .query("SELECT manifest FROM reg_versions WHERE name = ? AND version = ?")
      .get(name, version) as { manifest: string } | null;
    if (row === null) continue;
    const manifest = JSON.parse(row.manifest);
    manifest.grants = pkg.grants;
    db.run("UPDATE reg_versions SET manifest = ? WHERE name = ? AND version = ?", [
      JSON.stringify(manifest),
      name,
      version,
    ]);
    log(`seeded grants on ${name}@${version}`);
  }
  db.close();
}

/**
 * Exercise the plugin-management lifecycle through the real CLI against the
 * live registry: publish a throwaway package at three versions, deprecate the
 * middle one, and yank the oldest. The storefront then shows the deprecation
 * badge and hides the yanked version, so the e2e covers manage end to end.
 * All steps are idempotent (re-publish is a 409 no-op; deprecate/yank are too).
 */
async function seedManagement(token: string): Promise<void> {
  const name = "@brika/plugin-managed";
  const dir = join(tmpdir(), "brika-managed-fixture");
  mkdirSync(join(dir, "src"), { recursive: true });
  mkdirSync(join(dir, "assets"), { recursive: true });
  writeFileSync(join(dir, "src", "index.ts"), `export default { name: "${name}" };\n`);
  writeFileSync(join(dir, "README.md"), "# Managed Demo\n\nExercises deprecate and yank.\n");
  writeFileSync(
    join(dir, "assets", "icon.svg"),
    '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect width="512" height="512" rx="96" fill="#64748B"/></svg>\n',
  );
  const base = {
    $schema: "https://store.brika.dev/schema/plugin.json",
    name,
    displayName: "Managed Demo",
    description: "A throwaway plugin used to exercise deprecate and yank.",
    license: "MIT",
    type: "module",
    main: "./src/index.ts",
    icon: "./assets/icon.svg",
    engines: { brika: "^0.1.0" },
    files: ["src", "assets", "README.md"],
    readme: { en: "./README.md" },
    tools: [{ id: "noop", description: "Does nothing" }],
  };
  for (const version of ["1.0.0", "1.1.0", "1.2.0"]) {
    writeFileSync(join(dir, "package.json"), JSON.stringify({ ...base, version }, null, 2));
    const { code, output } = await runCli(["publish", dir], token);
    if (code !== 0 && !output.includes("exists")) {
      throw new Error(`failed to publish ${name}@${version}:\n${output}`);
    }
  }
  rmSync(dir, { recursive: true, force: true });
  const deprecate = await runCli(["deprecate", name, "1.1.0", "Superseded by 1.2.0"], token);
  if (deprecate.code !== 0) throw new Error(`deprecate failed:\n${deprecate.output}`);
  const yank = await runCli(["yank", name, "1.0.0"], token);
  if (yank.code !== 0) throw new Error(`yank failed:\n${yank.output}`);
  log(`managed ${name}: published 3 versions, deprecated 1.1.0, yanked 1.0.0`);
}

/**
 * Seed the social tables (users, reviews, comments) for @brika/plugin-i18n so
 * the Reviews and Discussion tabs render a real grade + threads. These live in
 * the same local D1 as the registry tables. A cache row in `plugins` is written
 * first so reviews/comments satisfy their foreign key, then the rating is
 * aggregated the way recomputeRating would. Idempotent via INSERT OR REPLACE.
 */
function seedSocial(): void {
  const db = new Database(findLocalD1());
  const name = "@brika/plugin-i18n";
  const now = Math.floor(Date.now() / 1000);
  db.run(
    "INSERT OR IGNORE INTO plugins (name, latest_version, brika_engine, display_name, description) VALUES (?, ?, ?, ?, ?)",
    [name, "0.1.0", "^0.1.0", "i18n Toolkit", "Translate, format, and localize content."],
  );
  const users = [
    { id: "u-mara", gh: 900_001, login: "mara-dev", nm: "Mara Lopez" },
    { id: "u-kenji", gh: 900_002, login: "kenji-ito", nm: "Kenji Ito" },
    { id: "u-aria", gh: 900_003, login: "aria-n", nm: "Aria Novak" },
  ];
  for (const u of users) {
    db.run(
      "INSERT OR REPLACE INTO users (id, github_id, login, name, created_at) VALUES (?, ?, ?, ?, ?)",
      [u.id, u.gh, u.login, u.nm, now],
    );
  }
  const reviews = [
    {
      id: "rv-1",
      user: "u-mara",
      rating: 5,
      title: "Saved us weeks",
      body: "Dropped it into our hub and shipped French and German the same day. The offline catalog is a lifesaver.",
      helpful: 7,
    },
    {
      id: "rv-2",
      user: "u-kenji",
      rating: 5,
      title: "Accurate detection",
      body: "Language detection is spot on and the fallback to English is seamless.",
      helpful: 3,
    },
    {
      id: "rv-3",
      user: "u-aria",
      rating: 4,
      title: "Solid, minor nits",
      body: "Works well; would love a bit more control over pluralization rules.",
      helpful: 1,
    },
  ];
  for (const r of reviews) {
    db.run(
      "INSERT OR REPLACE INTO reviews (id, plugin_name, user_id, rating, title, body, version_reviewed, helpful_count, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [r.id, name, r.user, r.rating, r.title, r.body, "0.1.0", r.helpful, now, now],
    );
  }
  const comments = [
    {
      id: "cm-1",
      parent: null,
      user: "u-kenji",
      body: "Does this handle right-to-left locales like Arabic?",
    },
    {
      id: "cm-2",
      parent: "cm-1",
      user: "u-mara",
      body: "Yes. RTL is detected from the BCP-47 tag and the hub mirrors the layout automatically.",
    },
  ];
  for (const c of comments) {
    db.run(
      "INSERT OR REPLACE INTO comments (id, plugin_name, parent_id, user_id, body, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      [c.id, name, c.parent, c.user, c.body, now],
    );
  }
  const agg = db
    .query("SELECT avg(rating) AS average, count(*) AS count FROM reviews WHERE plugin_name = ?")
    .get(name) as { average: number; count: number };
  db.run("UPDATE plugins SET rating_average = ?, rating_count = ? WHERE name = ?", [
    agg.average,
    agg.count,
    name,
  ]);
  db.close();
  log(`seeded ${reviews.length} reviews + ${comments.length} comments on ${name}`);
}

await waitForRegistry();
const token = await mintToken();
for (const plugin of EXAMPLES) await publish(plugin, token);
seedProvenance();
seedDependencies();
seedGrants();
seedDownloadHistory();
await seedManagement(token);
seedSocial();
log(`done (dir: ${dirname(findLocalD1())})`);
