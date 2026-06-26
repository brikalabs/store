import { z } from "zod";
import { TransparencyEntry } from "./attestation";

/**
 * Build provenance for a CI-published version, derived from the verified OIDC token (so it cannot be
 * forged). Null for local token publishes.
 */
export const Provenance = z.object({
  repository: z.string(), // owner/repo
  sha: z.string().optional(),
  ref: z.string().optional(), // branch/tag
  workflowRef: z.string().optional(), // e.g. owner/repo/.github/workflows/publish.yml@ref
  runId: z.string().optional(),
  transparencyLog: TransparencyEntry.optional(),
});
export type Provenance = z.infer<typeof Provenance>;

/** A single published, immutable package version, as held by the metadata store. */
export const PackageVersion = z.object({
  name: z.string(),
  version: z.string(),
  manifest: z.record(z.string(), z.unknown()),
  integrity: z.string(), // sha512-...
  shasum: z.string(), // legacy SHA-1 hex (dist.shasum)
  size: z.number().int().nonnegative(), // bytes
  publishedAt: z.iso.datetime(),
  /** Deprecation message; the version stays installable when deprecated. */
  deprecated: z.string().nullable().default(null),
  /** Yanked versions are hidden from new installs but kept for existing locks. */
  yanked: z.boolean().default(false),
  /** Operator takedown reason (null = active). Non-null hides the version like a yank, with this
   *  reason surfaced publicly. */
  takedownReason: z.string().nullable().default(null),
  provenance: Provenance.nullable().default(null),
});
export type PackageVersion = z.infer<typeof PackageVersion>;

/**
 * The verified publisher of a scope: who owns it plus the display name it chose. Derived from scope
 * ownership (not the free-text manifest `author`), so it is trustworthy: only an admin can set it.
 */
export interface ScopePublisher {
  readonly id: string; // e.g. brika
  /** Admin-set; falls back to the org slug. */
  readonly name: string;
  /** The scope is an operator-verified organization (the "verified organization" badge). Distinct
   *  from {@link PackageRecord.verified}, which is the package's "approved by Brika" flag. */
  readonly verified: boolean;
}

/** Build a {@link ScopePublisher} from a scope's stored fields; the display name falls back to the slug. */
export function scopePublisher(
  id: string,
  displayName: string | null,
  verified: boolean,
): ScopePublisher {
  return { id, name: displayName ?? id, verified };
}

/** A package and all of its versions, as read from the metadata store. */
export interface PackageRecord {
  readonly name: string;
  readonly distTags: Readonly<Record<string, string>>;
  readonly versions: readonly PackageVersion[];
  /** Null for an unclaimed/unscoped package. */
  readonly publisher: ScopePublisher | null;
  /** Operator-set "approved by Brika" verified badge for the package. */
  readonly verified: boolean;
  /** Operator takedown reason for the WHOLE package (null = active). Non-null withdraws every
   *  version, current and future, from public resolution and search. */
  readonly takedown: string | null;
  /** The owning scope's takedown reason (null = active/unscoped). A taken-down scope withdraws all
   *  of its packages, even ones not individually taken down. */
  readonly scopeTakedown: string | null;
  readonly createdAt: string; // ISO-8601 (first publish)
}
