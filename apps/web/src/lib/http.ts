/** JSON helpers for the `/v1` contract handlers. */
import type { ScopeErrorCode } from "@brika/registry-core";

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

/** JSON error at an arbitrary status (e.g. from a `scopeStatus`/`manageStatus` mapping). */
export function jsonError(status: number, message: string): Response {
  return Response.json({ error: message }, { status });
}

/** Map a registry-core `ScopeResult` error code to its HTTP status. */
export function scopeStatus(code: ScopeErrorCode): number {
  if (code === "not_found") return 404;
  if (code === "conflict") return 409;
  if (code === "too_many") return 429;
  return 403;
}

/** Map a registry-core `ManageResult` error code to its HTTP status. */
export function manageStatus(code: "forbidden" | "not_found"): number {
  return code === "not_found" ? 404 : 403;
}
