import { httpError } from "@brika/router";

/**
 * Unwrap a domain result at an HTTP boundary: return the success branch, or throw the
 * result's own HTTP status (caught by the router and serialized). Domain results carry their
 * `status` directly (a number from `HttpStatus`), so there is nothing to map - this collapses
 * the `if (!result.ok) throw httpError(...)` guard every handler otherwise repeats into:
 *
 *   const { publisher } = okOrThrow(await ctx.orgs.addTrustedPublisher(...));
 */
export function okOrThrow<R extends { readonly ok: true }>(
  result: R | { readonly ok: false; readonly status: number; readonly message: string },
): R {
  if (!result.ok) throw httpError(result.status, result.message);
  return result;
}
