import { createFileRoute } from "@tanstack/react-router";
import { jsonOk } from "../lib/http";
import { getDeveloperPage } from "../lib/registry";
import { serverContext } from "../lib/server-context";
import { getDeveloperProfile } from "../lib/social";

/**
 * `GET /v1/developers/:id`: the public developer profile. The editable D1 row is
 * merged over the npm-derived base, so a maintainer's dashboard edits (bio,
 * display name, website, verification) appear here.
 */
export const Route = createFileRoute("/v1/developers/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const stored = await getDeveloperProfile(serverContext().db, params.id);
        const { profile } = await getDeveloperPage(params.id, stored);
        return jsonOk(profile);
      },
    },
  },
});
