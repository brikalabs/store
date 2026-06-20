import { expect, test } from "bun:test";
import { displayNameSchema, hasUnsafeLabelChars } from "./labels";

// Built at runtime from code points so this source file stays pure ASCII (no invisible
// glyph can hide in it, and the repo's no-em-dash / invisible-char guard stays happy).
const ZERO_WIDTH_SPACE = String.fromCharCode(0x200b); // Cf
const NUL = String.fromCharCode(0x00); // Cc
const HANGUL_FILLER = String.fromCharCode(0x3164); // blank filler letter
const BIDI_OVERRIDE = String.fromCharCode(0x202e); // Cf
const COMBINING_ACUTE = String.fromCharCode(0x0301); // NFD accent

test("accepts an ordinary label", () => {
  expect(displayNameSchema.parse("Brika Labs")).toBe("Brika Labs");
});

test("normalizes NFD input to NFC", () => {
  // "e" + combining acute (NFD) collapses to the single NFC code point U+00E9.
  expect(displayNameSchema.parse(`Caf${"e"}${COMBINING_ACUTE}`)).toBe(
    String.fromCharCode(0x43, 0x61, 0x66, 0xe9),
  );
});

test("rejects empty and over-long labels", () => {
  expect(displayNameSchema.safeParse("").success).toBe(false);
  expect(displayNameSchema.safeParse("x".repeat(121)).success).toBe(false);
});

test("rejects invisible / control / format / filler characters", () => {
  expect(hasUnsafeLabelChars(`a${ZERO_WIDTH_SPACE}b`)).toBe(true);
  expect(hasUnsafeLabelChars(`a${NUL}b`)).toBe(true);
  expect(hasUnsafeLabelChars(`a${HANGUL_FILLER}b`)).toBe(true);
  expect(hasUnsafeLabelChars(`evil${BIDI_OVERRIDE}name`)).toBe(true);
  expect(hasUnsafeLabelChars("Brika Labs")).toBe(false);
  expect(displayNameSchema.safeParse(`evil${BIDI_OVERRIDE}name`).success).toBe(false);
});
