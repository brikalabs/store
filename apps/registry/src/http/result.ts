import { httpError } from "@brika/router";

/**
 * Unwrap a domain result at an HTTP boundary. Returns the success branch, or throws the
 * code-mapped `HttpError` (caught by the router and serialized). This collapses the
 * `if (!result.ok) throw httpError(toStatus(result.code), result.message, result.code)` guard
 * that every handler otherwise repeats, into one call:
 *
 *   const { publisher } = okOrThrow(await ctx.orgs.addTrustedPublisher(...), orgStatus);
 *
 * `toStatus` maps the domain's error code to a status (e.g. `orgStatus`, `manageStatus`), so
 * the helper stays domain-neutral while each call site keeps its own mapping inline.
 */
export function okOrThrow<R extends { readonly ok: true }, C extends string>(
  result: R | { readonly ok: false; readonly code: C; readonly message: string },
  toStatus: (code: C) => number,
): R {
  if (!result.ok) throw httpError(toStatus(result.code), result.message, result.code);
  return result;
}
