import { inject } from "@brika/di";
import { PageQuery } from "@brika/registry-contract";
import { ScopeService } from "@brika/registry-core";
import { reply } from "@brika/router";
import { createFileRoute } from "@tanstack/react-router";
import { paginated } from "@/lib/pagination";
import { runOperator } from "@/server/http";
import { SocialService } from "@/server/services/social-service";

/**
 * `GET /api/operator/scopes?q=&limit=&offset=` - a page of scopes with their takedown state and
 * open-report count, for the operator console directory, optionally filtered by `q` (a substring
 * over the scope + display name). Operator-gated (403 for non-operators); not membership-filtered.
 * The filter + window are pushed down to the store, so the wire never carries the whole list.
 */
export const Route = createFileRoute("/api/operator/scopes")({
  server: {
    handlers: {
      GET: ({ request }) =>
        runOperator(request, async () => {
          const url = new URL(request.url);
          const { limit, offset } = PageQuery.parse({
            limit: url.searchParams.get("limit") ?? undefined,
            offset: url.searchParams.get("offset") ?? undefined,
          });
          const q = (url.searchParams.get("q") ?? "").trim();
          const page = await inject(ScopeService).listForOperator({ q, limit, offset });
          const reports = await inject(SocialService).openReportCountsByScope(
            page.items.map((s) => s.scope),
          );
          const items = page.items.map((s) => ({
            scope: s.scope,
            displayName: s.displayName,
            takedown: s.takedown,
            openReports: reports.get(s.scope) ?? 0,
          }));
          return reply(paginated(items, page.total, { limit, offset }));
        }),
    },
  },
});
