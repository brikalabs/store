import { useCallback, useState } from "react";
import { readError, scopePath } from "@/lib/scope-api";

export interface Member {
  userId: string;
  /** The account's display name + avatar, resolved server-side (membership stores only the id). */
  displayName: string | null;
  avatarUrl: string | null;
  role: "admin" | "member";
}

/**
 * The member mutations for a scope (re-role, remove, add): the card stays presentational. The list
 * itself is owned by the page (its result drives the admin check), so the hook takes that page's
 * `onReload` and refreshes through it on success; a failure reports through `onError`. `add` resolves
 * to whether the call succeeded so the invite form can clear its input on success.
 */
export function useScopeMembers(
  scope: string,
  onReload: () => Promise<void>,
  onError: (message: string) => void,
) {
  const [busy, setBusy] = useState(false);

  // Re-roling an existing member keys off their account id (already a member); the
  // email-based invite (`add` below) is only for adding someone new.
  const setRole = useCallback(
    async (member: Member, role: "admin" | "member") => {
      const res = await fetch(scopePath(scope, `/members/${encodeURIComponent(member.userId)}`), {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role }),
      });
      if (res.ok) await onReload();
      else onError(await readError(res));
    },
    [scope, onReload, onError],
  );

  const remove = useCallback(
    async (member: Member) => {
      const res = await fetch(scopePath(scope, `/members/${encodeURIComponent(member.userId)}`), {
        method: "DELETE",
      });
      if (res.ok) await onReload();
      else onError(await readError(res));
    },
    [scope, onReload, onError],
  );

  const add = useCallback(
    async (email: string, role: "admin" | "member"): Promise<boolean> => {
      setBusy(true);
      const res = await fetch(scopePath(scope, "/members"), {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim(), role }),
      });
      setBusy(false);
      if (res.ok) {
        await onReload();
        return true;
      }
      onError(await readError(res));
      return false;
    },
    [scope, onReload, onError],
  );

  return { busy, setRole, remove, add };
}
