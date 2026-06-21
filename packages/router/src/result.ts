import type { z } from "zod";
import { badRequest, httpError } from "./errors";

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

/**
 * Parse untrusted input against a schema, or throw a 400 {@link HttpError}. The boundary
 * counterpart to {@link okOrThrow}: a service returns a typed result, but malformed input
 * never reaches the service - it is a client error, not a bug. Used where the framework does
 * not pre-validate the body (e.g. a TanStack handler reading `await request.json()`).
 */
export function parseBody<T>(
  schema: z.ZodType<T>,
  value: unknown,
  message = "Invalid request body",
): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw badRequest(message);
  return parsed.data;
}
