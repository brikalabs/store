import { inject } from "@brika/di";
import { badRequest, unauthorized } from "@brika/router";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/auth";
import { publicJson, readJsonBody, runHandler } from "@/server/http";
import { ServerT } from "@/server/i18n";
import { enforceLimit } from "@/server/rate-limit";
import { DeviceApprovalStore } from "@/server/stores/device-approval-store";

/**
 * `POST /api/device/approve`: approve a pending registry device-authorization (RFC 8628) so
 * `brika auth login` can mint a token. The signed-in user's Brika account id is bound to the device.
 */
const ApproveInput = z.object({ user_code: z.string() });

export const Route = createFileRoute("/api/device/approve")({
  server: {
    handlers: {
      POST: ({ request }) =>
        runHandler(async () => {
          const user = await getCurrentUser(request);
          if (user === null) throw unauthorized(inject(ServerT).t("api:signInRequired"));

          // Cap approvals per user to throttle abuse of the device-binding endpoint.
          await enforceLimit("WRITE_LIMITER", `device-approve:${user.id}`);
          const parsed = await readJsonBody(request, ApproveInput, "api:invalidRequest");

          const code = parsed.user_code.trim().toUpperCase();
          if (!(await inject(DeviceApprovalStore).approve(code, user.id))) {
            throw badRequest(inject(ServerT).t("api:deviceCodeInvalid"));
          }
          return publicJson({ ok: true });
        }),
    },
  },
});
