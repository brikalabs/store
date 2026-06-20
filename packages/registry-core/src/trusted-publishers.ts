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

/** A binding: scope `@x` may be published from `provider`'s `repository` + `workflow`. */
export interface TrustedPublisher {
  /** The scope this binding authorizes, e.g. `@brika`. */
  readonly scope: string;
  /** OIDC provider this binding trusts: `github`, `gitlab`, ... (matched against the issuer). */
  readonly provider: string;
  /** The project allowed to publish: GitHub `owner/repo`, GitLab `group/project`. */
  readonly repository: string;
  /** Workflow/config filename, e.g. `publish.yml` / `.gitlab-ci.yml` (from the OIDC ref claim). */
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
  remove(scope: string, provider: string, repository: string, workflow: string): Promise<boolean>;
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
  if (identity.provider !== binding.provider) return false;
  if (identity.repository === null || identity.repository !== binding.repository) return false;
  return workflowFilename(identity.provenance?.workflowRef) === binding.workflow;
}
