import { createFileRoute } from "@tanstack/react-router";
import { getCurrentUser } from "@/lib/auth";
import { jsonBadRequest, jsonForbidden, jsonPrivate, jsonUnauthorized } from "@/lib/http";
import { getPluginListing, PluginListingInput, upsertPluginListing } from "@/lib/listing";
import { canEditPluginListing } from "@/lib/listing-ownership";
import { serverContext } from "@/lib/server-context";

/**
 * `GET|PUT /api/plugins/:name/listing` , the maintainer's store-listing override for a
 * package. Both are session-authenticated and ownership-gated (scope member for an
 * `@scope` package, npm maintainer otherwise). GET returns the current override (for the
 * editor); PUT upserts it. The public read path uses `fetchPublicListing` instead.
 */
export const Route = createFileRoute("/api/plugins/$name/listing")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const { db } = serverContext();
        const user = await getCurrentUser(request, db);
        if (user === null) return jsonUnauthorized();
        if (!(await canEditPluginListing(user, params.name))) {
          return jsonForbidden("You do not maintain this plugin");
        }
        return jsonPrivate({ listing: await getPluginListing(db, params.name) });
      },
      PUT: async ({ request, params }) => {
        const { db } = serverContext();
        const user = await getCurrentUser(request, db);
        if (user === null) return jsonUnauthorized();
        if (!(await canEditPluginListing(user, params.name))) {
          return jsonForbidden("You do not maintain this plugin");
        }
        const parsed = PluginListingInput.safeParse(await request.json());
        if (!parsed.success) return jsonBadRequest("Invalid listing");
        await upsertPluginListing(db, params.name, user.id, parsed.data);
        return jsonPrivate({ listing: await getPluginListing(db, params.name) });
      },
    },
  },
});
