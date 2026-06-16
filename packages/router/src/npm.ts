import { link, type ParamEncoder, type PathParams } from "./url";

/**
 * The npm package-name preset for the router. An npm name is one URL segment when
 * unscoped (`react`) or `%2f`-encoded (`@brika%2fclay`), but two segments when
 * scoped (`@brika/clay`). {@link PKG} expresses both at once as an optional-scope
 * pattern segment the router expands generically; a handler turns the matched
 * params into the full name with {@link packageName}. On a client, build URLs with
 * {@link npmLink}. There is no routing config: it is all in the pattern string.
 */

/**
 * The package-name pattern fragment: an optional `@scope` segment (constrained to
 * start with `@`) and the name segment (constrained not to start with `-`, the
 * reserved `/-/...` namespace). The constraints keep the route from matching
 * reserved or unrelated paths, so it is not a catch-all. Drop it into a route,
 * e.g. `` `/-/v1/downloads/${PKG}` `` or `` `/${PKG}/-/:file` ``, and read the
 * result with {@link packageName}.
 *
 * "Not a slash" is written `\x2f` rather than the literal `/` so the pattern can
 * still be tokenized by splitting on `/`; the matcher reads it as `/`.
 */
export const PKG = ":scope{@[^\\x2f]+}?/:pkg{[^-][^\\x2f]*}";

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
 * Encode an npm package name as a single URL path segment: a scoped name keeps its
 * `@` literal and percent-encodes only the separating slash (`@brika%2Fclay`), the
 * npm-compatible form the registry resolves (it matches the unscoped one-segment
 * form of {@link PKG}).
 */
export function encodePackageName(name: string): string {
  return name.replace("/", "%2F");
}

const npmEncoder: ParamEncoder = (key, value) =>
  key === "name" ? encodePackageName(value) : encodeURIComponent(value);

/**
 * Build a path to a registry route, encoding a `:name` param as a single npm-style
 * segment. The pattern's params are typed at the call site.
 *
 *   npmLink("/-/v1/downloads/:name", { name: "@brika/clay" })
 *     -> "/-/v1/downloads/@brika%2Fclay"
 */
export function npmLink<P extends string>(pattern: P, params: PathParams<P>): string {
  return link(pattern, params, npmEncoder);
}
