/**
 * Scope + package-name rules: the single source of truth for what a valid name is. Restricting to a
 * lowercase ASCII shape stops scope-confusion impersonation: a case variant (`@Brika`) or homoglyph
 * (`@brіka` with a Cyrillic letter) can neither be created nor published to.
 */

/** The `@scope` segment of a package name, or null when the name is unscoped. */
export function scopeOf(name: string): string | null {
  return name.startsWith("@") ? (name.split("/")[0] ?? null) : null;
}

// `@` + 2-20 chars of lowercase a-z/0-9/hyphen, not starting with a hyphen.
const SCOPE = /^@[a-z0-9][a-z0-9-]{1,19}$/;

/** Is this a canonical, creatable scope (`@name`)? */
export function isCanonicalScope(scope: string): boolean {
  return SCOPE.test(scope);
}

// A canonical scope then `/name`. The name segment uses the SAME lowercase `a-z0-9-` charset as the
// manifest `name` rule, so the canonical check and the manifest gate never disagree on a character.
const CANONICAL_NAME = /^@[a-z0-9][a-z0-9-]{1,19}\/[a-z0-9][a-z0-9-]*$/;

/** Is this a canonical scoped package name (the only kind the registry publishes)? */
export function isCanonicalName(name: string): boolean {
  return name.length <= 214 && CANONICAL_NAME.test(name);
}
