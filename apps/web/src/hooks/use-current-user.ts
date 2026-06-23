import { useEffect, useState } from "react";
import { z } from "zod";
import { fetchJson } from "@/lib/fetch-json";

/** Client-side current-user state, fetched once from `/auth/me`. */

const CurrentUser = z.object({
  id: z.string(),
  name: z.string().nullable(),
  email: z.string().nullish(),
  avatarUrl: z.string().nullable(),
});
export type CurrentUser = z.infer<typeof CurrentUser>;

const MeResponse = z.object({ user: CurrentUser.nullable() });

let cached: CurrentUser | null | undefined;
let inflight: Promise<CurrentUser | null> | undefined;

async function load(): Promise<CurrentUser | null> {
  if (cached !== undefined) return cached;
  inflight ??= fetchJson("/auth/me", MeResponse, { credentials: "same-origin" }).then((data) => {
    cached = data?.user ?? null;
    return cached;
  });
  return inflight;
}

/** Reset the cached user after sign-in/out so the next read refetches. */
export function clearCurrentUser(): void {
  cached = undefined;
  inflight = undefined;
}

export function useCurrentUser(): { user: CurrentUser | null; loading: boolean } {
  const [state, setState] = useState<{ user: CurrentUser | null; loading: boolean }>({
    user: cached ?? null,
    loading: cached === undefined,
  });

  useEffect(() => {
    let active = true;
    load().then((user) => {
      if (active) setState({ user, loading: false });
    });
    return () => {
      active = false;
    };
  }, []);

  return state;
}
