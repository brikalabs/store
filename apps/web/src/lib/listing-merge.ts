import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { pluginListings } from "@/db/schema";
import type { ListingOverride } from "./listing";
import { serverContext } from "./server-context";

/**
 * Read a plugin's public listing override. A server function so the plugin page loader
 * (which runs isomorphically) can fetch it over RPC during client navigation, where the
 * D1 binding is not available. Public: no auth (it is what the page shows everyone). The
 * pure merge (`applyListingOverride`) lives in `./listing`.
 */
export const fetchPublicListing = createServerFn({ method: "GET" })
  .validator((name: string) => name)
  .handler(async ({ data: name }): Promise<ListingOverride | null> => {
    const { db } = serverContext();
    const rows = await db
      .select({
        displayName: pluginListings.displayName,
        description: pluginListings.description,
      })
      .from(pluginListings)
      .where(eq(pluginListings.pluginName, name))
      .limit(1);
    return rows[0] ?? null;
  });
