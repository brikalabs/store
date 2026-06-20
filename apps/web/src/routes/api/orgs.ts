import { listOrgsForMember } from "@brika/store-db/adapters";
import { createFileRoute } from "@tanstack/react-router";
import { jsonPrivate } from "@/lib/http";
import { authed } from "@/server/console-api";
import { registryDb } from "@/server/registry-services";

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
