import { z } from "zod";

/**
 * The Brika `/v1` registry contract.
 *
 * Any HTTP service that implements the mandatory discovery core below can act
 * as a plugin registry for a Brika hub. Optional social capabilities (profiles,
 * reviews, comments) are advertised through `GET /v1/registry` so a consumer
 * knows what a given registry supports.
 *
 * npm remains the source of truth for code. A registry never serves plugin
 * code, only metadata, so this contract is metadata-only by design.
 */
export const CONTRACT_VERSION = "1.0";

/**
 * A resolved asset URL: either an absolute `http(s)` URL (e.g. a jsDelivr CDN
 * link for an npm-hosted plugin) or a root-relative path served by the same
 * origin (e.g. `/v1/plugins/:name/asset?...` for a registry-hosted plugin whose
 * assets are extracted from the tarball). Both resolve correctly in an
 * `<img src>` or a `fetch`, so the contract accepts either form.
 */
export const ResolvedUrl = z.union([z.url(), z.string().regex(/^\/[^/]/, "root-relative path")]);
export type ResolvedUrl = z.infer<typeof ResolvedUrl>;

/** Capability flags a registry advertises through `GET /v1/registry`. */
export const RegistryFeature = z.enum([
  // discovery core (mandatory)
  "search",
  "plugins",
  "versions",
  "readme",
  "icon",
  "verified",
  // social (optional)
  "profiles",
  "reviews",
  "comments",
]);
export type RegistryFeature = z.infer<typeof RegistryFeature>;

/** Ed25519 public key a consumer can pin to trust the signed verified list. */
export const SigningInfo = z.object({
  algorithm: z.literal("ed25519"),
  /** base64-encoded public key */
  publicKey: z.string().min(1),
});
export type SigningInfo = z.infer<typeof SigningInfo>;

/** `GET /v1/registry` */
export const RegistryCapabilities = z.object({
  name: z.string(),
  contractVersion: z.string(),
  features: z.array(RegistryFeature),
  signing: SigningInfo.optional(),
});
export type RegistryCapabilities = z.infer<typeof RegistryCapabilities>;

/** A plugin author, derived from npm metadata and enriched on login. */
export const PluginAuthor = z.object({
  /** stable id, the npm username */
  id: z.string(),
  name: z.string().optional(),
  avatarUrl: z.url().optional(),
  /** true when a logged-in GitHub identity matched the package repo owner */
  verified: z.boolean().default(false),
});
export type PluginAuthor = z.infer<typeof PluginAuthor>;

/** Counts of each Brika capability the plugin declares in its manifest. */
export const PluginCapabilityCounts = z.object({
  tools: z.number().int().nonnegative().default(0),
  blocks: z.number().int().nonnegative().default(0),
  bricks: z.number().int().nonnegative().default(0),
  sparks: z.number().int().nonnegative().default(0),
  pages: z.number().int().nonnegative().default(0),
});
export type PluginCapabilityCounts = z.infer<typeof PluginCapabilityCounts>;

export const RatingSummary = z.object({
  average: z.number().min(0).max(5),
  count: z.number().int().nonnegative(),
});
export type RatingSummary = z.infer<typeof RatingSummary>;

/** A plugin as it appears in search results and cards. */
export const PluginSummary = z.object({
  name: z.string(),
  displayName: z.string().optional(),
  description: z.string().optional(),
  /** the latest published version */
  version: z.string(),
  author: PluginAuthor.optional(),
  keywords: z.array(z.string()).default([]),
  iconUrl: ResolvedUrl.optional(),
  downloadsWeekly: z.number().int().nonnegative().default(0),
  /** All-time install count (tarball downloads). Absent when not tracked (npm). */
  installs: z.number().int().nonnegative().optional(),
  rating: RatingSummary.optional(),
  capabilities: PluginCapabilityCounts.optional(),
  /** the `engines.brika` semver range of the latest version */
  brikaEngine: z.string(),
  verified: z.boolean().default(false),
  featured: z.boolean().default(false),
  /** ISO-8601 timestamps */
  publishedAt: z.iso.datetime().optional(),
  updatedAt: z.iso.datetime().optional(),
});
export type PluginSummary = z.infer<typeof PluginSummary>;

/**
 * A screenshot on the plugin listing: a resolved image URL plus optional caption
 * and accessibility text. `caption` is resolved for the requested locale (from
 * the plugin's `locales/<lang>/store.json` `screenshotCaptions`, falling back to
 * the manifest screenshot's default `caption`); `alt` is the a11y description.
 */
