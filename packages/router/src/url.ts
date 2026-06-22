/**
 * The typed URL layer: a string-only pattern language plus a typed URL builder, with no runtime
 * framework, so the same pattern types a handler's params on the server and builds a URL on the client.
 *
 * A pattern segment is one of:
 *   - static            `users`
 *   - param             `:id`              -> { id: string }
 *   - optional param    `:id?`             -> { id?: string }   (the router expands it)
 *   - constrained param `:id{[0-9]+}`      -> { id: string }    (regex passed to the matcher)
 *   - both              `:scope{@[^/]+}?`  -> { scope?: string }
 */

/** Strip a `{regex}` constraint from a param body: `scope{@[^/]+}` -> `scope`. */
type StripRegex<Body extends string> = Body extends `${infer Name}{${string}` ? Name : Body;

/** One segment's contribution to the params object (static segments contribute nothing). */
type SegmentParams<Segment extends string> = Segment extends `:${infer Body}`
  ? Body extends `${infer Optional}?`
    ? { [K in StripRegex<Optional>]?: string }
    : { [K in StripRegex<Body>]: string }
  : Record<never, never>;

type Params<Path extends string> = Path extends `${infer Head}/${infer Tail}`
  ? SegmentParams<Head> & Params<Tail>
  : SegmentParams<Path>;

/** Flatten an intersection into a single object literal for readable hovers. */
type Simplify<T> = { [K in keyof T]: T[K] } & {};

/**
 * The params a route pattern carries: required (`:p`) are `string`, optional (`:p?`) are
 * `string | undefined`, e.g. `PathParams<"/:scope{@[^/]+}?/:pkg"> -> { scope?: string; pkg: string }`.
 */
export type PathParams<Path extends string> = Simplify<Params<Path>>;

/** Encode one param value for a URL segment. Defaults to {@link encodeURIComponent}. */
export type ParamEncoder = (key: string, value: string) => string;

const defaultEncoder: ParamEncoder = (_key, value) => encodeURIComponent(value);

/** The param name in a `:name`, `:name?`, `:name{re}`, or `:name{re}?` segment. */
function paramKey(segment: string): string {
  const body = segment.endsWith("?") ? segment.slice(1, -1) : segment.slice(1);
  const brace = body.indexOf("{");
  return brace === -1 ? body : body.slice(0, brace);
}

/**
 * Build a concrete path from a route pattern and its params, each value encoded (default
 * `encodeURIComponent`). The param object is typed from the pattern, so a missing/misspelled key
 * fails to compile, e.g. `link("/users/:id", { id: "42" }) -> "/users/42"`.
 */
export function link<P extends string>(
  pattern: P,
  params: PathParams<P>,
  encode: ParamEncoder = defaultEncoder,
): string {
  // PathParams<P> is by construction a record of `string | undefined`; the cast is sound and lets
  // the loop below read params by computed key.
  const values = params as Record<string, string | undefined>;
  const out: string[] = [];
  for (const segment of pattern.split("/")) {
    if (!segment.startsWith(":")) {
      out.push(segment);
      continue;
    }
    const key = paramKey(segment);
    const value = values[key];
    if (value === undefined) {
      if (!segment.endsWith("?")) out.push(""); // a missing required param yields an empty segment
      continue; // an absent optional param drops its segment
    }
    out.push(encode(key, value));
  }
  return out.join("/");
}
