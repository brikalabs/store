import { readBytes, reply } from "@brika/router";
import { createFileRoute } from "@tanstack/react-router";
import { MAX_AVATAR_BYTES } from "@/lib/avatar";
import { runAuthed } from "@/server/http";
import { enforceLimit } from "@/server/rate-limit";
import { clearUserAvatar, uploadUserAvatar } from "@/server/user-avatar";

/**
 * Avatar endpoints for the signed-in account (USER-002): POST uploads a WebP avatar to R2, DELETE
 * clears it (falling back to the provider image). Keyed by the session `users.id`, so a user only
 * ever writes their own row.
 */
export const Route = createFileRoute("/api/account/avatar")({
  server: {
    handlers: {
      POST: ({ request }) =>
        runAuthed(request, async (a) => {
          // Cap avatar uploads per user: each is an R2 write.
          await enforceLimit("WRITE_LIMITER", `avatar:${a.user.id}`);
          const bytes = await readBytes(request, MAX_AVATAR_BYTES, "Avatar exceeds 512 KiB");
          const avatarUrl = await uploadUserAvatar(a.user.id, bytes);
          return reply({ ok: true, avatarUrl });
        }),
      DELETE: ({ request }) =>
        runAuthed(request, async (a) => {
          const avatarUrl = await clearUserAvatar(a.user.id);
          return reply({ ok: true, avatarUrl });
        }),
    },
  },
});
