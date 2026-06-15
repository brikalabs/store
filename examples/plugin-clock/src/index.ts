/**
 * @brika/plugin-clock - timezone clocks, interval triggers, and scheduled sparks.
 */

export interface NowResult {
  readonly iso: string;
  readonly timezone: string;
}

/** Format an instant in an IANA timezone, falling back to UTC on a bad tag. */
export function nowIn(timezone: string, at: Date): NowResult {
  try {
    const iso = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      dateStyle: "short",
      timeStyle: "medium",
    }).format(at);
    return { iso, timezone };
  } catch {
    return { iso: at.toISOString(), timezone: "UTC" };
  }
}

/** Milliseconds until the next multiple of `intervalMs` after `from`. */
export function msUntilNextTick(intervalMs: number, from: number): number {
  if (intervalMs <= 0) return 0;
  return intervalMs - (from % intervalMs);
}

export default {
  name: "@brika/plugin-clock",
  tools: { now: (tz: string) => nowIn(tz, new Date()) },
};