export const Screenshot = z.object({
  url: ResolvedUrl,
  caption: z.string().optional(),
  alt: z.string().optional(),
});
export type Screenshot = z.infer<typeof Screenshot>;

/**
 * One file inside the published tarball, npm-style: a leading-slash path plus
 * the metadata npm exposes on its file index (content type, a per-file SHA-256,
 * a binary flag, and the line count) so consumers can render a browser without
 * fetching every file.
 */
export const PluginFile = z.object({
  path: z.string(),
  type: z.literal("File"),
  size: z.number().int().nonnegative(),
  contentType: z.string(),
  hex: z.string(),
  isBinary: z.boolean(),
  linesCount: z.number().int().nonnegative(),
});
export type PluginFile = z.infer<typeof PluginFile>;

/**
 * The published tarball's file index, mirroring npm's
 * `/package/<name>/v/<version>/index`: a map keyed by leading-slash path plus
 * tarball-level aggregates (total size, file count, shasum, and SRI integrity).
 */
export const PluginFileIndex = z.object({
  files: z.record(z.string(), PluginFile),
  totalSize: z.number().int().nonnegative(),
  fileCount: z.number().int().nonnegative(),
  shasum: z.string(),
  integrity: z.string(),
});
export type PluginFileIndex = z.infer<typeof PluginFileIndex>;

/**
 * Build provenance for a CI-published version, anchored on the verified GitHub
 * OIDC token: where the bytes were built from. Absent for local-token publishes.
 */
/** A public transparency-log entry for the signed tarball (sigstore today). */
export const TransparencyEntry = z.object({
  provider: z.string(),
  logUrl: z.url(),
  logIndex: z.string().optional(),
  integrity: z.string(),
});
export type TransparencyEntry = z.infer<typeof TransparencyEntry>;

export const Provenance = z.object({
  repository: z.string(),
  sha: z.string().optional(),
  ref: z.string().optional(),
  workflowRef: z.string().optional(),
  runId: z.string().optional(),
  /** Public transparency-log entry for the signed artifact, when attested. */
  transparencyLog: TransparencyEntry.optional(),
});
export type Provenance = z.infer<typeof Provenance>;

/** Full plugin detail, returned by `GET /v1/plugins/:name`. */
export const PluginDetail = PluginSummary.extend({
  repository: z.url().optional(),
  homepage: z.url().optional(),
  license: z.string().optional(),
  /** reverse-DNS permission requests, e.g. `"dev.brika.net.fetch"` */
  grants: z.record(z.string(), z.unknown()).default({}),
  readmeUrl: ResolvedUrl.optional(),
  /** Ordered screenshots shown on the listing (URLs resolved; captions localized). */
  screenshots: z.array(Screenshot).default([]),
  /**
   * Subresource Integrity of the latest version's tarball (`sha512-<base64>`),
   * the supply-chain anchor bun pins in the lockfile. Shown as a trust signal.
   */
  integrity: z.string().optional(),
  /** Legacy SHA-1 checksum of the tarball, for parity with npm tooling. */
  shasum: z.string().optional(),
  /** CI build provenance (GitHub OIDC) for the latest version, when published from CI. */
  provenance: Provenance.optional(),
  /** Runtime dependencies from the manifest: package name -> semver range. */
  dependencies: z.record(z.string(), z.string()).optional(),
  /** Peer dependencies from the manifest: package name -> semver range. */
  peerDependencies: z.record(z.string(), z.string()).optional(),
  /** Dev dependencies from the manifest: package name -> semver range. */
  devDependencies: z.record(z.string(), z.string()).optional(),
  /** Count of devDependencies declared in the manifest. */
  devDependencyCount: z.number().int().nonnegative().optional(),
  /** Packed (gzipped) tarball size in bytes. */
  size: z.number().int().nonnegative().optional(),
  /** Unpacked size of the tarball contents in bytes. */
  unpackedSize: z.number().int().nonnegative().optional(),
  /** Number of files in the tarball. */
  fileCount: z.number().int().nonnegative().optional(),
  /** Absolute URL of the latest version's tarball (the registry `dist.tarball`). */
  tarballUrl: ResolvedUrl.optional(),
});
export type PluginDetail = z.infer<typeof PluginDetail>;

/** One row of `GET /v1/plugins/:name/versions`. */
export const PluginVersion = z.object({
  version: z.string(),
  publishedAt: z.iso.datetime().optional(),
  brikaEngine: z.string().optional(),
  changelog: z.string().optional(),
  deprecated: z.string().optional(),
});
export type PluginVersion = z.infer<typeof PluginVersion>;

