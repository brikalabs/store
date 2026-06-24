import { describe, expect, test } from "bun:test";
import type { PluginFile } from "@brika/registry-contract";
import {
  buildTree,
  type FileTreeNode,
  fileKind,
  filesFromIndex,
  langLabel,
  shikiLang,
  sortedChildren,
} from "./file-tree";

// Minimal PluginFile factory: the helpers under test only read path/size/contentType/isBinary.
function file(path: string, extra: Partial<PluginFile> = {}): PluginFile {
  return {
    path,
    type: "File",
    size: 0,
    contentType: "text/plain",
    hex: "",
    isBinary: false,
    linesCount: 0,
    ...extra,
  };
}

describe("buildTree", () => {
  test("nests directories and counts leaf files per directory", () => {
    const root = buildTree([
      file("src/index.ts", { size: 10 }),
      file("src/lib/util.ts", { size: 20 }),
      file("readme.md", { size: 5 }),
    ]);

    const src = root.get("src");
    expect(src?.isDir).toBe(true);
    expect(src?.fileCount).toBe(2);

    const lib = src?.children.get("lib");
    expect(lib?.isDir).toBe(true);
    expect(lib?.fileCount).toBe(1);

    const indexTs = src?.children.get("index.ts");
    expect(indexTs?.isDir).toBe(false);
    expect(indexTs?.size).toBe(10);

    const readme = root.get("readme.md");
    expect(readme?.isDir).toBe(false);
    expect(readme?.path).toBe("readme.md");
  });
});

describe("sortedChildren", () => {
  test("directories first, then files, each alphabetical", () => {
    const root = buildTree([file("b.ts"), file("a.ts"), file("zeta/x.ts"), file("alpha/y.ts")]);

    const names = sortedChildren(root).map((n) => n.name);
    expect(names).toEqual(["alpha", "zeta", "a.ts", "b.ts"]);
  });
});

describe("filesFromIndex", () => {
  test("strips a leading slash from each path", () => {
    const out = filesFromIndex({ files: { a: file("/src/index.ts"), b: file("readme.md") } });
    expect(out.map((f) => f.path)).toEqual(["src/index.ts", "readme.md"]);
  });

  test("returns empty when files is null or not an object", () => {
    expect(filesFromIndex({ files: null })).toEqual([]);
    expect(filesFromIndex({})).toEqual([]);
  });
});

describe("shikiLang and langLabel", () => {
  test("maps known extensions", () => {
    expect(shikiLang("src/x.ts")).toBe("typescript");
    expect(shikiLang("style.css")).toBe("css");
    expect(langLabel("src/x.ts")).toBe("TS");
  });

  test("falls back for unknown or missing extensions", () => {
    expect(shikiLang("data.unknownext")).toBe("plaintext");
    expect(shikiLang("LICENSE")).toBe("plaintext");
    expect(langLabel("LICENSE")).toBe("FILE");
  });
});

describe("fileKind", () => {
  test("derives kind from contentType and isBinary", () => {
    expect(fileKind(file("logo.png", { contentType: "image/png" }))).toBe("image");
    expect(fileKind(file("index.ts"))).toBe("text");
    expect(fileKind(file("app.wasm", { contentType: "application/wasm", isBinary: true }))).toBe(
      "binary",
    );
  });
});

// Touch the exported type so it stays referenced from the test module.
const _node: FileTreeNode | undefined = undefined;
void _node;
