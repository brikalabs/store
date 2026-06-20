import { z } from "zod";
import { hasUnsafeLabelChars } from "./labels";

/**
 * Organisation profile: a free-text description plus an arbitrary set of labelled links
 * (X, LinkedIn, npm, Facebook, a docs site, ...). Links are deliberately open-ended - a
 * `{ label, url }` pair, not a fixed enum - so an org can add whatever it wants. The same
 * anti-spoofing rules as the display name apply to the free-text label, and URLs are
 * constrained to http(s) so a stored profile can never carry a `javascript:` or `data:`
 * link. Validation lives here so the registry endpoint and the store console share it.
 */

/** True when `value` is a syntactically valid http(s) URL. */
function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/** One labelled external link on an org profile (e.g. `{ label: "X", url: "https://x.com/acme" }`). */
export const orgLinkSchema = z.object({
  label: z
    .string()
    .min(1)
    .max(30)
    .refine((value) => !hasUnsafeLabelChars(value), "link label has disallowed characters")
    .transform((value) => value.normalize("NFC")),
  url: z.string().min(1).max(300).refine(isHttpUrl, "link must be a valid http(s) URL"),
});

export type OrgLink = z.infer<typeof orgLinkSchema>;

/** An org's links: any number the admin wants, capped to keep the profile bounded. */
export const orgLinksSchema = z.array(orgLinkSchema).max(20);

/** An org's description: free text, anti-spoofing-checked and NFC-normalized, or empty. */
export const orgDescriptionSchema = z
  .string()
  .max(500)
  .refine((value) => !hasUnsafeLabelChars(value), "description has disallowed characters")
  .transform((value) => value.normalize("NFC"));

/** The editable org profile fields (everything but the slug + verified display name). */
export interface OrgProfileInput {
  readonly description: string | null;
  readonly links: readonly OrgLink[];
}

// A registrable hostname an org can claim and verify (e.g. `brika.dev`, `docs.brika.dev`):
// lowercase labels of a-z/0-9/hyphen (no leading/trailing hyphen), at least two, a 2+ letter
// TLD, <=253 chars. No scheme, port, or path - this is a bare domain, not a URL.
const DOMAIN = /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;

/** A bare hostname an org can claim for DNS verification (lowercased first). */
export const orgDomainSchema = z
  .string()
  .transform((value) => value.trim().toLowerCase())
  .refine((value) => DOMAIN.test(value), "not a valid domain name");
