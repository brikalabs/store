import { z } from "zod";

/**
 * Reject invisible / control / format / spoofing characters in the publisher display
 * name, which is the label users are told to trust over the manifest `author`. Unicode
 * property classes catch the dangerous code points in one pass: `Cc` (C0/C1 controls),
 * `Cf` (zero-width, bidi marks/overrides/isolates, ALM, soft hyphen, word joiner, BOM,
 * the invisible Tags block), `Cs` (lone surrogates), `Co` (private use); plus the blank
 * "filler" letters (U+115F/1160/3164/FFA0) that render invisible but are not `Cf`.
 * Visible-homoglyph (confusable script) detection is a deeper follow-up.
 *
 * The pattern is escape-only (every code point is a `\u`/`\p` escape, never a literal
 * glyph), so the source stays pure ASCII and no invisible character can hide in it.
 */
const UNSAFE_LABEL = /[\p{Cc}\p{Cf}\p{Cs}\p{Co}\u115f\u1160\u3164\uffa0]/u;

export function hasUnsafeLabelChars(value: string): boolean {
  return UNSAFE_LABEL.test(value);
}

/**
 * The verified-publisher display name: 1-120 chars, no spoofing/invisible characters,
 * normalized to NFC. Shared by the registry's `/-/scope/:scope/display-name` endpoint and
 * the store console so the trust gate is defined once.
 */
export const displayNameSchema = z
  .string()
  .min(1)
  .max(120)
  .refine((value) => !hasUnsafeLabelChars(value), "display name has disallowed characters")
  .transform((value) => value.normalize("NFC"));
