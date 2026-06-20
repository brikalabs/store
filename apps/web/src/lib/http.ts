/** JSON helpers for the `/v1` contract handlers. */
import type { ManageErrorCode, OrgErrorCode } from "@brika/registry-core";

export function jsonOk(data: unknown): Response {
  return Response.json(data, { headers: { "cache-control": "public, max-age=300" } });
}

export function jsonNotFound(): Response {
  return Response.json({ error: "Not found" }, { status: 404 });
}

export function jsonBadRequest(message: string): Response {
  return Response.json({ error: message }, { status: 400 });
}

export function jsonUnauthorized(): Response {
  return Response.json({ error: "Sign in required" }, { status: 401 });
}

export function jsonForbidden(message: string): Response {
  return Response.json({ error: message }, { status: 403 });
}

export function jsonConflict(message: string): Response {
  return Response.json({ error: message }, { status: 409 });
}

/** Private JSON success for authenticated console endpoints (never cached). */
export function jsonPrivate(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: { "cache-control": "no-store" } });
}

/** JSON error at an arbitrary status (e.g. from an `orgStatus`/`manageStatus` mapping). */
export function jsonError(status: number, message: string): Response {
  return Response.json({ error: message }, { status });
}

/**
 * The one canonical mapping from a registry-core domain error code to its real HTTP status.
 * Every domain code IS an HTTP-semantic name, so a single exhaustive table covers them all
 * (`satisfies Record<…>` makes a new, unmapped code a compile error). `orgStatus` /
 * `manageStatus` are thin typed views over it for their respective result codes.
 */
const HTTP_STATUS = {
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  too_many: 429,
} satisfies Record<OrgErrorCode | ManageErrorCode, number>;

export function orgStatus(code: OrgErrorCode): number {
  return HTTP_STATUS[code];
}

export function manageStatus(code: ManageErrorCode): number {
  return HTTP_STATUS[code];
}
