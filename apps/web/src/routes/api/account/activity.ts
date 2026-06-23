import { inject } from "@brika/di";
import { Audit } from "@brika/registry-runtime";
import { reply } from "@brika/router";
import { createFileRoute } from "@tanstack/react-router";
import { runAuthed } from "@/server/http";
import { ScopeMembershipStore } from "@/server/stores/scope-membership-store";

/** How many activity rows the overview feed requests (also the server-side cap). */
const LIMIT = 8;

/**
 * `GET /api/account/activity` - the signed-in developer's own recent audit events (publishes,
 * yanks, deprecations, reservations, scope changes) across the scopes they belong to, newest
 * first. Backs the dashboard's "Recent activity" feed with real events, not a plugin snapshot.
 */
export const Route = createFileRoute("/api/account/activity")({
  server: {
    handlers: {
      GET: ({ request }) =>
        runAuthed(request, async (a) => {
          const scopes = await inject(ScopeMembershipStore).listScopesForMember(a.user.id);
          const entries = await inject(Audit).recentForScopes(
            scopes.map((s) => s.scope),
            LIMIT,
          );
          return reply({ entries });
        }),
    },
  },
});
