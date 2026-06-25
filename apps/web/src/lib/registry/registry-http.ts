import type { z } from "zod";

/**
 * The registry HTTP client: the origin, the name predicate, and the two read primitives every
 * registry fetch goes through. Import-safe on the client (the origin is a build-time constant), so
 * the same code runs in the SSR worker and during client navigation.
 */

/** Scope hosted on our registry; everything else federates from npm. */
export const REGISTRY_SCOPE = "@brika/";

/** Public origin of the registry. Overridable for local dev via Vite env. */
export const REGISTRY_ORIGIN: string = new URL(
  (import.meta.env?.VITE_REGISTRY_URL as string | undefined) ?? "https://registry.brika.dev",
).origin;

/** True for names hosted on our registry (the `@brika` scope). */
export function isRegistryName(name: string): boolean {
  return name.startsWith(REGISTRY_SCOPE);
}

/**
 * Fetch from the registry, returning `null` instead of throwing when it is unreachable (a network
 * error / "connection lost"). The store is a read model over the registry's HTTP surface, so a
 * registry outage should degrade a read to its empty fallback rather than crash the page with an
 * unhandled 500. A reached-but-non-2xx response is returned for the caller to branch on.
 */
export async function registryFetch(
  input: string | URL,
  init?: RequestInit,
): Promise<Response | null> {
  try {
    return await fetch(input, init);
  } catch {
    return null;
  }
}

/** A registry query string: each defined, non-empty value becomes one search param (numbers stringified). */
export type RegistryQuery = Record<string, string | number | undefined>;

/**
 * GET a JSON resource from the registry and validate it against `schema`, returning null on any
 * failure (unreachable, non-2xx, or a shape mismatch) so a read degrades to its caller's fallback.
 * `query` entries that are undefined or empty are dropped, so callers pass the raw filter object.
 */
export async function registryGet<T>(
  path: string,
  schema: z.ZodType<T>,
  query?: RegistryQuery,
): Promise<T | null> {
  const url = new URL(`${REGISTRY_ORIGIN}${path}`);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== "") url.searchParams.set(key, String(value));
  }
  const res = await registryFetch(url, { headers: { accept: "application/json" } });
  if (!res?.ok) return null;
  const parsed = schema.safeParse(await res.json());
  return parsed.success ? parsed.data : null;
}
