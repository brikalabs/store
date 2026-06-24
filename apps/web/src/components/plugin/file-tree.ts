import type { PluginFile } from "@brika/registry-contract";
import { formatBytes } from "@/lib/format";

// Pure, React-free helpers behind the file browser: tree building, sorting, and per-file
// metadata. Kept separate from the JSX so they stay unit-testable.

export interface FileTreeNode {
  name: string;
  path: string;
  isDir: boolean;
  size: number;
  fileCount: number;
  children: Map<string, FileTreeNode>;
}

/** Insert one tarball path into the nested directory tree. */
export function insertPath(root: Map<string, FileTreeNode>, file: PluginFile): void {
  const parts = file.path.split("/").filter(Boolean);
  let level = root;
  let prefix = "";
  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i] as string;
    prefix = prefix ? `${prefix}/${part}` : part;
    const isLeaf = i === parts.length - 1;
    const existing = level.get(part);
    const node = existing ?? {
      name: part,
      path: prefix,
      isDir: !isLeaf,
      size: isLeaf ? file.size : 0,
      fileCount: 0,
      children: new Map<string, FileTreeNode>(),
    };
    if (existing === undefined) level.set(part, node);
    if (!isLeaf) level = node.children;
  }
}

/** Fill each directory's leaf-file count in a single pass (so rows are cheap). */
export function computeCounts(node: FileTreeNode): number {
  if (!node.isDir) return 1;
  let total = 0;
  for (const child of node.children.values()) total += computeCounts(child);
  node.fileCount = total;
  return total;
}

/** Build the file tree once, with per-directory counts precomputed. */
export function buildTree(files: readonly PluginFile[]): Map<string, FileTreeNode> {
  const root = new Map<string, FileTreeNode>();
  for (const file of files) insertPath(root, file);
  for (const node of root.values()) computeCounts(node);
  return root;
}

// Flatten npm's path-keyed file index; strip the wire paths' leading slash, which the
// tree and asset URLs don't use.
export function filesFromIndex(json: unknown): PluginFile[] {
  const map = (json as { files?: unknown }).files;
  if (map === null || typeof map !== "object") return [];
  return Object.values(map as Record<string, PluginFile>).map((file) => ({
    ...file,
    path: file.path.replace(/^\//, ""),
  }));
}

/** Viewer kind, taken from the server's content metadata (no extension guessing). */
export function fileKind(file: PluginFile): "image" | "text" | "binary" {
  if (file.contentType.startsWith("image/")) return "image";
  return file.isBinary ? "binary" : "text";
}

/** A short uppercase language tag for a path: `src/x.ts` -> `TS`. */
export function langLabel(path: string): string {
  const dot = path.lastIndexOf(".");
  const ext = dot === -1 ? "" : path.slice(dot + 1).toUpperCase();
  return ext || "FILE";
}

/** Map a file extension to a Shiki language identifier. */
export function shikiLang(path: string): string {
  const dot = path.lastIndexOf(".");
  const ext = dot === -1 ? "" : path.slice(dot + 1).toLowerCase();
  const MAP: Record<string, string> = {
    ts: "typescript",
    tsx: "tsx",
    js: "javascript",
    jsx: "jsx",
    mjs: "javascript",
    cjs: "javascript",
    json: "json",
    jsonc: "json",
    md: "markdown",
    markdown: "markdown",
    css: "css",
    scss: "scss",
    less: "less",
    html: "html",
    htm: "html",
    yml: "yaml",
    yaml: "yaml",
    toml: "toml",
    xml: "xml",
    svg: "xml",
    sh: "bash",
    bash: "bash",
  };
  return MAP[ext] ?? "plaintext";
}

/** The viewer's "N lines · size" / "size" meta, from the server's line count. */
export function fileMeta(file: PluginFile, kind: ReturnType<typeof fileKind>): string {
  return kind === "text" && file.linesCount > 0
    ? `${file.linesCount} lines · ${formatBytes(file.size)}`
    : formatBytes(file.size);
}

/** Sorted children: dirs first, then files, each group alphabetical. */
export function sortedChildren(level: Map<string, FileTreeNode>): FileTreeNode[] {
  const nodes = [...level.values()];
  const dirs = nodes.filter((n) => n.isDir).sort((a, b) => a.name.localeCompare(b.name));
  const files = nodes.filter((n) => !n.isDir).sort((a, b) => a.name.localeCompare(b.name));
  return [...dirs, ...files];
}
