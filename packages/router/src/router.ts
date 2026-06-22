import { callerFrame, moduleFile } from "@brika/stack";
import type { Context, Env, Hono, MiddlewareHandler } from "hono";
import type { z } from "zod";
import { badRequest, HttpError } from "./errors";
import type { RouterLogger } from "./logger";
import { noContent, reply } from "./response";
import type { PathParams } from "./url";

/**
 * The runtime half of the router: a typed route builder, a `controller` that
 * groups routes, and `mount` that wires them onto a vanilla Hono app. Nothing
 * subclasses Hono; these are plain functions over `new Hono<E>()`.
 */

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;
type Method = (typeof METHODS)[number];

/** A JSON-serializable value a handler may return: serialized as 200 (`undefined` becomes 204). */
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

/** Inputs handed to a {@link Middleware}: raw (untyped) params/query/body plus `ctx` and request. */
export interface MiddlewareInput<Ctx> {
  readonly params: Record<string, string>;
  readonly query: unknown;
  readonly body: unknown;
  readonly req: Request;
  readonly ctx: Ctx;
  readonly waitUntil: (promise: Promise<unknown>) => void;
}

/**
 * A typed pre-handler middleware for a route. Runs AFTER the per-request context is built
 * (so it can read the typed `ctx`) and throws an {@link HttpError} to abort.
 */
export type Middleware<Ctx> = (input: MiddlewareInput<Ctx>) => void | Promise<void>;

/** A registered route, type-erased over its body/query so a controller holds a mixed list. */
export interface RouteDef<Ctx> {
  readonly method: Method;
  readonly pattern: string;
  readonly bodySchema?: z.ZodType;
  readonly querySchema?: z.ZodType;
  /** Typed pre-handler middleware for this route, run before the handler. */
  readonly middleware?: readonly Middleware<Ctx>[];
  /** The handler function's name, captured for logging (empty for anonymous handlers). */
  readonly handlerName?: string;
  /** Best-effort `file:line:col` where this route was defined, for debugging. */
  readonly source?: string;
  readonly run: (raw: MiddlewareInput<Ctx>) => RouteResult | Promise<RouteResult>;
}

/** A group of routes, optionally sharing a name, path prefix, and Hono middleware. */
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
  /**
   * Hono middleware for this controller's routes (scoped by `prefix`). Runs BEFORE the
   * per-request context is built, so it sees `c.env` but not `ctx`; use it for CORS etc.
   */
  readonly use?: readonly MiddlewareHandler<E>[];
  readonly routes: readonly RouteDef<Ctx>[];
}

/** How `mount` turns a Hono request into the per-request inputs. */
export interface MountOptions<Ctx, E extends Env> {
  /**
   * Build the per-request context from Hono's Context. Optional: omit it when handlers resolve
   * dependencies another way (e.g. `inject()` inside {@link around}), in which case `ctx` is `undefined`.
   */
  readonly context?: (c: Context<E>) => Ctx | Promise<Ctx>;
  /**
   * Wrap handler (and route-middleware) execution: the seam for running each request inside a
   * surrounding scope, e.g. a `@brika/di` injection context. Keeps the router free of any DI dependency.
   */
  readonly around?: (c: Context<E>, run: () => Promise<Response>) => Promise<Response>;
  /** Optional: called once per request with its route, status, and timing. */
  readonly logger?: RouterLogger;
}

/** A registered route, read back from the Hono app: its method and matcher pattern. */
export interface RouteInfo {
  readonly method: string;
  /** The concrete pattern Hono matches, e.g. `/:pkg{[^-][^\x2f]*}` (regex-constrained). */
  readonly pattern: string;
}

/** This module's own file (captured from a load-time stack), so we can skip its frames. */
const ROUTER_FILE = moduleFile(new Error("router module location probe").stack);

/** Best-effort `file:line:col` of the first caller outside this module, captured at definition time. */
function callerSource(): string | undefined {
  return callerFrame(new Error("router caller probe").stack, ROUTER_FILE);
}

/** The validated type a schema yields (or `undefined` when a route declares none). */
type SchemaOutput<S> = S extends z.ZodType ? z.output<S> : undefined;

