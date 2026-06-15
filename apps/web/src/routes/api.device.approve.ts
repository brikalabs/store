import { env } from "cloudflare:workers";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { getCurrentUser } from "../lib/auth";
import { jsonBadRequest, jsonOk, jsonUnauthorized } from "../lib/http";

/**
 * `POST /api/device/approve`: approve a pending registry device-authorization
 * (RFC 8628) so `brika auth login` can mint a publish token. The user must be
 * signed in; their GitHub login is bound to the device. Raw D1 against the
 * registry's `reg_device_auth` (shared database), so the store keeps no
 * dependency on the registry's drizzle schema.
 */
const ApproveInput = z.object({ user_code: z.string() });

export const Route = createFileRoute("/api/device/approve")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const user = await getCurrentUser(request);
        if (user === null) return jsonUnauthorized();

        const raw: unknown = await request.json().catch(() => null);
        const parsed = ApproveInput.safeParse(raw);
        if (!parsed.success) return jsonBadRequest("Invalid request");

        const code = parsed.data.user_code.trim().toUpperCase();
        const now = Math.floor(Date.now() / 1000);
        const result = await env.DB.prepare(
          "UPDATE reg_device_auth SET approved = 1, github_login = ?1 WHERE user_code = ?2 AND expires_at > ?3 AND approved = 0",
        )
          .bind(user.login, code, now)
          .run();

        if (result.meta.changes === 0) {
          return jsonBadRequest("That code is invalid, expired, or already used");
        }
        return jsonOk({ ok: true });
      },
    },
  },
});
