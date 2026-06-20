import { z } from "zod";
import { TransparencyEntry } from "./attestation";

/**
 * Build provenance for a version published from CI: where the bytes came from,
 * derived from the verified GitHub Actions OIDC token (so it cannot be forged).
 * Null for local token publishes, which carry no CI attestation.
 */
export const Provenance = z.object({
  /** `owner/repo` the publish ran from. */
  repository: z.string(),
  /** Commit SHA the build ran against. */
  sha: z.string().optional(),
  /** Git ref (branch/tag) of the build. */
  ref: z.string().optional(),
  /** Workflow file reference, e.g. `owner/repo/.github/workflows/publish.yml@ref`. */
  workflowRef: z.string().optional(),
  /** Workflow run id, for a link to the build summary. */
  runId: z.string().optional(),
  /** Public transparency-log entry for the signed artifact (sigstore today). */
  transparencyLog: TransparencyEntry.optional(),
});
export type Provenance = z.infer<typeof Provenance>;

/**
 * A single published, immutable package version, as held by the metadata store.
 * The `manifest` is the published `package.json` for the version; the integrity
 * fields are computed once at publish time and never change.
 */
export const PackageVersion = z.object({
  name: z.string(),
  version: z.string(),
  /** The published `package.json` of this version (npm manifest). */
  manifest: z.record(z.string(), z.unknown()),
  /** Subresource Integrity, e.g. `sha512-...` (verified by bun on download). */
  integrity: z.string(),
  /** Legacy SHA-1 hex digest (`dist.shasum`). */
  shasum: z.string(),
  /** Tarball size in bytes. */
  size: z.number().int().nonnegative(),
  /** ISO-8601 publish timestamp. */
  publishedAt: z.iso.datetime(),
  /** Deprecation message; the version stays installable when deprecated. */
  deprecated: z.string().nullable().default(null),
  /** Yanked versions are hidden from new installs but kept for existing locks. */
  yanked: z.boolean().default(false),
  /**
   * Operator takedown reason (abuse/policy). Null = active; non-null = removed by an
   * admin: hidden from new installs like a yank, with this reason surfaced publicly.
   */
  takedownReason: z.string().nullable().default(null),
  /** CI build provenance (GitHub OIDC), or null for local token publishes. */
  provenance: Provenance.nullable().default(null),
});
export type PackageVersion = z.infer<typeof PackageVersion>;

/**
 * The verified publisher of a scope: the organisation that owns it, plus the display
 * name it chose. Derived from org ownership (not the free-text manifest `author`), so it
 * is trustworthy: only an org admin can set it. An org is provider-neutral - membership
 * is provider-qualified, the org itself is identified by its slug.
 */
export interface ScopePublisher {
  /** Owning org slug (the provable identity, e.g. `brika`). */
  readonly id: string;
  /** Display name shown to users (admin-set; falls back to the org slug). */
  readonly name: string;
}

/**
 * A package and all of its versions, as read from the metadata store. The
 * `distTags` map points named tags (e.g. `latest`) at concrete versions.
 */
export interface PackageRecord {
  readonly name: string;
  readonly distTags: Readonly<Record<string, string>>;
  readonly versions: readonly PackageVersion[];
  /** The scope's verified publisher, or null for an unclaimed/unscoped package. */
  readonly publisher: ScopePublisher | null;
  /** ISO-8601 timestamp of the first publish. */
  readonly createdAt: string;
}
