import { describe, expect, test } from "bun:test";
import type { Marker, ScanResult } from "./core/types";
import { format } from "./format";

const markers: Marker[] = [
  {
    kind: "mock",
    file: "apps/web/src/lib/demo.ts",
    line: 23,
    column: 1,
    reason: "D1 plugins.rating*",
    text: "// @mock: D1 plugins.rating*",
  },
  {
    kind: "unenforced",
    file: "packages/registry-core/src/limits.ts",
    line: 50,
    column: 3,
    reason: "needs a window port",
    text: "// @unenforced: needs a window port",
  },
];

const result: ScanResult = { markers, counts: { mock: 1, unenforced: 1 } };
const empty: ScanResult = { markers: [], counts: {} };

describe("format human", () => {
  test("summarises and groups by kind with reasons", () => {
    const out = format(result, "human");
    expect(out).toContain("2 markers (mock: 1, unenforced: 1)");
    expect(out).toContain("Unenforced (1)");
    expect(out).toContain("packages/registry-core/src/limits.ts:50:3");
    expect(out).toContain("D1 plugins.rating*");
  });

  test("reports nothing for an empty scan", () => {
    expect(format(empty, "human")).toBe("No markers found.");
  });

  test("shows the blame author and date when a marker is enriched", () => {
    const blamed: ScanResult = {
      markers: [
        {
          kind: "todo",
          file: "a.ts",
          line: 5,
          column: 1,
          reason: "ship it",
          text: "// @todo: ship it",
          blame: { author: "Jane Doe", authorTime: 1700000000, commit: "a1b2c3d4" },
        },
      ],
      counts: { todo: 1 },
    };
    // Date+time is locale/timezone-formatted (Intl), so assert author + year, not an exact string.
    const out = format(blamed, "human");
    expect(out).toContain("a.ts:5:1 (Jane Doe, ");
    expect(out).toMatch(/Jane Doe, .*2023/);
  });
});

describe("format json", () => {
  test("emits total, counts, and markers", () => {
    const parsed = JSON.parse(format(result, "json"));
    expect(parsed.total).toBe(2);
    expect(parsed.counts).toEqual({ mock: 1, unenforced: 1 });
    expect(parsed.markers).toHaveLength(2);
  });
});

describe("format github", () => {
  test("emits one workflow annotation per marker at its severity", () => {
    const lines = format(result, "github").split("\n");
    expect(lines[0]).toBe(
      "::notice file=apps/web/src/lib/demo.ts,line=23,col=1::[mock] D1 plugins.rating*",
    );
    expect(lines[1]).toBe(
      "::warning file=packages/registry-core/src/limits.ts,line=50,col=3::[unenforced] needs a window port",
    );
  });
});
