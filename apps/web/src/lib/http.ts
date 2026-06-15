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
