import { isOperator } from "@brika/registry-core";
import { notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { getCurrentUser } from "@/lib/auth/auth";
import { operatorAdmins } from "@/server/env";
import { sessionIdentity } from "@/server/registry-identity";

/**
 * Resolve the signed-in operator from the request cookie, or null when signed-out or not in the
 * operator allowlist. A server function so the allowlist + D1 lookup always run on the server.
 */
export const fetchOperator = createServerFn().handler(async (): Promise<{ id: string } | null> => {
  const user = await getCurrentUser(getRequest());
  if (user === null || !isOperator(operatorAdmins(), sessionIdentity(user))) return null;
  return { id: user.id };
});

/** Whether the current session is a registry operator (drives the dashboard's console link). */
export const fetchIsOperator = createServerFn().handler(
  async (): Promise<boolean> => (await fetchOperator()) !== null,
);

/**
 * `beforeLoad` guard for `/operator`: returns the signed-in operator, or throws `notFound()` for
 * everyone else. We 404 rather than 403/redirect so the console's existence is not advertised to
 * non-operators - it is a moderation surface, not a public feature.
 */
export async function requireOperator(): Promise<{ id: string }> {
  const operator = await fetchOperator();
  if (operator === null) throw notFound();
  return operator;
}
