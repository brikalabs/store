import { displayNameSchema } from "@brika/registry-core";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { authed } from "../lib/console-api";
import { jsonBadRequest, jsonError, jsonPrivate, scopeStatus } from "../lib/http";

const Body = z.object({ displayName: displayNameSchema.nullable() });

/** `POST /api/scopes/:scope/display-name` - set the verified publisher label (admin only). */
export const Route = createFileRoute("/api/scopes/$scope/display-name")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const a = await authed(request);
        if ("response" in a) return a.response;
        const parsed = Body.safeParse(await request.json());
        if (!parsed.success) return jsonBadRequest("Invalid display name");
        const result = await a.svc.scopes.setDisplayName(
          a.identity,
          params.scope,
          parsed.data.displayName,
        );
        if (!result.ok) return jsonError(scopeStatus(result.code), result.message);
        await a.svc.audit.record({
          action: "scope_display_name",
          packageName: params.scope,
          version: null,
          actor: a.identity,
          detail: { displayName: parsed.data.displayName },
        });
        return jsonPrivate({ ok: true, scope: params.scope, displayName: result.displayName });
      },
    },
  },
});
