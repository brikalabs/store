/**
 * Small response constructors so handlers do not hand-roll `Response`/headers. A
 * handler can still return a raw `Response` (for streaming or bespoke headers);
 * these just cover the common shapes.
 */

export interface ResponseInit {
  readonly status?: number;
  readonly headers?: Record<string, string>;
}

/** A JSON response. */
export function json(data: unknown, init: ResponseInit = {}): Response {
  return Response.json(data, { status: init.status ?? 200, headers: init.headers });
}

/**
 * A JSON response marked `cache-control: no-store`, the safe default for mutations and error replies
 * (and how the router serializes a thrown `HttpError`). Extra `headers` are merged in (e.g. `Retry-After`).
 */
export function reply(data: unknown, status = 200, headers?: Record<string, string>): Response {
  return Response.json(data, { status, headers: { "cache-control": "no-store", ...headers } });
}

/** A 201 Created JSON response (`cache-control: no-store`). */
export function created(data: unknown): Response {
  return reply(data, 201);
}

/**
 * A 500 response exposing a thrown value's message + stack. LOCAL-DEV ONLY: a stack leaks internals,
 * so callers MUST gate this behind a dev check and never serve it in production. Used for the
 * non-`HttpError` "real bug" path, where the bare message + stack is what makes the failure debuggable.
 */
export function devError(error: unknown): Response {
  const err = error instanceof Error ? error : new Error(String(error));
  return reply({ error: err.message, stack: err.stack?.split("\n") }, 500);
}

/** A plain-text response. */
export function text(body: string, init: ResponseInit = {}): Response {
  return new Response(body, {
    status: init.status ?? 200,
    headers: { "content-type": "text/plain; charset=utf-8", ...init.headers },
  });
}

/** A 204 No Content response. */
export function noContent(headers?: Record<string, string>): Response {
  return new Response(null, { status: 204, headers });
}
