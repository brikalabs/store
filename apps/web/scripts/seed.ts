/**
 * Developer seed: publish the example `@brika/*` plugins to the LOCAL registry so the
 * storefront has real, scoped, verified listings to browse. The store lists only what
 * is published here (no npm listing), so a fresh local DB shows an empty store until
 * this runs.
 *
 * Prerequisites: the registry + web workers are running and the local D1 has the
 * registry schema (`bun run db:setup:local`). Then, from `apps/web`:
 *
 *   bun run seed                        # publish under @brika, owner account `u-brika-seed`
 *   BRIKA_SEED_OWNER=<handle> bun run seed   # owner account `u-<handle>`
 *   BRIKA_REGISTRY=http://localhost:8787 bun run seed
 *
 * The owner handle yields a synthetic dev account id `u-<handle>` (identity is the account id,
 * not a GitHub login). To manage these scopes as your REAL signed-in account, add yourself by
 * email from the scope console after signing in once.
 *
 * Idempotent: re-running re-publishes nothing already present (409 is treated as success).
 */
import {
  ensureScope,
  log,
  mintToken,
  publish,
  seedDownloadHistory,
  waitForRegistry,
} from "./seed-lib";

const EXAMPLES = ["plugin-i18n", "plugin-snapshot", "plugin-clock", "plugin-icon"];
const OWNER = process.env.BRIKA_SEED_OWNER ?? "brika-seed";

await waitForRegistry();
ensureScope({ scope: "@brika", displayName: "Brika Labs", owner: OWNER });
const token = await mintToken(OWNER);
for (const plugin of EXAMPLES) await publish(plugin, token);
seedDownloadHistory("@brika/plugin-i18n");
log(`done: ${EXAMPLES.length} plugins under @brika (owner ${OWNER})`);
