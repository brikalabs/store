import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { jsonBadRequest, jsonError, jsonPrivate, manageStatus } from "@/lib/http";
import { operatorAuthed } from "@/server/console-api";

const Body = z.object({ name: z.string().min(1), version: z.string().min(1) });

/** `POST /api/operator/packages/restore` - reverse a version takedown. Operator-gated. */
export const Route = createFileRoute("/api/operator/packages/restore")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const a = await operatorAuthed(request);
        if ("response" in a) return a.response;
        const parsed = Body.safeParse(await request.json());
        if (!parsed.success) return jsonBadRequest("name and version are required");
        const { name, version } = parsed.data;
        const result = await a.svc.management.restore(name, version);
        if (!result.ok) return jsonError(manageStatus(result.code), result.message);
        await a.svc.audit.record({
          action: "restore",
          packageName: name,
          version,
          actor: a.identity,
          detail: null,
        });
        return jsonPrivate({ ok: true, name, version, takedown: null });
      },
    },
  },
});
