import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { jsonPrivate, manageStatus } from "@/lib/http";
import { authed, parseBody, runJson, unwrap } from "@/server/console-api";

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
      POST: ({ request }) =>
        runJson(async () => {
          const a = await authed(request);
          const parsed = parseBody(Body, await request.json(), "Invalid deprecate request");
          const { name, version, message } = parsed;
          unwrap(
            await a.svc.management.deprecate(a.identity, name, version, message),
            manageStatus,
          );
          await a.svc.audit.record({
            action: "deprecate",
            packageName: name,
            version,
            actor: a.identity,
            detail: { message },
          });
          return jsonPrivate({ ok: true, name, version, deprecated: message });
        }),
    },
  },
});
