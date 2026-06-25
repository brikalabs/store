import { inject } from "@brika/di";
import { ScopeService } from "@brika/registry-core";
import { okOrThrow, readBody, reply } from "@brika/router";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { recordAudit, runOperator } from "@/server/http";

const Body = z.object({ verified: z.boolean() });

/**
 * `POST /api/operator/scopes/:scope/verify` - toggle a scope's "verified organization" badge
 * (manual moderation, the blue check). Operator-gated; audited.
 */
export const Route = createFileRoute("/api/operator/scopes/$scope/verify")({
  server: {
    handlers: {
      POST: ({ request, params }) =>
        runOperator(request, async (a) => {
          const { verified } = await readBody(request, Body, "Invalid verify request");
          okOrThrow(await inject(ScopeService).setVerified(params.scope, verified));
          await recordAudit(a, {
            action: verified ? "scope_verify" : "scope_unverify",
            packageName: params.scope,
          });
          return reply({ ok: true, scope: params.scope, verified });
        }),
    },
  },
});
