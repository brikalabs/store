import { okOrThrow, parseBody, reply } from "@brika/router";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { runAuthed } from "@/server/http";

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
        runAuthed(request, async (a) => {
          const parsed = parseBody(Body, await request.json(), "Invalid deprecate request");
          const { name, version, message } = parsed;
          okOrThrow(await a.svc.management.deprecate(a.identity, name, version, message));
          await a.svc.audit.record({
            action: "deprecate",
            packageName: name,
            version,
            actor: a.identity,
            detail: { message },
          });
          return reply({ ok: true, name, version, deprecated: message });
        }),
    },
  },
});
