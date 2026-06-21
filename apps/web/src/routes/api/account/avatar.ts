import { readBytes, reply } from "@brika/router";
import { createFileRoute } from "@tanstack/react-router";
import { MAX_AVATAR_BYTES } from "@/lib/avatar";
import { runAuthed } from "@/server/http";
import { clearUserAvatar, uploadUserAvatar } from "@/server/user-avatar";

/**
 * Scope-style avatar endpoints for the signed-in account (USER-002):
 *   POST   /api/account/avatar  upload a WebP avatar (client-resized) -> stored in R2, served by its
 *                               public URL; the profile points at that URL.
 *   DELETE /api/account/avatar  clear it, falling back to the provider (GitHub) image.
 * A user only ever writes their own row (keyed by the session `users.id`).
 */
export const Route = createFileRoute("/api/account/avatar")({
  server: {
    handlers: {
      POST: ({ request }) =>
        runAuthed(request, async (a) => {
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
