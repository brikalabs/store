import { z } from "zod";

/**
 * The Brika `/v1` registry contract. Any HTTP service implementing the discovery core can act as a
 * registry; optional social capabilities are advertised via `GET /v1/registry`. npm remains the
 * source of truth for code: a registry only serves metadata, so this contract is metadata-only.
 */
export const CONTRACT_VERSION = "1.0";

/**
 * A resolved asset URL: an absolute `http(s)` URL or a root-relative path. Both resolve in an
 * `<img src>` or `fetch`, so the contract accepts either form.
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

/**
 * A package's listing state, projecting the per-version yank/deprecate flags to the package level:
 * `published` (installable, no deprecation), `deprecated` (latest carries a message, still installs),
 * `yanked` (every version yanked, nothing installs; owner can un-yank), `taken_down` (operator-only
 * restore), `reserved` (name claimed but nothing published yet; hidden from the store).
 */
export const PluginListingStatus = z.enum([
  "published",
  "deprecated",
  "yanked",
  "taken_down",
  "reserved",
]);
export type PluginListingStatus = z.infer<typeof PluginListingStatus>;

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
  /** The package's listing state ({@link PluginListingStatus}); the public catalog always carries `published`. */
  listingStatus: PluginListingStatus.default("published"),
  /** ISO-8601 timestamps */
  publishedAt: z.iso.datetime().optional(),
  updatedAt: z.iso.datetime().optional(),
});
export type PluginSummary = z.infer<typeof PluginSummary>;

/** A screenshot on the listing: a resolved image URL, plus a caption (resolved for the locale) and a11y `alt`. */
export const Screenshot = z.object({
  url: ResolvedUrl,
  caption: z.string().optional(),
  alt: z.string().optional(),
});
export type Screenshot = z.infer<typeof Screenshot>;

/** One file in the published tarball (npm-style): path plus metadata so consumers render a file browser. */
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

/** The tarball's file index (mirrors npm's `/package/<name>/v/<version>/index`): files plus aggregates. */
export const PluginFileIndex = z.object({
  files: z.record(z.string(), PluginFile),
  totalSize: z.number().int().nonnegative(),
  fileCount: z.number().int().nonnegative(),
  shasum: z.string(),
  integrity: z.string(),
});
export type PluginFileIndex = z.infer<typeof PluginFileIndex>;

/** A public transparency-log entry for the signed tarball (sigstore today). */
export const TransparencyEntry = z.object({
  provider: z.string(),
  logUrl: z.url(),
  logIndex: z.string().optional(),
  integrity: z.string(),
});
export type TransparencyEntry = z.infer<typeof TransparencyEntry>;

/** CI build provenance for a published version (verified GitHub OIDC); absent for local-token publishes. */
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
  /** SRI of the latest tarball (`sha512-<base64>`), the supply-chain anchor bun pins in the lockfile. */
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

/**
 * The offset-based pagination window every list endpoint accepts (`?limit=&offset=`). Mirrors the
 * domain {@link Pageable}; defaults to the first page of 20, capped at 100 per request.
 */
export const PageQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});
export type PageQuery = z.infer<typeof PageQuery>;

/** A paginated response over `item`: the window's items plus the total across all pages. */
export function pageSchema<T extends z.ZodType>(item: T) {
  return z.object({
    items: z.array(item),
    total: z.number().int().nonnegative(),
    limit: z.number().int().nonnegative(),
    offset: z.number().int().nonnegative(),
  });
}

/** Sortable fields for `sort=field[:dir]` (`relevance` requires a text query). */
export const SearchSort = z.enum(["relevance", "downloads", "recent", "name"]);
export type SearchSort = z.infer<typeof SearchSort>;

/** Sort direction; absent means each sort's natural order (most/newest/best first, A→Z for name). */
export const SearchDirection = z.enum(["asc", "desc"]);
export type SearchDirection = z.infer<typeof SearchDirection>;

/** A Brika capability a search can filter on (a plugin declaring at least one of the kind). */
export const SearchCapability = z.enum(["tools", "blocks", "bricks", "sparks", "pages"]);
export type SearchCapability = z.infer<typeof SearchCapability>;

/**
 * A repeatable filter that accepts either a comma-separated string (raw query strings like
 * `?tags=a,b`) or an array, so a handler can pass the whole `URLSearchParams` straight in. Empty
 * by default.
 */
function commaList<T extends z.ZodType>(item: T) {
  return z
    .preprocess(
      (value) => (typeof value === "string" ? value.split(",").filter((v) => v.length > 0) : value),
      z.array(item),
    )
    .default([]);
}

/**
 * `GET /v1/search?q=&tags=&capabilities=&sort=&limit=&offset=`. `tags` is AND-matched, `capabilities`
 * is OR-matched, and `sort` is an ordered, comma-separated list of `field[:dir]` terms (e.g.
 * `downloads:desc,name`); unknown fields/directions are dropped by the registry.
 */
export const SearchQuery = PageQuery.extend({
  q: z.string().optional(),
  tags: commaList(z.string()),
  capabilities: commaList(SearchCapability),
  sort: z.string().optional(),
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
 * `GET /v1/verified`: the signed curation list. `signature` is an Ed25519 signature over the
 * canonical JSON of `plugins`, verifiable with `signing.publicKey` from `GET /v1/registry`.
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

/**
 * A community member (review/comment author). Identity is the always-present `displayName`
 * (user-set name, else name) - NEVER the opaque account id or a username.
 */
export const Reviewer = z.object({
  id: z.string(),
  displayName: z.string(),
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

/** One labelled external link on a public account profile. */
export const ProfileLink = z.object({
  label: z.string(),
  url: z.url(),
});
export type ProfileLink = z.infer<typeof ProfileLink>;

/**
 * A Brika account's public profile (`GET /u/:id`). User-authored, NEVER derived from npm (USER-005);
 * keyed by the stable opaque account id, not a claimable handle (USER-002). `displayName` is always
 * present and is the ONLY identity label shown - never the opaque id or a username.
 */
export const UserProfile = z.object({
  id: z.string(),
  displayName: z.string(),
  avatarUrl: z.url().optional(),
  bio: z.string().optional(),
  website: z.url().optional(),
  links: z.array(ProfileLink).default([]),
});
export type UserProfile = z.infer<typeof UserProfile>;
