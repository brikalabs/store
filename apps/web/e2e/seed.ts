/**
 * E2E seed (run with bun). Builds on the shared dev-seed helpers (`scripts/seed-lib.ts`)
 * to publish the example `@brika/*` plugins to the local registry, then layers the
 * e2e-only fixtures on top: the operator console fixtures, simulated CI provenance,
 * dependency/grant/download/social data, and a managed-versions lifecycle. Every step
 * is idempotent (already-published versions 409 as success), so it is safe to re-run
 * before every Playwright run.
 */
import { Database } from "bun:sqlite";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  ensureScope,
  findLocalD1,
  log,
  mintToken,
  publish,
  REPO_ROOT,
  runCli,
  seedDownloadHistory,
  waitForRegistry,
} from "../scripts/seed-lib";

const EXAMPLES = ["plugin-i18n", "plugin-snapshot", "plugin-clock", "plugin-icon"];
/** The login that owns the `@brika` scope in the e2e fixture (admin member). */
const SEED_OWNER = "e2e-bot";

/**
 * Set up the `@brika` scope (via the shared helper), then clear any trusted-publisher rows so
 * the console e2e (PUB-016) starts from a clean state.
 */
function setupBrikaScope(): void {
  ensureScope({ scope: "@brika", displayName: "Brika Labs", owner: SEED_OWNER });
  const db = new Database(findLocalD1());
  db.run("DELETE FROM reg_trusted_publishers WHERE scope = '@brika'");
  db.close();
}

/** The login of the e2e operator (a `REGISTRY_ADMINS` member; see playwright.config.ts). */
const OPERATOR_LOGIN = "e2e-operator";
/** Stable user id the operator e2e mints its session cookie for (see operator-session.ts). */
const OPERATOR_USER_ID = "u-operator";

/**
 * Seed the operator console fixtures: a `users` row for the operator (so the signed session
 * cookie resolves to a real user) and a throwaway scope `@squatter` to take down and restore.
 * The squatter scope is deliberately separate from `@brika` so the operator e2e never disturbs
 * the storefront's public listings. The operator is granted moderation rights out-of-band
 * via `REGISTRY_ADMINS=github:e2e-operator` on the web dev server, not via any DB row.
 */
function setupOperatorFixtures(): void {
  const db = new Database(findLocalD1());
  const now = Math.floor(Date.now() / 1000);
  db.run(
    "INSERT OR REPLACE INTO users (id, github_id, login, name, created_at) VALUES (?, ?, ?, ?, ?)",
    [OPERATOR_USER_ID, 990_001, OPERATOR_LOGIN, "E2E Operator", now],
  );
  db.run(
    "INSERT OR IGNORE INTO reg_scopes (scope, display_name) VALUES ('@squatter', 'Squatter Co')",
  );
  // Re-activate it if a previous run left it taken down, so the spec starts from a clean state.
  db.run("UPDATE reg_scopes SET takedown = NULL WHERE scope = '@squatter'");
  db.close();
  log(`set up operator ${OPERATOR_LOGIN} + throwaway scope @squatter`);
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
setupBrikaScope();
setupOperatorFixtures();
const token = await mintToken(SEED_OWNER);
for (const plugin of EXAMPLES) await publish(plugin, token);
seedProvenance();
seedDependencies();
seedGrants();
seedDownloadHistory("@brika/plugin-i18n");
await seedManagement(token);
seedSocial();
log(`done (dir: ${dirname(findLocalD1())})`);
