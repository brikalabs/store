import { useEffect, useState } from "react";
import { z } from "zod";

/** One audit event in the developer's activity feed (the fields the feed renders). */
export const ActivityEntry = z.object({
  id: z.string(),
  action: z.string(),
  target: z.string().nullable(),
  version: z.string().nullable(),
  at: z.string(),
});
export type ActivityEntry = z.infer<typeof ActivityEntry>;

const Response = z.object({ entries: z.array(ActivityEntry) });

/** The signed-in developer's recent audit events (`GET /api/account/activity`); null while loading. */
export function useActivity(): ActivityEntry[] | null {
  const [entries, setEntries] = useState<ActivityEntry[] | null>(null);
  useEffect(() => {
    let active = true;
    fetch("/api/account/activity")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!active) return;
        const parsed = data === null ? null : Response.safeParse(data);
        setEntries(parsed?.success ? parsed.data.entries : []);
      })
      .catch(() => active && setEntries([]));
    return () => {
      active = false;
    };
  }, []);
  return entries;
}
