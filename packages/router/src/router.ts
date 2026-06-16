import type { Context, Env, Hono, MiddlewareHandler } from "hono";
import type { z } from "zod";
import { badRequest, HttpError } from "./errors";
import type { RouterLogger } from "./logger";
import { noContent, reply } from "./response";
import type { PathParams } from "./url";

/**
 * The runtime half of the router: a builder that produces typed routes, a
 * `controller` that groups them (optionally under a shared prefix + middleware),
 * and `mount` that wires them onto a vanilla Hono app. Nothing here subclasses
 * Hono; the app stays `new Hono<E>()` and these are plain functions over it.
 *
 * `createRouter<Ctx, E>()` binds the per-request context type `Ctx` (e.g. a
 * service graph) and the Hono environment `E` once, so every handler it produces
 * receives a typed `ctx`. The actual context value is supplied at `mount` time.
 * Optional path segments (`:p?`) in a pattern are expanded here generically, so
 * patterns like an npm `:scope?/:pkg` need no special routing config.
 */

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;
type Method = (typeof METHODS)[number];

/**
 * A JSON-serializable value a handler may return instead of a `Response`: the
 * router serializes it (200, `cache-control: no-store`). `undefined` becomes 204.
 */
export type RouteValue =
  | null
  | boolean
  | number
  | string
  | readonly RouteValue[]
  | { readonly [key: string]: RouteValue };

/** What a handler may return: a `Response` (full control), a value, or nothing (204). */
export type RouteResult = Response | RouteValue | undefined;

/** Validated, typed inputs handed to a handler, plus the per-request context. */
export interface RouteInput<P extends string, Body, Query, Ctx> {
  /** Path params, typed from the route pattern. */
  readonly params: PathParams<P>;
  /** Query params, parsed by the route's `query` schema (`undefined` if none). */
  readonly query: Query;
  /** The request body, parsed by the route's `body` schema (`undefined` if none). */
  readonly body: Body;
  /** The raw request, for headers (auth) and anything the typed inputs omit. */
  readonly req: Request;
  /** The per-request context built by {@link MountOptions.context}. */
  readonly ctx: Ctx;
  /** `executionCtx.waitUntil`, for work that must outlive the response. */
  readonly waitUntil: (promise: Promise<unknown>) => void;
}

export type RouteHandler<P extends string, Body, Query, Ctx> = (
  input: RouteInput<P, Body, Query, Ctx>,
) => RouteResult | Promise<RouteResult>;

/** A registered route, type-erased over its body/query so a controller holds a mixed list. */
export interface RouteDef<Ctx> {
  readonly method: Method;
  readonly pattern: string;
  readonly bodySchema?: z.ZodType;
  readonly querySchema?: z.ZodType;
  /** The handler function's name, captured for logging (empty for anonymous handlers). */
  readonly handlerName?: string;
  /** Best-effort `file:line:col` where this route was defined, for debugging. */
  readonly source?: string;
  readonly run: (raw: RawInput<Ctx>) => RouteResult | Promise<RouteResult>;
}

interface RawInput<Ctx> {
  readonly params: Record<string, string>;
  readonly query: unknown;
  readonly body: unknown;
  readonly req: Request;
  readonly ctx: Ctx;
  readonly waitUntil: (promise: Promise<unknown>) => void;
}

/** A group of routes, optionally sharing a name, path prefix, and middleware. */
export interface Controller<Ctx, E extends Env> {
  readonly name?: string;
  readonly prefix: string;
  readonly use: readonly MiddlewareHandler<E>[];
  readonly routes: readonly RouteDef<Ctx>[];
}

/** What {@link createRouter}'s `controller` accepts: a bare route list, or a config. */
export interface ControllerConfig<Ctx, E extends Env> {
  /** A label for logs/debugging, e.g. `"packages"`. */
  readonly name?: string;
  /** Prepended to every route's pattern, e.g. `"/-/package"`. Keep it param-free. */
  readonly prefix?: string;
  /** Middleware applied to this controller's routes (scoped by `prefix`). */
  readonly use?: readonly MiddlewareHandler<E>[];
  readonly routes: readonly RouteDef<Ctx>[];
}

