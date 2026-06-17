import { describe, expect, test } from "bun:test";
import { parseBlame, withBlame } from "./blame";
import type { Marker } from "./types";

const PORCELAIN = [
  "a1b2c3d4e5f60718293a4b5c6d7e8f9012345678 12 12 1",
  "author Jane Doe",
  "author-mail <jane@example.com>",
  "author-time 1700000000",
  "author-tz +0000",
  "committer Jane Doe",
  "committer-time 1700000000",
  "summary add marker",
  "filename a.ts",
  "\tmaxScopesPerUser: 3, // @unenforced: needs a port",
].join("\n");

describe("parseBlame", () => {
  test("maps a committed line to author, time, and short commit", () => {
    expect(parseBlame(PORCELAIN).get(12)).toEqual({
      author: "Jane Doe",
      authorTime: 1700000000,
      commit: "a1b2c3d4",
    });
  });

  test("marks an uncommitted line (all-zero hash)", () => {
    const porcelain = [
      "0000000000000000000000000000000000000000 5 5 1",
      "author Not Committed Yet",
      "author-time 1800000000",
      "\tbrand new line",
    ].join("\n");
    expect(parseBlame(porcelain).get(5)).toEqual({
      author: "Uncommitted",
      authorTime: 0,
      commit: "uncommitted",
    });
  });
});

describe("withBlame", () => {
  test("attaches per-file blame and leaves unmatched markers null", () => {
    const markers: Marker[] = [
      { kind: "unenforced", file: "a.ts", line: 12, column: 1, reason: "r", text: "t" },
      { kind: "todo", file: "b.ts", line: 3, column: 1, reason: "r", text: "t" },
    ];
    const [first, second] = withBlame(markers, new Map([["a.ts", parseBlame(PORCELAIN)]]));
    expect(first?.blame?.author).toBe("Jane Doe");
    expect(second?.blame).toBeNull();
  });
});
