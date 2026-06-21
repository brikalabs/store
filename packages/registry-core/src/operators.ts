import type { PublishIdentity } from "./publish";

/**
 * Registry operators (the "admin allowlist") allowed to perform takedown/restore and reach
 * the operator console - a privilege distinct from owning a scope or being an org admin.
 *
 * An operator is identified by their Brika account id (`userId`), the same id the rest of the
 * identity model is keyed on. Both the registry worker and the store worker derive their
 * allowlist from the SAME `REGISTRY_ADMINS` config (a comma-separated list of account ids), so
 * this parsing + the membership check live here, in one place, rather than per worker. A CI
 * (OIDC) credential has no `userId`, so it can never be an operator.
 */

/**
 * Parse a comma-separated `REGISTRY_ADMINS` value into the set of operator account ids.
 * Blank/whitespace entries are dropped; an empty value yields an empty set (no operators -
 * fail closed).
 */
export function parseOperatorAdmins(raw: string): ReadonlySet<string> {
  return new Set(
    raw
      .split(",")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0),
  );
}

/** Whether `identity` is in the operator allowlist (the gate for takedown + the console). */
export function isOperator(
  admins: ReadonlySet<string>,
  identity: Pick<PublishIdentity, "userId">,
): boolean {
  return identity.userId !== null && admins.has(identity.userId);
}
