import type { PublishIdentity } from "./publish";

/**
 * Registry operators (the "admin allowlist") allowed to perform takedown/restore and reach
 * the operator console - a privilege distinct from owning a scope or being an org admin.
 *
 * An operator is identified by the same provider-qualified key as a {@link PublishIdentity}:
 * `provider:owner` (e.g. `github:octocat`). Both the registry worker and the store worker
 * derive their allowlist from the SAME `REGISTRY_ADMINS` config, so this parsing + the
 * membership check live here, in one place, rather than being re-implemented per worker.
 */

/** The provider an unqualified `REGISTRY_ADMINS` entry is assumed to belong to. */
const DEFAULT_PROVIDER = "github";

/** The provider-qualified key an identity is matched by in the operator allowlist. */
export function operatorKey(identity: Pick<PublishIdentity, "provider" | "owner">): string {
  return `${identity.provider}:${identity.owner}`;
}

/**
 * Parse a comma-separated `REGISTRY_ADMINS` value into the set of operator keys. Each entry
 * is `provider:owner`; a bare entry without a provider is qualified with `github`, so an
 * existing GitHub-login list keeps working while the check stays correct once a second
 * identity provider exists. Blank/whitespace entries are dropped; an empty value yields an
 * empty set (no operators - fail closed).
 */
export function parseOperatorAdmins(raw: string): ReadonlySet<string> {
  return new Set(
    raw
      .split(",")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0)
      .map((entry) => (entry.includes(":") ? entry : `${DEFAULT_PROVIDER}:${entry}`)),
  );
}

/** Whether `identity` is in the operator allowlist (the gate for takedown + the console). */
export function isOperator(
  admins: ReadonlySet<string>,
  identity: Pick<PublishIdentity, "provider" | "owner">,
): boolean {
  return admins.has(operatorKey(identity));
}
