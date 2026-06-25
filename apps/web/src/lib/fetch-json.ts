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

/**
 * POST a JSON body to a same-origin API route and fold the response into a result: `{ ok: true }`,
 * or `{ ok: false, error }` carrying the server's `{ error }` message. Omit `body` for an empty POST.
 * Lets a mutation hook branch on `ok` instead of re-implementing the fetch + error-read every time.
 */
export async function postJson(
  url: string,
  body?: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await fetch(url, {
    method: "POST",
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.ok) return { ok: true };
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  return { ok: false, error: data.error ?? "Request failed" };
}
