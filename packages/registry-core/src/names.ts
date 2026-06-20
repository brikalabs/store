/**
 * Scope + package-name rules: the single source of truth for what a valid name is, so
 * the publish gate, the ownership policy, and the scope-management endpoints all agree.
 * Restricting to a lowercase ASCII shape (and rejecting everything else at the door) is
 * what stops scope-confusion impersonation: a case variant (`@Brika`) or a homoglyph
 * (`@brіka` with a Cyrillic letter) can neither be created nor published to.
 */

/** The `@scope` segment of a package name, or null when the name is unscoped. */
export function scopeOf(name: string): string | null {
  return name.startsWith("@") ? (name.split("/")[0] ?? null) : null;
}

// A scope is `@` + 2-20 chars of lowercase a-z/0-9/hyphen, not starting with a hyphen
// Globally unique, claimed only by explicit creation.
const SCOPE = /^@[a-z0-9][a-z0-9-]{1,19}$/;

/** Is this a canonical, creatable scope (`@name`)? */
export function isCanonicalScope(scope: string): boolean {
  return SCOPE.test(scope);
}

// An organisation slug is the scope charset WITHOUT the leading `@`: 2-20 chars of
// lowercase a-z/0-9/hyphen, not starting with a hyphen. An org is a first-class account
// entity (it owns one or more scopes), so its slug lives in its own namespace - the
// public page is `/org/<slug>`, never `@<slug>`.
const ORG_SLUG = /^[a-z0-9][a-z0-9-]{1,19}$/;

/** Is this a canonical, claimable organisation slug (`acme`, no leading `@`)? */
export function isCanonicalOrgSlug(slug: string): boolean {
  return ORG_SLUG.test(slug);
}

// A scoped package name: a canonical scope, then `/name`. The name segment uses the
// SAME lowercase `a-z0-9-` charset as `@brika/schema`'s manifest `name` rule, so the
// registry's canonical check and the manifest data gate never disagree on a character;
// the registry only adds the stricter scope shape (2-20, no leading hyphen) and the
// requirement that the name be scoped. npm caps the full name at 214 chars.
const CANONICAL_NAME = /^@[a-z0-9][a-z0-9-]{1,19}\/[a-z0-9][a-z0-9-]*$/;

/** Is this a canonical scoped package name (the only kind the registry publishes)? */
export function isCanonicalName(name: string): boolean {
  return name.length <= 214 && CANONICAL_NAME.test(name);
}
