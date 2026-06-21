import { okOrThrow, parseBody, reply } from "@brika/router";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { authed, runHandler } from "@/server/http";

const Body = z.object({
  name: z.string().min(1),
  version: z.string().min(1),
  yanked: z.boolean(),
});

/**
 * `POST /api/plugins/yank` - yank/un-yank a version (scope-member only). Yank hides the
 * version from new installs but keeps the bytes so pinned lockfiles still resolve.
 */
export const Route = createFileRoute("/api/plugins/yank")({
  server: {
    handlers: {
      POST: ({ request }) =>
        runHandler(async () => {
          const a = await authed(request);
          const parsed = parseBody(Body, await request.json(), "Invalid yank request");
          const { name, version, yanked } = parsed;
          okOrThrow(await a.svc.management.setYanked(a.identity, name, version, yanked));
          await a.svc.audit.record({
            action: yanked ? "yank" : "unyank",
            packageName: name,
            version,
            actor: a.identity,
            detail: null,
          });
          return reply({ ok: true, name, version, yanked });
        }),
    },
  },
});
