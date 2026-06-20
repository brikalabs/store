/** Shared client helpers for the console's org management cards (`components/org/*`). */

/** Build a path under an org's console API, e.g. `orgPath("acme", "/domains")`. */
export function orgPath(org: string, path = ""): string {
  return `/api/orgs/${encodeURIComponent(org)}${path}`;
}

/** Extract the `{ error }` message from a failed JSON response, with a sane fallback. */
export async function readError(res: Response): Promise<string> {
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  return data.error ?? "Request failed";
}

/** Common props for an admin-gated org management card: the slug + an error sink. */
export interface OrgCardProps {
  readonly org: string;
  readonly onError: (message: string) => void;
}
