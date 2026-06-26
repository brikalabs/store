import { token } from "@brika/di";
import { z } from "zod";
import type { PublishIdentity } from "./publish";

/**
 * Trusted publishers (PUB-016): the binding that authorizes a tokenless OIDC publish. A binding
 * grants a repo + workflow the right to publish under a scope; an OIDC publish is allowed only when
 * its verified token claims match a binding. Human token publishes stay membership-gated.
 */

/** A binding: scope `@x` may be published from `provider`'s `repository` + `workflow`. */
export interface TrustedPublisher {
  readonly scope: string; // e.g. @brika
  /** Matched against the OIDC issuer; e.g. `github`, `gitlab`. */
  readonly provider: string;
  readonly repository: string; // owner/repo or group/project
  readonly workflow: string; // e.g. publish.yml, .gitlab-ci.yml
}

/** Request-body schema for a trusted-publisher binding: provider + project + workflow filename,
 *  validated so it can actually match a real OIDC ref claim. */
export const trustedPublisherSchema = z.object({
  provider: z.enum(["github", "gitlab"]),
  repository: z.string().regex(/^[^\s/]+(?:\/[^\s/]+)+$/, "repository must be 'owner/repo'"),
  workflow: z
    .string()
    .regex(/^[\w.-]+\.ya?ml$/, "workflow must be a workflow filename, e.g. publish.yml"),
});

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
/** DI token for the {@link TrustedPublishers} port. */
export const TrustedPublishers = token<TrustedPublishers>("TrustedPublishers");

function workflowFilename(workflowRef: string | undefined): string | null {
  if (workflowRef === undefined || workflowRef.length === 0) return null;
  // workflow_ref is e.g. `owner/repo/.github/workflows/publish.yml@refs/heads/main`.
  const path = workflowRef.split("@")[0] ?? workflowRef;
  const slash = path.lastIndexOf("/");
  const filename = slash === -1 ? path : path.slice(slash + 1);
  return filename.length > 0 ? filename : null;
}

/**
 * Whether `identity` (a verified OIDC publish) matches `binding`: same `owner/repo` and workflow
 * filename. Token (non-OIDC) identities never match - their `repository` is null - so this only ever
 * authorizes a CI publish.
 */
export function trustedPublisherMatches(
  binding: TrustedPublisher,
  identity: PublishIdentity,
): boolean {
  if (identity.provider !== binding.provider) return false;
  if (identity.repository === null || identity.repository !== binding.repository) return false;
  return workflowFilename(identity.provenance?.workflowRef) === binding.workflow;
}
