import type { PluginDetail } from "@brika/registry-contract";
import { eq } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/server/db/client";
import { pluginListings } from "@/server/db/schema";

/**
 * Store-level listing overrides a maintainer edits in the console: the validated input
 * shape and the D1 CRUD. Depends only on the store D1 (no Cloudflare binding), so it is
 * unit-testable; the ownership gate lives in `listing-ownership.ts`.
 */

export const PluginListingInput = z.object({
  displayName: z.string().max(80).nullable(),
  summary: z.string().max(280).nullable(),
  description: z.string().max(4000).nullable(),
  visibility: z.enum(["public", "unlisted"]),
});
export type PluginListingInput = z.infer<typeof PluginListingInput>;

export interface PluginListingRow {
  displayName: string | null;
  summary: string | null;
  description: string | null;
  visibility: string;
}

/** The stored override for a package, or null when the maintainer has set none. */
export async function getPluginListing(db: Db, name: string): Promise<PluginListingRow | null> {
  const rows = await db
    .select({
      displayName: pluginListings.displayName,
      summary: pluginListings.summary,
      description: pluginListings.description,
      visibility: pluginListings.visibility,
    })
    .from(pluginListings)
    .where(eq(pluginListings.pluginName, name))
    .limit(1);
  return rows[0] ?? null;
}

/** Create or replace a package's store listing override. */
export async function upsertPluginListing(
  db: Db,
  name: string,
  userId: string,
  input: PluginListingInput,
): Promise<void> {
  const values = {
    displayName: input.displayName,
    summary: input.summary,
    description: input.description,
    visibility: input.visibility,
    updatedBy: userId,
  };
  await db
    .insert(pluginListings)
    .values({ pluginName: name, ...values })
    .onConflictDoUpdate({ target: pluginListings.pluginName, set: values });
}

/**
 * Pure ownership decision: a registry-scoped package is editable by a member of its scope;
 * an npm-federated package by one of its maintainers. Extracted from the IO (see
 * `listing-ownership.ts`) so the rule is unit-testable without the registry D1 or network.
 */
export function isListingMaintainer(opts: {
  readonly scope: string | null;
  readonly memberScopes: readonly string[];
  readonly maintainers: readonly string[];
  readonly login: string;
}): boolean {
  return opts.scope === null
    ? opts.maintainers.includes(opts.login)
    : opts.memberScopes.includes(opts.scope);
}

/** The public listing override (the fields surfaced on the plugin page). */
export interface ListingOverride {
  displayName: string | null;
  description: string | null;
}

/**
 * Layer a store-level override on top of the manifest-derived detail. Pure (runs on the
 * server or client); only set fields override, so a blank field keeps the manifest value.
 */
export function applyListingOverride(
  detail: PluginDetail,
  override: ListingOverride | null,
): PluginDetail {
  if (override === null) return detail;
  return {
    ...detail,
    displayName: override.displayName ?? detail.displayName,
    description: override.description ?? detail.description,
  };
}