export const SearchSort = z.enum(["downloads", "rating", "recent", "name"]);
export type SearchSort = z.infer<typeof SearchSort>;

/** `GET /v1/search?q=&limit=&offset=&sort=` */
export const SearchQuery = z.object({
  q: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  sort: SearchSort.default("downloads"),
});
export type SearchQuery = z.infer<typeof SearchQuery>;

export const SearchResponse = z.object({
  plugins: z.array(PluginSummary),
  total: z.number().int().nonnegative(),
});
export type SearchResponse = z.infer<typeof SearchResponse>;

/** `GET /v1/plugins/:name/readme` */
export const ReadmeResponse = z.object({
  readme: z.string().nullable(),
  filename: z.string(),
});
export type ReadmeResponse = z.infer<typeof ReadmeResponse>;

/**
 * `GET /v1/verified`: the signed curation list.
 *
 * Back-compatible with the legacy `registry.brika.dev/verified-plugins.json`.
 * `signature` is an Ed25519 signature over the canonical JSON of `plugins`,
 * verifiable with the `signing.publicKey` from `GET /v1/registry`.
 */
export const VerifiedEntry = z.object({
  name: z.string(),
  verified: z.boolean().default(true),
  featured: z.boolean().default(false),
});
export type VerifiedEntry = z.infer<typeof VerifiedEntry>;

export const VerifiedList = z.object({
  plugins: z.array(VerifiedEntry),
  signature: z.string().optional(),
  signedAt: z.iso.datetime().optional(),
});
export type VerifiedList = z.infer<typeof VerifiedList>;

/* ------------------------------------------------------------------ *
 * Optional social capabilities (advertised, not required of a registry)
 * ------------------------------------------------------------------ */

/** A community member, created only when someone signs in to write. */
export const Reviewer = z.object({
  id: z.string(),
  login: z.string(),
  name: z.string().optional(),
  avatarUrl: z.url().optional(),
});
export type Reviewer = z.infer<typeof Reviewer>;

export const Review = z.object({
  id: z.string(),
  pluginName: z.string(),
  author: Reviewer,
  rating: z.number().int().min(1).max(5),
  title: z.string().optional(),
  body: z.string(),
  versionReviewed: z.string().optional(),
  /** How many community members marked this review helpful. */
  helpfulCount: z.number().int().nonnegative().default(0),
  /** Whether the requesting user has marked it helpful (false when anonymous). */
  viewerVotedHelpful: z.boolean().default(false),
  createdAt: z.iso.datetime(),
  edited: z.boolean().default(false),
});
export type Review = z.infer<typeof Review>;

export const Comment = z.object({
  id: z.string(),
  pluginName: z.string(),
  parentId: z.string().nullable().default(null),
  author: Reviewer,
  body: z.string(),
  /** Net upvotes (the comment "grade"). */
  upvotes: z.number().int().nonnegative().default(0),
  /** Whether the requesting user has upvoted (false when anonymous). */
  viewerUpvoted: z.boolean().default(false),
  createdAt: z.iso.datetime(),
  edited: z.boolean().default(false),
  deleted: z.boolean().default(false),
});
export type Comment = z.infer<typeof Comment>;

/** `GET /v1/developers/:id` */
export const DeveloperProfile = z.object({
  id: z.string(),
  displayName: z.string().optional(),
  avatarUrl: z.url().optional(),
  bio: z.string().optional(),
  website: z.url().optional(),
  githubLogin: z.string().optional(),
  verified: z.boolean().default(false),
  pluginCount: z.number().int().nonnegative().default(0),
});
export type DeveloperProfile = z.infer<typeof DeveloperProfile>;

/**
 * Canonical route templates for the contract. `:name` is a plugin name
 * (URL-encoded, scoped names allowed); `:id` is a developer id.
 */
export const V1_ROUTES = {
  registry: "/v1/registry",
  search: "/v1/search",
  plugin: "/v1/plugins/:name",
  versions: "/v1/plugins/:name/versions",
  readme: "/v1/plugins/:name/readme",
  icon: "/v1/plugins/:name/icon",
  verified: "/v1/verified",
  reviews: "/v1/plugins/:name/reviews",
  reviewVote: "/v1/plugins/:name/reviews/:reviewId/vote",
  comments: "/v1/plugins/:name/comments",
  commentVote: "/v1/plugins/:name/comments/:commentId/vote",
  developer: "/v1/developers/:id",
  developerPlugins: "/v1/developers/:id/plugins",
} as const;