/** How `mount` turns a Hono request into the per-request inputs. */
export interface MountOptions<Ctx, E extends Env> {
  /** Build the per-request context (e.g. a service graph) from Hono's Context. */
  readonly context: (c: Context<E>) => Ctx | Promise<Ctx>;
  /** Optional: called once per request with its route, status, and timing. */
  readonly logger?: RouterLogger;
}

/** A registered route, read back from the Hono app: its method and matcher pattern. */
export interface RouteInfo {
  readonly method: string;
  /** The concrete pattern Hono matches, e.g. `/:pkg{[^-][^\x2f]*}` (regex-constrained). */
  readonly pattern: string;
}

/** Extract the `file:line:col` from one `Error.stack` frame. */
function frameLocation(frame: string): string | undefined {
  const inParens = frame.match(/\(([^()]+)\)\s*$/);
  const loc = inParens?.[1] ?? frame.match(/\bat\s+(.+?)\s*$/)?.[1];
  return loc?.replace(/^file:\/\//, "");
}

/** The first non-`node:` frame's file in a stack (no line:col), or "". */
function topFile(stack: string | undefined): string {
  for (const frame of (stack ?? "").split("\n")) {
    const loc = frameLocation(frame);
    if (loc !== undefined && !loc.includes("<anonymous>") && !loc.includes("node:")) {
      return loc.replace(/:\d+(:\d+)?$/, "");
    }
  }
  return "";
}

/** This module's own file (captured from a load-time stack), so we can skip its frames. */
const ROUTER_FILE = topFile(new Error().stack);

/**
 * Best-effort `file:line:col` of the first caller outside this module, captured at
 * definition time (cheap: once per route/controller, never per request). Relies on
 * `Error.stack`, so it shows source paths in dev/tests and in source-mapped builds,
 * and is simply omitted when unavailable.
 */
function callerSource(): string | undefined {
  const stack = new Error().stack;
  if (stack === undefined) return undefined;
  for (const frame of stack.split("\n")) {
    const loc = frameLocation(frame);
    if (loc === undefined || loc.includes("<anonymous>") || loc.includes("node:")) continue;
    if (ROUTER_FILE !== "" && loc.includes(ROUTER_FILE)) continue;
    return loc;
  }
  return undefined;
}

/** The validated type a schema yields (or `undefined` when a route declares none). */
type SchemaOutput<S> = S extends z.ZodType ? z.output<S> : undefined;

/**
 * A route definition as one object: the `path` (params inferred from it), optional
 * `body`/`query` zod schemas (their `z.output` flows into the handler), and the
 * `handler`. `NoInfer<P>` keeps the path literal inferred from `path` alone, never
 * from the handler.
 */
export interface RouteConfig<
  P extends string,
  B extends z.ZodType | undefined,
  Q extends z.ZodType | undefined,
  Ctx,
> {
  readonly path: P;
  readonly body?: B;
  readonly query?: Q;
  readonly handler: RouteHandler<NoInfer<P>, SchemaOutput<B>, SchemaOutput<Q>, Ctx>;
}

function defineRoute<
  Ctx,
  P extends string,
  B extends z.ZodType | undefined,
  Q extends z.ZodType | undefined,
>(method: Method, config: RouteConfig<P, B, Q, Ctx>): RouteDef<Ctx> {
  const { handler } = config;
  return {
    method,
    pattern: config.path,
    bodySchema: config.body,
    querySchema: config.query,
    handlerName: handler.name === "" ? undefined : handler.name,
    source: callerSource(),
    // The single typed boundary of the router: `params` is built from the matched
    // route (its keys proven present, which a dynamic record type cannot express)
    // and `body`/`query` were validated to exactly their schema output just before
    // this runs. The narrowings are sound here and confined to this one closure;
    // every handler stays fully typed and cast-free.
    run: (raw) =>
      handler({
        params: raw.params as PathParams<P>,
        query: raw.query as SchemaOutput<Q>,
        body: raw.body as SchemaOutput<B>,
        req: raw.req,
        ctx: raw.ctx,
        waitUntil: raw.waitUntil,
      }),
  };
}

/** Parse the JSON body against a schema (throwing a 400 on failure), or pass `undefined`. */
async function parseBody(c: Context, schema: z.ZodType | undefined): Promise<unknown> {
  if (schema === undefined) return undefined;
  const raw: unknown = await c.req.raw
    .clone()
    .json()
    .catch(() => null);
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw badRequest("Invalid request body");
  return parsed.data;
}

/** Parse the query string against a schema (throwing a 400 on failure), or pass `undefined`. */
function parseQuery(c: Context, schema: z.ZodType | undefined): unknown {
  if (schema === undefined) return undefined;
  const entries = Object.fromEntries(new URL(c.req.url).searchParams);
  const parsed = schema.safeParse(entries);
  if (!parsed.success) throw badRequest("Invalid query parameters");
  return parsed.data;
}

/**
 * Expand a pattern's optional params (`:p?`) into the concrete patterns to
 * register: one with each optional present (its `?` dropped) and one without.
 * `n` optional segments yield `2^n` patterns; a pattern with none passes through.
 * This is what lets a leading or middle optional segment work even though the
 * underlying Hono matcher has no native optional-segment support.
 */
function expandOptional(pattern: string): string[] {
  let variants: string[][] = [[]];
  for (const segment of pattern.split("/")) {
    if (segment.startsWith(":") && segment.endsWith("?")) {
      const present = segment.slice(0, -1);
      variants = variants.flatMap((segments) => [[...segments, present], [...segments]]);
    } else {
      variants = variants.map((segments) => [...segments, segment]);
    }
  }
  return variants.map((segments) => segments.join("/"));
}

/** The client IP, from Cloudflare's `CF-Connecting-IP` or the first `X-Forwarded-For` hop. */
function clientIpOf(req: Request): string | undefined {
  const direct = req.headers.get("cf-connecting-ip");
  if (direct !== null) return direct;
  const forwarded = req.headers.get("x-forwarded-for");
  return forwarded === null ? undefined : forwarded.split(",")[0]?.trim();
}

/** Serialize a handler's result: a `Response` passes through, `undefined` is 204, a value is JSON. */
function toResponse(result: RouteResult): Response {
  if (result instanceof Response) return result;
  if (result === undefined) return noContent();
  return reply(result, 200);
}

/** Strip `{regex}` constraints from a pattern for display: `:pkg{[^-]+}?` -> `:pkg?`. */
export function simplifyPattern(pattern: string): string {
  return pattern.replace(/\{[^}]*\}/g, "");
}

