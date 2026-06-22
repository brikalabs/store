import type { z } from "zod";

/** Fetch + validate JSON on the client; returns `null` on any network/JSON/validation failure,
 * so callers never special-case the error path. */
export async function fetchJson<T>(
  url: string,
  schema: z.ZodType<T>,
  init?: RequestInit,
): Promise<T | null> {
  try {
    const res = await fetch(url, init);
    const parsed = schema.safeParse(await res.json());
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
