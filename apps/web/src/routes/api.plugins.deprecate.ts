import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { authed } from "@/lib/console-api";
import { jsonBadRequest, jsonError, jsonPrivate, manageStatus } from "@/lib/http";

const Body = z.object({
  name: z.string().min(1),
  version: z.string().min(1),
  // null clears the deprecation; a string sets the warning message.
  message: z.string().max(1024).nullable(),
});

/** `POST /api/plugins/deprecate` - deprecate/un-deprecate a version (scope-member only). */
export const Route = createFileRoute("/api/plugins/deprecate")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const a = await authed(request);
        if ("response" in a) return a.response;
        const parsed = Body.safeParse(await request.json());
        if (!parsed.success) return jsonBadRequest("Invalid deprecate request");
        const { name, version, message } = parsed.data;
        const result = await a.svc.management.deprecate(a.identity, name, version, message);
        if (!result.ok) return jsonError(manageStatus(result.code), result.message);
        await a.svc.audit.record({
          action: "deprecate",
          packageName: name,
          version,
          actor: a.identity,
          detail: { message },
        });
        return jsonPrivate({ ok: true, name, version, deprecated: message });
      },
    },
  },
});
