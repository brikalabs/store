import { z } from "zod";

/**
 * Shared manifest mapping. Both source paths read the same npm `package.json`
 * fields and map them into the `/v1` contract shapes: the npm mirror (`npm.ts`)
 * and the registry reader (`registry-source.ts`). The wire primitives and the
 * field-level helpers live here once so the two cannot drift. The two packument
 * schemas themselves differ (npm vs registry `dist`/provenance) and stay in their
 * own modules, composed from the primitives below.
 */

/** A document declared in the manifest: a single path, or a locale -> path map. */
export const LocalizedDoc = z.union([z.string(), z.record(z.string(), z.string())]);
export type LocalizedDoc = z.infer<typeof LocalizedDoc>;

/** npm `person` field: `"Name <email> (url)"` or an object. */
export const Person = z.union([
  z.string(),
  z.object({
    name: z.string().optional(),
    email: z.string().optional(),
    url: z.string().optional(),
  }),
]);
export type Person = z.infer<typeof Person>;

/** npm `repository` field: a shorthand string or `{ url }`. */
export const Repository = z.union([z.string(), z.object({ url: z.string().optional() })]);
export type Repository = z.infer<typeof Repository>;

/** A declared screenshot: a bare path or `{ src, caption?, alt? }`. */
export const Screenshot = z.union([
  z.string(),
  z.object({ src: z.string(), caption: z.string().optional(), alt: z.string().optional() }),
]);
export type Screenshot = z.infer<typeof Screenshot>;

/**
 * The manifest fields both source paths read identically (everything except the
 * differing `name`/`dist`/`provenance`, which each module adds itself). Kept as a
 * raw shape so each schema can spread it into its own `z.object({ ... })`.
 */
export const manifestFields = {
  version: z.string(),
  description: z.string().optional(),
  displayName: z.string().optional(),
  license: z.string().optional(),
  homepage: z.string().optional(),
  keywords: z.array(z.string()).optional(),
  engines: z.object({ brika: z.string().optional() }).optional(),
  repository: Repository.optional(),
  author: Person.optional(),
  icon: z.string().optional(),
  screenshots: z.array(Screenshot).optional(),
  readme: LocalizedDoc.optional(),
  changelog: LocalizedDoc.optional(),
  grants: z.record(z.string(), z.unknown()).optional(),
  tools: z.array(z.unknown()).optional(),
  blocks: z.array(z.unknown()).optional(),
  bricks: z.array(z.unknown()).optional(),
  sparks: z.array(z.unknown()).optional(),
  pages: z.array(z.unknown()).optional(),
  deprecated: z.string().optional(),
  dependencies: z.record(z.string(), z.string()).optional(),
  peerDependencies: z.record(z.string(), z.string()).optional(),
  devDependencies: z.record(z.string(), z.string()).optional(),
};

/** A mapped screenshot with its CDN/asset URL resolved. */
export interface MappedScreenshot {
  readonly url: string;
  readonly caption?: string;
  readonly alt?: string;
}

/** Resolve a person's display name, stripping `<email>` and `(url)` from strings. */
export function personName(person: Person | undefined): string | undefined {
  if (person === undefined) return undefined;
  if (typeof person === "string") {
    const stripped = person
      .replace(/\s*<[^>]*>/, "")
      .replace(/\s*\([^)]*\)/, "")
      .trim();
    return stripped.length > 0 ? stripped : undefined;
  }
  return person.name;
}

/** Normalize a repository field to an https URL, or undefined when unusable. */
export function repoUrl(repo: Repository | undefined): string | undefined {
  const raw = typeof repo === "string" ? repo : repo?.url;
  if (raw === undefined || raw.length === 0) return undefined;
  if (raw.startsWith("github:")) return `https://github.com/${raw.slice("github:".length)}`;
  const cleaned = raw.replace(/^git\+/, "").replace(/\.git$/, "");
  if (cleaned.startsWith("git://")) return `https://${cleaned.slice("git://".length)}`;
  if (cleaned.startsWith("https://") || cleaned.startsWith("http://")) return cleaned;
  return undefined;
}

/** The capability counts a manifest declares (absent arrays count as 0). */
export function capabilityCounts(manifest: {
  tools?: unknown[];
  blocks?: unknown[];
  bricks?: unknown[];
  sparks?: unknown[];
  pages?: unknown[];
}): { tools: number; blocks: number; bricks: number; sparks: number; pages: number } {
  return {
    tools: manifest.tools?.length ?? 0,
    blocks: manifest.blocks?.length ?? 0,
    bricks: manifest.bricks?.length ?? 0,
    sparks: manifest.sparks?.length ?? 0,
    pages: manifest.pages?.length ?? 0,
  };
}

/**
 * Map declared screenshots to `{ url, caption?, alt? }`, resolving each path with
 * `urlFor` (jsDelivr for the npm mirror, the store's asset endpoint for the
 * registry). The only difference between the two source paths is that URL builder.
 */
export function mapScreenshots(
  screenshots: Screenshot[] | undefined,
  urlFor: (path: string) => string,
): MappedScreenshot[] {
  return (screenshots ?? []).map((shot) =>
    typeof shot === "string"
      ? { url: urlFor(shot) }
      : { url: urlFor(shot.src), caption: shot.caption, alt: shot.alt },
  );
}

/** Pick the path for a localized document: requested -> `en` -> first declared. */
export function pickDocPath(doc: LocalizedDoc | undefined, locale?: string): string | undefined {
  if (doc === undefined || typeof doc === "string") return doc;
  return (locale === undefined ? undefined : doc[locale]) ?? doc.en ?? Object.values(doc)[0];
}

/** The locale codes a localized document declares (empty for a single path). */
export function docLocales(doc: LocalizedDoc | undefined): string[] {
  if (doc === undefined || typeof doc === "string") return [];
  return Object.keys(doc);
}
