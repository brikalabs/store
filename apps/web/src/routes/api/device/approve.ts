import { inject } from "@brika/di";
import { badRequest, readBody, unauthorized } from "@brika/router";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/auth";
import { publicJson, runHandler } from "@/server/http";
import { enforceLimit, WRITE_WINDOW } from "@/server/rate-limit";
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
          if (user === null) throw unauthorized("Sign in required");

          // Cap approvals per user to throttle abuse of the device-binding endpoint.
          await enforceLimit("WRITE_LIMITER", `device-approve:${user.id}`, WRITE_WINDOW);
          const parsed = await readBody(request, ApproveInput, "Invalid request");

          const code = parsed.user_code.trim().toUpperCase();
          if (!(await inject(DeviceApprovalStore).approve(code, user.id))) {
            throw badRequest("That code is invalid, expired, or already used");
          }
          return publicJson({ ok: true });
        }),
    },
  },
});
