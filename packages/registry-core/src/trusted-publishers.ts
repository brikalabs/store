import type { PublishIdentity } from "./publish";

/**
 * Trusted publishers (PUB-016): the npm-style binding that authorizes a tokenless GitHub
 * OIDC publish. A binding grants a specific GitHub repo + workflow the right to publish
 * under a scope; an OIDC publish is allowed only when its verified token claims match a
 * binding. This is the CI publish path - human token publishes stay org-membership-gated.
 *
 * The binding + the match live here (shared domain) so the registry and the console agree on
 * what "a matching trusted publisher" means, and the rule is unit-tested in one place.
 */

/** A binding: scope `@x` may be published from `repository`'s `workflow` (filename). */
export interface TrustedPublisher {
  /** The scope this binding authorizes, e.g. `@brika`. */
  readonly scope: string;
  /** `owner/repo` allowed to publish (matched against the OIDC `repository` claim). */
  readonly repository: string;
  /** Workflow filename, e.g. `publish.yml` (matched against the OIDC `workflow_ref`). */
  readonly workflow: string;
}

/**
 * Persistence port for trusted-publisher bindings (`reg_trusted_publishers`). Managed by an
 * org admin of the scope's owning org; consulted on every OIDC publish to the scope.
 */
export interface TrustedPublishers {
  /** Every binding for a scope (verified + the source of OIDC publish authorization). */
  listForScope(scope: string): Promise<TrustedPublisher[]>;
  /** Create the binding if absent; idempotent. */
  add(binding: TrustedPublisher): Promise<TrustedPublisher>;
  /** Remove a binding; returns whether one was removed. */
  remove(scope: string, repository: string, workflow: string): Promise<boolean>;
}

/** The workflow filename component of an OIDC `workflow_ref`, or null if unparyable. */
function workflowFilename(workflowRef: string | undefined): string | null {
  if (workflowRef === undefined || workflowRef.length === 0) return null;
  // workflow_ref is e.g. `owner/repo/.github/workflows/publish.yml@refs/heads/main`.
  const path = workflowRef.split("@")[0] ?? workflowRef;
  const slash = path.lastIndexOf("/");
  const filename = slash === -1 ? path : path.slice(slash + 1);
  return filename.length > 0 ? filename : null;
}

/**
 * Whether `identity` (a verified OIDC publish) matches `binding`: same `owner/repo` AND the
 * token's workflow filename equals the binding's. Token (non-OIDC) identities never match -
 * their `repository` is null - so this only ever authorizes a CI publish.
 */
export function trustedPublisherMatches(
  binding: TrustedPublisher,
  identity: PublishIdentity,
): boolean {
  if (identity.repository === null || identity.repository !== binding.repository) return false;
  return workflowFilename(identity.provenance?.workflowRef) === binding.workflow;
}
