import { z } from "zod";

/**
 * Reject invisible / control / format / spoofing characters in the publisher display name, the
 * label users are told to trust over the manifest `author`. Catches `Cc`/`Cf`/`Cs`/`Co` plus the
 * blank "filler" letters (U+115F/1160/3164/FFA0) that render invisible but are not `Cf`. The
 * pattern is escape-only (no literal glyph) so no invisible character can hide in the source.
 */
const UNSAFE_LABEL = /[\p{Cc}\p{Cf}\p{Cs}\p{Co}\u115f\u1160\u3164\uffa0]/u;

/** Whether `value` contains any invisible / control / spoofing character. */
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
