import { reply } from "@brika/router";
import { createFileRoute } from "@tanstack/react-router";
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
          const contentType = request.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
          const bytes = new Uint8Array(await request.arrayBuffer());
          const avatarUrl = await uploadUserAvatar(a.user.id, bytes, contentType);
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