/**
 * A route definition as one object: `path` (params inferred from it), optional `body`/`query` zod
 * schemas (their `z.output` flows into the handler), and `handler`. `NoInfer<P>` pins the path literal.
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
  /** Typed pre-handler middleware for this route (sees `ctx`); run after the controller's. */
  readonly middleware?: readonly Middleware<Ctx>[];
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
    middleware: config.middleware,
    handlerName: handler.name === "" ? undefined : handler.name,
    source: callerSource(),
    // The single typed boundary of the router: the narrowings are sound (`params` keys are
    // proven present by the match; `body`/`query` were just validated to their schema output)
    // and confined to this closure, so every handler stays fully typed and cast-free.
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
 * Expand a pattern's optional params (`:p?`) into the `2^n` concrete patterns to register
 * (each optional present and absent), so leading/middle optionals work despite Hono having no
 * native optional-segment support. An expansion that collapses to `""` is dropped: it would
 * otherwise bind the handler to the root `/`, never the intent.
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
  return variants.map((segments) => segments.join("/")).filter((p) => p !== "");
}

/** The client IP, from Cloudflare's `CF-Connecting-IP` or the first `X-Forwarded-For` hop. */
function clientIp(req: Request): string | undefined {
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

/** Run the route's typed middleware in order (a throw aborts via the caller's catch), then the handler. */
async function dispatch<Ctx>(
  middleware: readonly Middleware<Ctx>[],
  run: (input: MiddlewareInput<Ctx>) => RouteResult | Promise<RouteResult>,
  input: MiddlewareInput<Ctx>,
): Promise<Response> {
  for (const mw of middleware) await mw(input);
  return toResponse(await run(input));
}

/**
 * Run one matched request: build the context, validate body/query, run the middleware + handler,
 * translate an {@link HttpError} into a response (any other throw propagates to Hono), and log the
 * outcome exactly once in the `finally`.
 */
async function handleRequest<Ctx, E extends Env>(
  c: Context<E>,
  route: {
    readonly def: RouteDef<Ctx>;
    readonly ctrl: Controller<Ctx, E>;
    readonly pattern: string;
  },
  middleware: readonly Middleware<Ctx>[],
  options: MountOptions<Ctx, E>,
): Promise<Response> {
  const { def, ctrl, pattern } = route;
  const start = performance.now();
  let status = 500;
  let unexpected: unknown;
  try {
    // `ctx` is undefined when no `context` factory is set (handlers use `inject()` instead).
    const ctx = options.context ? await options.context(c) : (undefined as Ctx);
    const body = await parseBody(c, def.bodySchema);
    const query = parseQuery(c, def.querySchema);
    // When an `around` wrapper is set, middleware + handler run inside it (e.g. an injection context).
    const exec = (): Promise<Response> =>
      dispatch(middleware, def.run, {
        params: c.req.param(),
        query,
        body,
        ctx,
        req: c.req.raw,
        waitUntil: (promise: Promise<unknown>) => c.executionCtx.waitUntil(promise),
      });
    const response = options.around ? await options.around(c, exec) : await exec();
    status = response.status;
    return response;
  } catch (error) {
    if (error instanceof HttpError) {
      status = error.status;
      return reply(error.body, error.status, error.headers);
    }
    unexpected = error;
    throw error;
  } finally {
    options.logger?.({
      method: def.method,
      pattern,
      path: new URL(c.req.url).pathname,
      status,
      durationMs: performance.now() - start,
      controller: ctrl.name,
      handler: def.handlerName,
      source: def.source,
      clientIp: clientIp(c.req.raw),
      error: unexpected,
    });
  }
}

/** Strip `{regex}` constraints from a pattern for display: `:pkg{[^-]+}?` -> `:pkg?`. */
export function simplifyPattern(pattern: string): string {
  return pattern.replace(/\{[^}]*\}/g, "");
}

export interface FormatRoutesOptions {
  /** `"simple"` (default) strips `{regex}` constraints; `"verbose"` shows Hono's raw matcher patterns. */
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
        const middleware = def.middleware ?? [];
        for (const honoPattern of expandOptional(pattern)) {
          app.on(def.method, honoPattern, (c) =>
            handleRequest(c, { def, ctrl, pattern }, middleware, options),
          );
        }
      }
    }
    return app;
  }

  /**
   * The routes actually registered on a Hono app (read from `app.routes`), for debugging:
   * includes directly-added routes and the concrete patterns each `mount` produced. Middleware
   * and method `ALL` are omitted; duplicates collapsed. Call after mounting.
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

  /** Log a Hono app's registered routes as an aligned table (debugging aid). Call after mounting. */
  function logRoutes(
    app: Hono<E>,
    options: FormatRoutesOptions & { log?: (table: string) => void } = {},
  ): void {
    (options.log ?? console.log)(formatRoutes(routes(app), options));
  }

  return { route, controller, mount, routes, logRoutes };
}
