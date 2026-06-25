import { z } from "zod";
import { manifestFields } from "@/lib/registry/manifest-mapping";

/**
 * The wire schemas for the registry's npm-compatible HTTP surface (packument, `/-/v1/packages`
 * catalog, downloads, scope). Every registry read validates its JSON against one of these, so a
 * shape drift degrades to the caller's fallback instead of crashing a render.
 */

export const Manifest = z
  .object({
    name: z.string(),
    ...manifestFields,
    unpackedSize: z.number().optional(),
    fileCount: z.number().optional(),
    // Present on packument version entries (the registry computes it), absent on
    // the raw package.json the catalog stores.
    dist: z
      .object({
        tarball: z.string().optional(),
        integrity: z.string().optional(),
        shasum: z.string().optional(),
        size: z.number().optional(),
      })
      .optional(),
    provenance: z
      .object({
        repository: z.string(),
        sha: z.string().optional(),
        ref: z.string().optional(),
        workflowRef: z.string().optional(),
        runId: z.string().optional(),
        transparencyLog: z
          .object({
            provider: z.string(),
            logUrl: z.string(),
            logIndex: z.string().optional(),
            integrity: z.string(),
          })
          .optional(),
      })
      .optional(),
  })
  .loose();
export type Manifest = z.infer<typeof Manifest>;

const DownloadStats = z.object({ total: z.number(), weekly: z.number() });

/** The registry's verified publisher (scope owner + display name), if present. */
const Publisher = z.object({ id: z.string(), name: z.string(), verified: z.boolean() });

export const CatalogEntry = z.object({
  name: z.string(),
  version: z.string(),
  manifest: Manifest,
  publishedAt: z.string().optional(),
  createdAt: z.string().optional(),
  publisher: Publisher.optional(),
  downloads: DownloadStats.optional(),
});
export type CatalogEntry = z.infer<typeof CatalogEntry>;

export const CatalogResponse = z.object({ packages: z.array(CatalogEntry), total: z.number() });
export type CatalogResponse = z.infer<typeof CatalogResponse>;

export const DownloadsResponse = z.object({
  name: z.string(),
  total: z.number(),
  weekly: z.number(),
  series: z.array(z.number()).optional(),
});

export const Packument = z.object({
  name: z.string(),
  "dist-tags": z.object({ latest: z.string().optional() }).optional(),
  versions: z.record(z.string(), Manifest).optional(),
  time: z.record(z.string(), z.string()).optional(),
  publisher: Publisher.optional(),
});
export type Packument = z.infer<typeof Packument>;

const ScopeLinkWire = z.object({ label: z.string(), url: z.string() });

export const ScopeInfo = z.object({
  ok: z.literal(true),
  scope: z.string(),
  displayName: z.string().nullable(),
  description: z.string().nullable().default(null),
  links: z.array(ScopeLinkWire).default([]),
  iconKey: z.string().nullable().default(null),
  verifiedDomains: z.array(z.string()).default([]),
});
