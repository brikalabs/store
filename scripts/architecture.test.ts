import { describe, expect, test } from "bun:test";
import { architecture } from "./architecture-rules";

/**
 * Architecture rules as tests (ArchUnit-style): each rule is one `bun test` case that
 * fails - naming the offending file + import - if the layering is violated. Runs in the
 * normal test suite, so a PR that reaches past the domain breaks the build here too (the
 * same rules also run standalone via `bun run check:architecture` in lint).
 */
describe("architecture", () => {
  for (const { description, violations } of architecture.checkEach()) {
    test(description, () => {
      expect(violations).toEqual([]);
    });
  }
});
