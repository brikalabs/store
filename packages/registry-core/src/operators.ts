import type { PublishIdentity } from "./publish";

/**
 * Registry operators (the "admin allowlist") allowed to perform takedown/restore and reach the
 * operator console, identified by Brika account id (`REGISTRY_ADMINS` config). A CI (OIDC)
 * credential has no `userId`, so it can never be an operator.
 */

/** Parse a comma-separated `REGISTRY_ADMINS` value into operator account ids; empty value -> no
 *  operators (fail closed). */
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
