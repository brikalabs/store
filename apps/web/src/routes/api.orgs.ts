import { listOrgsForMember } from "@brika/store-db/adapters";
import { createFileRoute } from "@tanstack/react-router";
import { authed } from "../lib/console-api";
import { jsonPrivate } from "../lib/http";
import { registryDb } from "../lib/registry-services";

/** `GET /api/orgs` - the organisations the signed-in user belongs to, with their role. */
export const Route = createFileRoute("/api/orgs")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const a = await authed(request);
        if ("response" in a) return a.response;
        const orgs = await listOrgsForMember(registryDb(), "github", a.user.login);
        return jsonPrivate({ orgs });
      },
    },
  },
});
