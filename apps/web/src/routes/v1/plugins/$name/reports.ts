import { inject } from "@brika/di";
import { notFound, readBody, reply } from "@brika/router";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { REPORT_REASON_KEYS } from "@/lib/reports";
import { runUser } from "@/server/http";
import { enforceLimit, WRITE_WINDOW } from "@/server/rate-limit";
import { SocialService } from "@/server/services/social-service";

const ReportInput = z.object({
  reason: z.enum(REPORT_REASON_KEYS),
  details: z.string().max(2000).optional(),
});

/** `POST /v1/plugins/:name/reports` - file a moderation report against a plugin (requires a session). */
export const Route = createFileRoute("/v1/plugins/$name/reports")({
  server: {
    handlers: {
      POST: ({ request, params }) =>
        runUser(request, async (userId) => {
          // Cap reports per user so one account can't flood the operator moderation queue.
          await enforceLimit("WRITE_LIMITER", `report:${userId}`, WRITE_WINDOW);
          const parsed = await readBody(request, ReportInput, "Invalid report");
          const social = inject(SocialService);
          if (!(await social.ensurePluginCached(params.name))) throw notFound();
          await social.submitReport(params.name, userId, parsed);
          return reply({ ok: true });
        }),
    },
  },
});