export interface FormatRoutesOptions {
  /**
   * `"simple"` (default): each route's `{regex}` constraints are stripped for a
   * clean read (`:scope/:pkg`). `"verbose"`: the raw matcher patterns as Hono
   * holds them (`:pkg{[^-][^\x2f]*}`).
   */
  readonly mode?: "simple" | "verbose";
}

/** Render a route list (from `routes(app)`) as aligned `METHOD  pattern` lines, for debugging. */
export function formatRoutes(
  infos: readonly RouteInfo[],
  options: FormatRoutesOptions = {},
): string {
  const verbose = options.mode === "verbose";
  const width = infos.reduce((max, info) => Math.max(max, info.method.length), 0);
  return infos
    .map((info) => {
      const pattern = verbose ? info.pattern : simplifyPattern(info.pattern);
      return `${info.method.padEnd(width)}  ${pattern}`;
    })
    .join("\n");
}

/**
 * Create a router bound to a per-request context type `Ctx` and Hono environment
 * `E`. Returns the route builder, the `controller` grouping helper, and `mount`.
 */
export function createRouter<Ctx, E extends Env = Env>() {
  const route = {
    get: <
      P extends string,
      B extends z.ZodType | undefined = undefined,
      Q extends z.ZodType | undefined = undefined,
    >(
      config: RouteConfig<P, B, Q, Ctx>,
    ): RouteDef<Ctx> => defineRoute("GET", config),
    post: <
      P extends string,
      B extends z.ZodType | undefined = undefined,
      Q extends z.ZodType | undefined = undefined,
    >(
      config: RouteConfig<P, B, Q, Ctx>,
    ): RouteDef<Ctx> => defineRoute("POST", config),
    put: <
      P extends string,
      B extends z.ZodType | undefined = undefined,
      Q extends z.ZodType | undefined = undefined,
    >(
      config: RouteConfig<P, B, Q, Ctx>,
    ): RouteDef<Ctx> => defineRoute("PUT", config),
    patch: <
      P extends string,
      B extends z.ZodType | undefined = undefined,
      Q extends z.ZodType | undefined = undefined,
    >(
      config: RouteConfig<P, B, Q, Ctx>,
    ): RouteDef<Ctx> => defineRoute("PATCH", config),
    delete: <
      P extends string,
      B extends z.ZodType | undefined = undefined,
      Q extends z.ZodType | undefined = undefined,
    >(
      config: RouteConfig<P, B, Q, Ctx>,
    ): RouteDef<Ctx> => defineRoute("DELETE", config),
  };

  /** Group routes into a controller: a bare route list, or `{ name?, prefix?, use?, routes }`. */
  function controller(config: ControllerConfig<Ctx, E> | RouteDef<Ctx>[]): Controller<Ctx, E> {
    if (Array.isArray(config)) return { prefix: "", use: [], routes: config };
    return {
      name: config.name,
      prefix: config.prefix ?? "",
      use: config.use ?? [],
      routes: config.routes,
    };
  }

  /** Mount controllers onto a Hono app, applying prefixes, middleware, and validation. */
  function mount(
    app: Hono<E>,
    controllers: readonly Controller<Ctx, E>[],
    options: MountOptions<Ctx, E>,
  ): Hono<E> {
    for (const ctrl of controllers) {
      for (const middleware of ctrl.use) app.use(`${ctrl.prefix}/*`, middleware);
      for (const def of ctrl.routes) {
        const pattern = `${ctrl.prefix}${def.pattern}`;
        for (const honoPattern of expandOptional(pattern)) {
          app.on(def.method, honoPattern, async (c) => {
            const start = performance.now();
            let status = 500;
            let unexpected: unknown;
            try {
              const ctx = await options.context(c);
              const body = await parseBody(c, def.bodySchema);
              const query = parseQuery(c, def.querySchema);
              const response = toResponse(
                await def.run({
                  params: c.req.param(),
                  query,
                  body,
                  ctx,
                  req: c.req.raw,
                  waitUntil: (promise) => c.executionCtx.waitUntil(promise),
                }),
              );
              status = response.status;
              return response;
            } catch (error) {
              if (error instanceof HttpError) {
                status = error.status;
                return reply(error.body, error.status);
              }
              unexpected = error;
              throw error;
            } finally {
              if (options.logger !== undefined) {
                options.logger({
                  method: def.method,
                  pattern,
                  path: new URL(c.req.url).pathname,
                  status,
                  durationMs: performance.now() - start,
                  controller: ctrl.name,
                  handler: def.handlerName,
                  source: def.source,
                  clientIp: clientIpOf(c.req.raw),
                  error: unexpected,
                });
              }
            }
          });
        }
      }
    }
    return app;
  }

  /**
   * The routes actually registered on a Hono app (read from `app.routes`), for
   * debugging: the real source of truth, so it includes routes added directly
   * (e.g. `app.get("/")`) and the concrete patterns each `mount` produced.
   * Middleware (`app.use`, method `ALL`) is omitted; duplicates are collapsed.
   * Call after mounting.
   */
  function routes(app: Hono<E>): RouteInfo[] {
    const seen = new Set<string>();
    const infos: RouteInfo[] = [];
    for (const entry of app.routes) {
      if (entry.method === "ALL") continue;
      const key = `${entry.method} ${entry.path}`;
      if (seen.has(key)) continue;
      seen.add(key);
      infos.push({ method: entry.method, pattern: entry.path });
    }
    return infos;
  }

  /**
   * Log a Hono app's registered routes as an aligned table. A one-call debugging
   * aid: `logRoutes(app)` prints the simple form; pass `{ mode: "verbose" }` for
   * the raw matcher patterns, or `{ log }` to send the table elsewhere than
   * `console.log`. Call after mounting.
   */
  function logRoutes(
    app: Hono<E>,
    options: FormatRoutesOptions & { log?: (table: string) => void } = {},
  ): void {
    (options.log ?? console.log)(formatRoutes(routes(app), options));
  }

  return { route, controller, mount, routes, logRoutes };
}
