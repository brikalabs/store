import { link, type ParamEncoder, type PathParams } from "./url";

/**
 * The npm package-name preset for the router: an npm name is one URL segment when unscoped or
 * `%2f`-encoded, but two when scoped. {@link PKG} expresses both as an optional-scope pattern.
 */

/**
 * The package-name pattern fragment: an optional `@scope` segment and the name segment (constrained
 * not to start with `-`, the reserved `/-/...` namespace), so the route is not a catch-all. Read the
 * result with {@link packageName}. "Not a slash" is `\x2f` not `/` so the pattern still tokenizes on `/`.
 */
// The literal type annotation pins the exact pattern string for type-level `PathParams` inference
// (the value otherwise widens to `string`); `String.raw` + no-substitution template keep the runtime
// value identical to the annotated literal, so the cast is sound.
export const PKG =
  String.raw`:scope{@[^\x2f]+}?/:pkg{[^-][^\x2f]*}` as ":scope{@[^\\x2f]+}?/:pkg{[^-][^\\x2f]*}";

/** Matched {@link PKG} params: `scope` is present only for the scoped two-segment form. */
export interface PackageParams {
  readonly scope?: string;
  readonly pkg: string;
}

/** Join matched {@link PKG} params into the full npm name (`@scope/pkg`, or `pkg`). */
export function packageName({ scope, pkg }: PackageParams): string {
  return scope === undefined ? pkg : `${scope}/${pkg}`;
}

/**
 * Encode an npm package name as a single URL path segment: a scoped name keeps its `@` literal and
 * percent-encodes only the separating slash (`@brika%2Fclay`), the npm-compatible form.
 */
export function encodePackageName(name: string): string {
  return name.replace("/", "%2F");
}

const npmEncoder: ParamEncoder = (key, value) =>
  key === "name" ? encodePackageName(value) : encodeURIComponent(value);

/**
 * Build a path to a registry route, encoding a `:name` param as a single npm-style segment, e.g.
 * `npmLink("/-/v1/downloads/:name", { name: "@brika/clay" }) -> "/-/v1/downloads/@brika%2Fclay"`.
 */
export function npmLink<P extends string>(pattern: P, params: PathParams<P>): string {
  return link(pattern, params, npmEncoder);
}
