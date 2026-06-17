import { describe, expect, test } from "bun:test";
import { parseLine, parseText } from "./parse";

describe("parseLine", () => {
  test("captures a // @mock: reason comment with its column", () => {
    const raw = "  // @mock: D1 plugins.rating*";
    const [marker, ...rest] = parseLine("a.ts", 5, raw);
    expect(rest).toHaveLength(0);
    expect(marker).toMatchObject({
      kind: "mock",
      file: "a.ts",
      line: 5,
      reason: "D1 plugins.rating*",
    });
    expect(marker?.column).toBe(raw.indexOf("@mock") + 1);
  });

  test("captures a tag inside a JSDoc continuation line", () => {
    const [marker] = parseLine("a.ts", 2, "   * @todo wire the sync cron");
    expect(marker).toMatchObject({ kind: "todo", reason: "wire the sync cron" });
  });

  test("reads a tag with no colon", () => {
    const [marker] = parseLine("a.ts", 1, "// @fixme broken");
    expect(marker).toMatchObject({ kind: "fixme", reason: "broken" });
  });

  test("strips a trailing block-comment close", () => {
    const [marker] = parseLine("a.ts", 1, "/* @hack: temporary shim */");
    expect(marker?.reason).toBe("temporary shim");
  });

  test("requires a comment context (ignores code and strings)", () => {
    expect(parseLine("a.ts", 1, 'const email = "x@todo.com"')).toHaveLength(0);
  });

  test("respects a word boundary after the tag", () => {
    // `@todos` is not `@todo`; the real tag later on the line still matches once.
    expect(parseLine("a.ts", 1, "// @todos are not @todo")).toHaveLength(1);
  });

  test("recognises every registered kind", () => {
    for (const tag of ["mock", "stub", "unenforced", "todo", "hack", "fixme"]) {
      const [marker] = parseLine("a.ts", 1, `// @${tag}: x`);
      expect(marker?.kind).toBe(tag);
    }
  });
});

describe("parseText", () => {
  test("stamps the right 1-based line number per match", () => {
    const text = ["const a = 1;", "// @todo: later", "// @mock: src"].join("\n");
    const markers = parseText("f.ts", text);
    expect(markers).toHaveLength(2);
    expect(markers[0]).toMatchObject({ kind: "todo", line: 2 });
    expect(markers[1]).toMatchObject({ kind: "mock", line: 3 });
  });

  test("a clean document yields nothing", () => {
    expect(parseText("f.ts", "export const x = 1;\nconsole.log(x);")).toEqual([]);
  });
});
