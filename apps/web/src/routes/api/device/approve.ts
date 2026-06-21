import { env } from "cloudflare:workers";
import { inject } from "@brika/di";
import { badRequest, unauthorized } from "@brika/router";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/auth";
import { approveDeviceCode } from "@/lib/auth/device-approval";
import { Database } from "@/server/db/client";
import { publicJson, runHandler } from "@/server/http";

/**
 * `POST /api/device/approve`: approve a pending registry device-authorization
 * (RFC 8628) so `brika auth login` can mint a publish token. The user must be
 * signed in; their GitHub login is bound to the device. The approval write goes
 * through the registry's typed schema (`@brika/store-db`) into the shared
 * `reg_device_auth` table.
 */
const ApproveInput = z.object({ user_code: z.string() });

export const Route = createFileRoute("/api/device/approve")({
  server: {
    handlers: {
      POST: ({ request }) =>
        runHandler(async () => {
          const user = await getCurrentUser(request, inject(Database).orm);
          if (user === null) throw unauthorized("Sign in required");

          const raw: unknown = await request.json().catch(() => null);
          const parsed = ApproveInput.safeParse(raw);
          if (!parsed.success) throw badRequest("Invalid request");

          const code = parsed.data.user_code.trim().toUpperCase();
          if (!(await approveDeviceCode(env.DB, code, user.login))) {
            throw badRequest("That code is invalid, expired, or already used");
          }
          return publicJson({ ok: true });
        }),
    },
  },
});
