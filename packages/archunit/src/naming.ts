/**
 * Reusable name patterns for the naming rules, so a convention is written once and shared:
 *
 *   rule().filesMatching("src/adapters").mustBeNamed(kebabFilename()).assert();
 *   rule().filesMatching("src/adapters").classesMustBeNamed(pascalCase).assert();
 *
 * The case patterns match a bare identifier; {@link kebabFilename} matches a whole filename
 * (`mustBeNamed` checks the basename, extension included).
 */

/** PascalCase identifier: an uppercase letter then letters/digits (e.g. `D1ScopeStore`). */
export const pascalCase = /^[A-Z][A-Za-z0-9]*$/;

/** camelCase identifier: a lowercase letter then letters/digits (e.g. `scopeStore`). */
export const camelCase = /^[a-z][A-Za-z0-9]*$/;

/** kebab-case token: lowercase words joined by single hyphens (e.g. `d1-scope-store`). */
export const kebabCase = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * A pattern for a kebab-case filename with one of `extensions` (default `ts`/`tsx`):
 *
 *   kebabFilename()            // d1-scope-store.ts | route.tsx
 *   kebabFilename("css")       // theme.css
 */
export function kebabFilename(...extensions: string[]): RegExp {
  const exts = (extensions.length > 0 ? extensions : ["ts", "tsx"]).join("|");
  return new RegExp(String.raw`^[a-z0-9]+(-[a-z0-9]+)*\.(${exts})$`);
}
