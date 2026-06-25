import type { z } from "zod";
import { badRequest, httpError, payloadTooLarge } from "./errors";

/**
 * HTTP-boundary helpers shared by every handler: they turn unwrapping a domain result and parsing
 * untrusted input into single expressions that throw an {@link HttpError} on failure.
 */

/**
 * Unwrap a domain result at an HTTP boundary: return the success branch, or throw the result's own
 * HTTP status (serialized by the router). Domain results carry their `status`, so nothing is mapped.
 */
export function okOrThrow<R extends { readonly ok: true }>(
  result: R | { readonly ok: false; readonly status: number; readonly message: string },
): R {
  if (!result.ok) throw httpError(result.status, result.message);
  return result;
}

/**
 * Read AND validate a JSON request body in one step, throwing a 400 on malformed input. Malformed
 * JSON is also a clean 400 (a bare `request.json()` throws a `SyntaxError` that would surface as 500).
 */
export async function readBody<T>(
  request: Request,
  schema: z.ZodType<T>,
  message = "Invalid request body",
): Promise<T> {
  const value: unknown = await request.json().catch(() => null);
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw badRequest(message);
  return parsed.data;
}

/**
 * Read AND validate a request's URL query string against a schema, throwing a 400 on bad input.
 * Repeated keys collapse to their last value; a schema field can `z.preprocess` a delimited value
 * (e.g. a comma-separated `tags`) into an array, so the whole query maps to one typed object.
 */
export function readQuery<T>(
  request: Request,
  schema: z.ZodType<T>,
  message = "Invalid query parameters",
): T {
  const params = new URL(request.url).searchParams;
  const parsed = schema.safeParse(Object.fromEntries(params));
  if (!parsed.success) throw badRequest(message);
  return parsed.data;
}

/**
 * Read a binary upload body, bounded by `maxBytes`. Rejects an oversize body (413) by declared
 * `Content-Length` BEFORE buffering, so a huge upload is not pulled into worker memory first, then
 * re-checks the actual size since `Content-Length` is client-supplied and may be absent or a lie.
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
