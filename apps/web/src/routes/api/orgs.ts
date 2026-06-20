import { listOrgsForMember } from "@brika/store-db/adapters";
import { createFileRoute } from "@tanstack/react-router";
import { jsonPrivate } from "@/lib/http";
import { authed, runJson } from "@/server/console-api";
import { registryDb } from "@/server/registry-services";

/** `GET /api/orgs` - the organisations the signed-in user belongs to, with their role. */
export const Route = createFileRoute("/api/orgs")({
  server: {
    handlers: {
      GET: ({ request }) =>
        runJson(async () => {
          const a = await authed(request);
          const orgs = await listOrgsForMember(registryDb(), "github", a.user.login);
          return jsonPrivate({ orgs });
        }),
    },
  },
});
