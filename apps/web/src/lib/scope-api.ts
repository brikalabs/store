/** Shared client helpers for the console's scope management cards (`components/scope/*`). */

/** Build a path under a scope's console API, e.g. `scopePath("@brika", "/domains")`. */
export function scopePath(scope: string, path = ""): string {
  return `/api/scopes/${encodeURIComponent(scope)}${path}`;
}

/** Extract the `{ error }` message from a failed JSON response, with a sane fallback. */
export async function readError(res: Response): Promise<string> {
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  return data.error ?? "Request failed";
}

/** Common props for an admin-gated scope management card: the scope + an error sink. */
export interface ScopeCardProps {
  readonly scope: string;
  readonly onError: (message: string) => void;
}
