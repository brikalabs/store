import type { z } from "zod";
import { badRequest, httpError, payloadTooLarge } from "./errors";

/**
 * HTTP-boundary helpers shared by every handler, whatever framework owns the routing.
 * They turn the two things a handler does after auth - unwrap a domain result and parse
 * untrusted input - into single expressions that throw an {@link HttpError} on failure, so
 * handler bodies read top-to-bottom with no `if`-guard after each step.
 */

/**
 * Unwrap a domain result at an HTTP boundary: return the success branch, or throw the
 * result's own HTTP status (caught and serialized by the router / handler adapter). Domain
 * results carry their `status` directly, so there is nothing to map - this collapses the
 * `if (!result.ok) throw httpError(...)` guard into:
 *
 *   const { publisher } = okOrThrow(await ctx.scopes.addTrustedPublisher(...));
 */
export function okOrThrow<R extends { readonly ok: true }>(
  result: R | { readonly ok: false; readonly status: number; readonly message: string },
): R {
  if (!result.ok) throw httpError(result.status, result.message);
  return result;
}

/** Validate an already-read value against a schema, or throw a 400. Internal to {@link readBody}. */
function validate<T>(schema: z.ZodType<T>, value: unknown, message: string): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw badRequest(message);
  return parsed.data;
}

/**
 * Read AND validate a JSON request body in one step: `await readBody(request, Schema, "...")`. The
 * boundary counterpart to {@link okOrThrow} for input - a service returns a typed result, but
 * malformed input never reaches it: it is a client error, not a bug. Malformed JSON is a clean 400
 * too (a bare `request.json()` throws a `SyntaxError` that would otherwise surface as a 500). For a
 * handler that parses the body itself (e.g. TanStack); the router's own `route.post({ body })` path
 * validates against the route schema instead.
 */
export async function readBody<T>(
  request: Request,
  schema: z.ZodType<T>,
  message = "Invalid request body",
): Promise<T> {
  const value: unknown = await request.json().catch(() => null);
  return validate(schema, value, message);
}

/**
 * Read a binary upload body, bounded by `maxBytes`. The boundary counterpart to {@link readBody}
 * for a raw byte payload (an avatar, a logo): it rejects an oversize body BEFORE buffering it, by
 * the declared `Content-Length` (a `413`), so a huge upload cannot be pulled into worker memory
 * first and rejected after. It then buffers, rejects an empty body (`400`), and re-checks the
 * actual size (`413`) since `Content-Length` is client-supplied and may be absent or a lie. The
 * caller still validates the bytes' FORMAT (e.g. by magic number) - this only bounds the size.
 */
export async function readBytes(
  request: Request,
  maxBytes: number,
  tooLargeMessage = "Payload too large",
): Promise<Uint8Array<ArrayBuffer>> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) throw payloadTooLarge(tooLargeMessage);
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.byteLength === 0) throw badRequest("Empty upload");
  if (bytes.byteLength > maxBytes) throw payloadTooLarge(tooLargeMessage);
  return bytes;
}
