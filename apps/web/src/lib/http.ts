/** JSON helpers for the `/v1` contract handlers. */

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

/** JSON error at an arbitrary status (e.g. a domain result's `status`). */
export function jsonError(status: number, message: string): Response {
  return Response.json({ error: message }, { status });
}
