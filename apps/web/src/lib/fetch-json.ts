import type { z } from "zod";

/**
 * Fetch + validate JSON on the client: GET `url`, parse the body with `schema`, and return the
 * validated value - or `null` on ANY network / JSON / validation failure, so callers never
 * special-case the error path. The shared leaf of the client data hooks; each hook keeps its own
 * caching/debounce/state on top.
 */
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
