import { z } from "zod";
import { TransparencyEntry } from "./attestation";

/**
 * Build provenance for a CI-published version, derived from the verified OIDC token (so it cannot be
 * forged). Null for local token publishes.
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

/** A single published, immutable package version, as held by the metadata store. */
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
  /** Operator takedown reason (null = active). Non-null hides the version like a yank, with this
   *  reason surfaced publicly. */
  takedownReason: z.string().nullable().default(null),
  /** CI build provenance (GitHub OIDC), or null for local token publishes. */
  provenance: Provenance.nullable().default(null),
});
export type PackageVersion = z.infer<typeof PackageVersion>;

/**
 * The verified publisher of a scope: who owns it plus the display name it chose. Derived from scope
 * ownership (not the free-text manifest `author`), so it is trustworthy: only an admin can set it.
 */
export interface ScopePublisher {
  /** Owning org slug (the provable identity, e.g. `brika`). */
  readonly id: string;
  /** Display name shown to users (admin-set; falls back to the org slug). */
  readonly name: string;
}

/** A package and all of its versions, as read from the metadata store. */
export interface PackageRecord {
  readonly name: string;
  readonly distTags: Readonly<Record<string, string>>;
  readonly versions: readonly PackageVersion[];
  /** The scope's publisher (owner + display name), or null for an unclaimed/unscoped package. */
  readonly publisher: ScopePublisher | null;
  /** Operator-set "approved by Brika" verified badge for the package. */
  readonly verified: boolean;
  /** ISO-8601 timestamp of the first publish. */
  readonly createdAt: string;
}
