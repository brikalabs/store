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
 * A JSON response marked `cache-control: no-store`, the safe default for mutations
 * and error replies (and what the router uses to serialize a thrown `HttpError`).
 */
export function reply(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: { "cache-control": "no-store" } });
}

/** A 201 Created JSON response (`cache-control: no-store`). */
export function created(data: unknown): Response {
  return reply(data, 201);
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
