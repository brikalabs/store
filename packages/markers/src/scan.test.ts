import { describe, expect, test } from "bun:test";
import type { Marker } from "./core/types";
import { type BlamePort, blameMarkers, type GrepPort, scan } from "./scan";

/** A grep that ignores its query and replays canned `path:lineno:content` lines. */
function fakeGrep(lines: string[]): GrepPort {
  return async () => lines;
}

describe("scan", () => {
  test("parses grep output into located markers, sorted and counted", async () => {
    const grep = fakeGrep([
      "apps/web/src/lib/demo.ts:23:// @mock: D1 plugins.rating*",
      "packages/registry-core/src/limits.ts:50:  maxScopesPerUser: 3, // @unenforced: needs a port",
      "apps/registry/src/x.ts:8:  // @todo: ship the sync cron",
    ]);
    const result = await scan({ grep });

    expect(result.markers).toHaveLength(3);
    expect(result.counts).toEqual({ mock: 1, unenforced: 1, todo: 1 });
    // Sorted by file then line.
    expect(result.markers.map((m) => m.file)).toEqual([
      "apps/registry/src/x.ts",
      "apps/web/src/lib/demo.ts",
      "packages/registry-core/src/limits.ts",
    ]);
  });

  test("passes the registered search terms and pathspecs to the grep port", async () => {
    let seenTerms: readonly string[] = [];
    let seenPaths: readonly string[] = [];
    const grep: GrepPort = async (terms, paths) => {
      seenTerms = terms;
      seenPaths = paths;
      return [];
    };
    const result = await scan({ grep });

    expect(result.markers).toHaveLength(0);
    // Every kind contributes exactly its `@tag`; markers are comment-only.
    expect(seenTerms).toEqual(["@mock", "@stub", "@unenforced", "@todo", "@hack", "@fixme"]);
    expect(seenPaths).toContain(":(exclude)packages/markers/**");
  });

  test("skips malformed grep lines", async () => {
    const result = await scan({ grep: fakeGrep(["not-a-grep-line", "also bad"]) });
    expect(result.markers).toHaveLength(0);
  });

  test("the default git-grep adapter finds real markers in the repo", async () => {
    // No injected grep: this drives the actual `git grep` over the working tree.
    // The registry limits carry several `@unenforced` markers, so the scan is
    // never empty and every result is well-formed.
    const result = await scan();
    expect(result.markers.length).toBeGreaterThan(0);
    expect(result.counts.unenforced).toBeGreaterThan(0);
    for (const marker of result.markers) {
      expect(marker.file).not.toBe("");
      expect(marker.line).toBeGreaterThan(0);
      expect(marker.file.startsWith("packages/markers/")).toBe(false);
    }
  });
});

describe("blameMarkers", () => {
  test("attaches author and short commit via the injected blame port", async () => {
    const markers: Marker[] = [
      { kind: "unenforced", file: "a.ts", line: 12, column: 1, reason: "r", text: "t" },
    ];
    const blame: BlamePort = async () =>
      [
        "a1b2c3d4e5f60718293a4b5c6d7e8f9012345678 12 12 1",
        "author Jane Doe",
        "author-time 1700000000",
        "\tcode",
      ].join("\n");
    const [enriched] = await blameMarkers(markers, { blame });
    expect(enriched?.blame).toMatchObject({ author: "Jane Doe", commit: "a1b2c3d4" });
  });

  test("the default git-blame adapter enriches a committed line in the repo", async () => {
    const markers: Marker[] = [
      { kind: "todo", file: "LICENSE", line: 1, column: 1, reason: "", text: "" },
    ];
    const [enriched] = await blameMarkers(markers);
    expect(enriched?.blame).not.toBeNull();
    expect(typeof enriched?.blame?.author).toBe("string");
  });
});
