/**
 * Request logging for the router. Because `mount` wraps every handler, it logs what Hono's generic
 * logger cannot: the matched route *pattern* and the controller + handler that served it.
 */

/** One logged request: its route, the code that served it, the client, and the outcome. */
export interface RouteLogEntry {
  readonly method: string;
  /** The route pattern that matched, e.g. `/-/package/:scope?/:pkg/:version/deprecate`. */
  readonly pattern: string;
  readonly path: string;
  readonly status: number;
  readonly durationMs: number;
  /** The controller's `name`, when set. */
  readonly controller?: string;
  /** The handler function's name, when it has one. */
  readonly handler?: string;
  /** Best-effort `file:line:col` where the route was defined, for finding the code. */
  readonly source?: string;
  /** The client IP, from `CF-Connecting-IP` / `X-Forwarded-For`, when present. */
  readonly clientIp?: string;
  /** Set when the handler threw something other than a handled `HttpError`. */
  readonly error?: unknown;
}

export type RouterLogger = (entry: RouteLogEntry) => void;

export type LogLevel = "info" | "warn" | "error";

/** `error` for a thrown error or 5xx, `warn` for other >=400, else `info`. */
export function levelFor(entry: RouteLogEntry): LogLevel {
  if (entry.error !== undefined || entry.status >= 500) return "error";
  if (entry.status >= 400) return "warn";
  return "info";
}

/** The structured record {@link jsonLogger} emits (a stable, ingest-friendly shape). */
export interface JsonLogRecord {
  readonly timestamp: string;
  readonly level: LogLevel;
  readonly message: string;
  readonly http: {
    readonly method: string;
    readonly url: string;
    readonly status_code: number;
    readonly duration_ms: number;
    readonly route?: string;
  };
  readonly code_context?: {
    readonly controller?: string;
    readonly handler?: string;
    readonly source?: string;
  };
  readonly network?: { readonly client_ip?: string };
  readonly error?: string;
}

/** Stringify a thrown value: an `Error` becomes its stack, else JSON, with a `String()` fallback. */
function stringifyError(error: unknown): string {
  if (error instanceof Error) return error.stack ?? error.message;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

/** Build the structured record for an entry (exposed so a custom logger can reuse it). */
export function toJsonRecord(entry: RouteLogEntry, message: string): JsonLogRecord {
  return {
    timestamp: new Date().toISOString(),
    level: levelFor(entry),
    message,
    http: {
      method: entry.method,
      url: entry.path,
      status_code: entry.status,
      duration_ms: Number(entry.durationMs.toFixed(1)),
      route: entry.pattern === entry.path ? undefined : entry.pattern,
    },
    code_context:
      entry.controller === undefined && entry.handler === undefined && entry.source === undefined
        ? undefined
        : { controller: entry.controller, handler: entry.handler, source: entry.source },
    network: entry.clientIp === undefined ? undefined : { client_ip: entry.clientIp },
    error: entry.error === undefined ? undefined : stringifyError(entry.error),
  };
}

/** A {@link RouterLogger} that emits one structured JSON line per request, at a console level by outcome. */
export function jsonLogger(message = "request"): RouterLogger {
  return (entry) => {
    const record = toJsonRecord(entry, message);
    const line = JSON.stringify(record);
    if (record.level === "error") console.error(line);
    else if (record.level === "warn") console.warn(line);
    else console.log(line);
  };
}
