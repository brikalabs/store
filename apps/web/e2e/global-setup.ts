import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Playwright global setup. Publishes the example plugins to the local registry
 * by delegating to the bun seed script (`bun:sqlite` + `brika publish`), which
 * Playwright's Node runner cannot do directly. Idempotent.
 */
export default function globalSetup(): void {
  const here = dirname(fileURLToPath(import.meta.url));
  const result = spawnSync("bun", ["run", join(here, "seed.ts")], { stdio: "inherit" });
  if (result.status !== 0) {
    throw new Error(`e2e seed failed (exit ${result.status ?? "signal"})`);
  }
}
