/**
 * The HTTP layer's error channel. A handler `throw`s an {@link HttpError} (usually
 * via one of the helpers below) to abort a request with a specific status; the
 * router catches it and serializes it, so handlers express failures as guard
 * clauses instead of threading a `Response` back by hand.
 *
 * Anything thrown that is not an `HttpError` is treated as a bug and surfaces as a
 * 500 (the router rethrows it for the platform to log).
 */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
  ) {
    super(message);
    this.name = "HttpError";
  }

  /** The JSON body served for this error: `{ error }`, plus `code` when present. */
  get body(): { error: string; code?: string } {
    return this.code === undefined
      ? { error: this.message }
      : { error: this.message, code: this.code };
  }
}

/** Throwable with an arbitrary status, e.g. when mapping a domain result code. */
export function httpError(status: number, message: string, code?: string): HttpError {
  return new HttpError(status, message, code);
}

/** 400: the request was malformed or failed an invariant. */
export function badRequest(message = "Bad request", code?: string): HttpError {
  return new HttpError(400, message, code);
}

/** 401: no valid credential was presented. */
export function unauthorized(message = "Unauthorized"): HttpError {
  return new HttpError(401, message);
}

/** 403: authenticated, but not allowed to do this. */
export function forbidden(message = "Forbidden", code?: string): HttpError {
  return new HttpError(403, message, code);
}

/** 404: no such resource. */
export function notFound(message = "Not found"): HttpError {
  return new HttpError(404, message);
}

/** 409: the request conflicts with current state (e.g. an immutable already exists). */
export function conflict(message = "Conflict", code?: string): HttpError {
  return new HttpError(409, message, code);
}
