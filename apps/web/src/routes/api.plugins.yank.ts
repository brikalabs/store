import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { authed } from "../lib/console-api";
import { jsonBadRequest, jsonError, jsonPrivate, manageStatus } from "../lib/http";

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
      POST: async ({ request }) => {
        const a = await authed(request);
        if ("response" in a) return a.response;
        const parsed = Body.safeParse(await request.json());
        if (!parsed.success) return jsonBadRequest("Invalid yank request");
        const { name, version, yanked } = parsed.data;
        const result = await a.svc.management.setYanked(a.identity, name, version, yanked);
        if (!result.ok) return jsonError(manageStatus(result.code), result.message);
        await a.svc.audit.record({
          action: yanked ? "yank" : "unyank",
          packageName: name,
          version,
          actor: a.identity,
          detail: null,
        });
        return jsonPrivate({ ok: true, name, version, yanked });
      },
    },
  },
});
