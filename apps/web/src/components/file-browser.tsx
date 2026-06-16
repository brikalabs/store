import { Badge } from "@brika/clay/components/badge";
import {
  CodeBlock,
  CodeBlockActions,
  CodeBlockContent,
  CodeBlockCopyButton,
  CodeBlockHeader,
  CodeBlockInfo,
} from "@brika/clay/components/code-block";
import type { PluginFile } from "@brika/registry-contract";
import { Box, File as FileIcon, Folder, ShieldCheck } from "lucide-react";
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { formatBytes } from "../lib/format";
import { assetUrl, pluginVersionUrl } from "../lib/registry-source";
import {
  Tree,
  TreeItem,
  TreeItemBadge,
  TreeItemContent,
  TreeItemLabel,
  TreeItemRow,
} from "./clay/tree";

/**
 * npm-style file browser for a published tarball: a two-pane tree + source
 * viewer. The file *list* is fetched lazily (when {@link FilesSection} mounts, i.e.
 * when the Supply chain tab opens), and each file's bytes are fetched on click,
 * capped by size. Extracted from the plugin detail route so the subsystem is
 * reusable and the route file stays focused on layout.
 */

interface FileTreeNode {
  name: string;
  path: string;
  isDir: boolean;
  size: number;
  fileCount: number;
  children: Map<string, FileTreeNode>;
}

/** Insert one tarball path into the nested directory tree. */
function insertPath(root: Map<string, FileTreeNode>, file: PluginFile): void {
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
function computeCounts(node: FileTreeNode): number {
  if (!node.isDir) return 1;
  let total = 0;
  for (const child of node.children.values()) total += computeCounts(child);
  node.fileCount = total;
  return total;
}

/** Build the file tree once, with per-directory counts precomputed. */
function buildTree(files: readonly PluginFile[]): Map<string, FileTreeNode> {
  const root = new Map<string, FileTreeNode>();
  for (const file of files) insertPath(root, file);
  for (const node of root.values()) computeCounts(node);
  return root;
}

/**
 * Flatten npm's path-keyed file index into the array the tree consumes. The
 * wire paths carry a leading slash (`/src/index.ts`); the tree and asset URLs
 * work in slash-free paths, so normalize on the way in.
 */
function filesFromIndex(json: unknown): PluginFile[] {
  const map = (json as { files?: unknown }).files;
  if (map === null || typeof map !== "object") return [];
  return Object.values(map as Record<string, PluginFile>).map((file) => ({
    ...file,
    path: file.path.replace(/^\//, ""),
  }));
}

// Cap inline previews so a large file never streams megabytes into the page.
const MAX_PREVIEW_BYTES = 256 * 1024;

/** Viewer kind, taken from the server's content metadata (no extension guessing). */
function fileKind(file: PluginFile): "image" | "text" | "binary" {
  if (file.contentType.startsWith("image/")) return "image";
  return file.isBinary ? "binary" : "text";
}

/** A short uppercase language tag for a path: `src/x.ts` -> `TS`. */
function langLabel(path: string): string {
  const dot = path.lastIndexOf(".");
  const ext = dot === -1 ? "" : path.slice(dot + 1).toUpperCase();
  return ext || "FILE";
}

/** Map a file extension to a Shiki language identifier. */
function shikiLang(path: string): string {
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
function fileMeta(file: PluginFile, kind: ReturnType<typeof fileKind>): string {
  return kind === "text" && file.linesCount > 0
    ? `${file.linesCount} lines · ${formatBytes(file.size)}`
    : formatBytes(file.size);
}

/** Sorted children: dirs first, then files, each group alphabetical. */
function sortedChildren(level: Map<string, FileTreeNode>): FileTreeNode[] {
  const nodes = [...level.values()];
  const dirs = nodes.filter((n) => n.isDir).sort((a, b) => a.name.localeCompare(b.name));
  const files = nodes.filter((n) => !n.isDir).sort((a, b) => a.name.localeCompare(b.name));
  return [...dirs, ...files];
}

/** Recursively render a level of the file tree, using the Tree slot components. */
function FileTreeItems({ level }: Readonly<{ level: Map<string, FileTreeNode> }>) {
  return (
    <>
      {sortedChildren(level).map((node) =>
        node.isDir ? (
          <TreeItem key={node.path} nodeId={node.path} isFolder>
            <TreeItemRow>
              <TreeItemLabel>{node.name}</TreeItemLabel>
            </TreeItemRow>
            <TreeItemContent>
              <FileTreeItems level={node.children} />
            </TreeItemContent>
          </TreeItem>
        ) : (
          <TreeItem key={node.path} nodeId={node.path}>
            <TreeItemRow>
              <TreeItemLabel>{node.name}</TreeItemLabel>
              {node.name === "package.json" ? <TreeItemBadge>manifest</TreeItemBadge> : null}
            </TreeItemRow>
          </TreeItem>
        ),
      )}
    </>
  );
}

/** A centred message in the viewer pane (plain icon + title + description). */
function ViewerMessage({ title, children }: Readonly<{ title: string; children?: ReactNode }>) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2.5 p-8 text-center">
      <FileIcon className="size-8 text-muted-foreground/40" />
      <span className="font-heading font-semibold text-base text-foreground">{title}</span>
      {children ? <span className="text-muted-foreground text-sm">{children}</span> : null}
    </div>
  );
}

/** Empty-state shown in the viewer pane when no file is selected. */
function ViewerEmptyState() {
  return (
    <ViewerMessage title="Select a file to view its contents">
      Source is read straight from the published tarball.
    </ViewerMessage>
  );
}

/** Not-previewable fallback (binary, oversized, or load error) with an "Open raw" link. */
function ViewerNotPreviewable({ src, reason }: Readonly<{ src: string; reason: string }>) {
  return (
    <ViewerMessage title={reason}>
      <a href={src} target="_blank" rel="noreferrer" className="font-semibold text-brand">
        Open raw
      </a>
    </ViewerMessage>
  );
}

/** Viewer header: path, lang badge, meta, and copy/raw action. */
function ViewerHeader({
  file,
  kind,
  text,
  src,
}: Readonly<{
  file: PluginFile;
  kind: ReturnType<typeof fileKind>;
  text: string | null;
  src: string;
}>) {
  return (
    <CodeBlockHeader>
      <CodeBlockInfo>
        {() => (
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate font-mono text-foreground text-xs">{file.path}</span>
            <Badge variant="outline" className="shrink-0 font-semibold text-[10px]">
              {langLabel(file.path)}
            </Badge>
            <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
              {fileMeta(file, kind)}
            </span>
          </span>
        )}
      </CodeBlockInfo>
      <CodeBlockActions>
        {kind === "text" && text !== null ? (
          <CodeBlockCopyButton />
        ) : (
          <a
            href={src}
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-[11.5px] text-brand"
          >
            Raw
          </a>
        )}
      </CodeBlockActions>
    </CodeBlockHeader>
  );
}

/** Image viewer: centered inline preview. */
function ViewerImage({ src }: Readonly<{ src: string }>) {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center p-6">
      <img src={src} alt="" loading="lazy" className="max-h-[60vh] max-w-full object-contain" />
    </div>
  );
}

/** Loading placeholder shown while the file fetch is in flight. */
function ViewerLoading() {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center p-6 text-muted-foreground text-sm">
      Loading...
    </div>
  );
}

/**
 * The right pane: lazily fetches the selected file's bytes from the (immutable,
 * R2-cached) asset endpoint, capped by size, and renders source with line
 * numbers, an image, or a fallback. Shows an empty state until a file is picked.
 */
function FileViewer({
  name,
  version,
  file,
}: Readonly<{ name: string; version: string; file: PluginFile | undefined }>) {
  const src = file ? assetUrl(name, version, file.path) : "";
  const kind = file ? fileKind(file) : "binary";
  const previewable = file !== undefined && file.size <= MAX_PREVIEW_BYTES;
  const [text, setText] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");

  useEffect(() => {
    if (file === undefined || kind !== "text" || !previewable) {
      setText(null);
      return;
    }
    let active = true;
    setStatus("loading");
    setText(null);
    fetch(src)
      .then((res) => (res.ok ? res.text() : Promise.reject(new Error("load failed"))))
      .then((body) => {
        if (active) {
          setText(body);
          setStatus("idle");
        }
      })
      .catch(() => {
        if (active) setStatus("error");
      });
    return () => {
      active = false;
    };
  }, [src, kind, previewable, file]);

  if (file === undefined) return <ViewerEmptyState />;

  if (kind === "binary") {
    return <ViewerNotPreviewable src={src} reason="This is a built or binary file." />;
  }
  if (!previewable) {
    return <ViewerNotPreviewable src={src} reason="This file is large." />;
  }
  if (status === "error") {
    return <ViewerNotPreviewable src={src} reason="Could not load this file." />;
  }

  let body: ReactNode;
  if (kind === "image") {
    body = <ViewerImage src={src} />;
  } else if (text === null) {
    body = <ViewerLoading />;
  } else {
    body = (
      <CodeBlockContent
        language={shikiLang(file.path)}
        filename={file.path}
        showLineNumbers
        className="min-h-0 flex-1"
      >
        {text}
      </CodeBlockContent>
    );
  }

  return (
    <CodeBlock variant="subtle" className="flex min-h-0 flex-1 flex-col rounded-none border-0">
      <ViewerHeader file={file} kind={kind} text={text} src={src} />
      {body}
    </CodeBlock>
  );
}

/** The bounded two-pane browser once the file list has loaded: tree + viewer. */
function FileBrowser({
  name,
  version,
  files,
}: Readonly<{ name: string; version: string; files: PluginFile[] }>) {
  const tree = useMemo(() => buildTree(files), [files]);
  // A set of all file paths (non-directory) for O(1) membership checks.
  const filePaths = useMemo(() => new Set(files.map((f) => f.path)), [files]);
  // All folders start collapsed; the user opens what they want.
  const [expanded, setExpanded] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  // Folders must not enter the selected state - filter them out on every change.
  const handleSelect = useCallback(
    (ids: string[]) => setSelected(ids.filter((id) => filePaths.has(id))),
    [filePaths],
  );
  const selectedFile =
    selected[0] === undefined ? undefined : files.find((f) => f.path === selected[0]);

  return (
    // Adaptive two-pane browser: the row grows with content between a min and a
    // max height (grid minmax). Past the max, the tree and the source each scroll
    // within their own pane; nothing spills into the footer.
    <div className="grid grid-cols-[190px_1fr] grid-rows-[minmax(300px,620px)] sm:grid-cols-[230px_1fr]">
      <div className="min-h-0 overflow-auto border-border border-r">
        <Tree
          expandedIds={expanded}
          onExpandedChange={setExpanded}
          selectedIds={selected}
          onSelectedChange={handleSelect}
        >
          <FileTreeItems level={tree} />
        </Tree>
      </div>
      <div className="flex min-h-0 min-w-0 flex-col">
        <FileViewer name={name} version={version} file={selectedFile} />
      </div>
    </div>
  );
}

/**
 * npm-style file browser for the published tarball. The file *list* is fetched
 * lazily from `/v1/plugins/:name/files/:version` when this mounts (i.e. when the
 * Supply chain tab opens), so the detail page never ships it. File contents are
 * then fetched per file on click, capped by size.
 */
export function FilesSection({
  name,
  version,
  tarballName,
  tarballUrl,
  fileCount,
  unpackedSize,
}: Readonly<{
  name: string;
  version: string;
  tarballName: string;
  tarballUrl?: string;
  fileCount?: number;
  unpackedSize?: number;
}>) {
  const [files, setFiles] = useState<PluginFile[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    setFiles(null);
    setFailed(false);
    fetch(`${pluginVersionUrl(name, version)}/index`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("load failed"))))
      .then((json: unknown) => {
        if (active) setFiles(filesFromIndex(json));
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [name, version]);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-bold font-heading text-lg tracking-tight">
          <Folder className="size-4 text-muted-foreground" />
          Files
        </h2>
        <span className="text-muted-foreground text-xs">
          {fileCount ?? 0} files · {formatBytes(unpackedSize ?? 0)} unpacked
        </span>
      </div>
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex items-center gap-2 border-border border-b bg-muted px-4 py-2 font-mono text-[11.5px] text-muted-foreground">
          <Box className="size-3.5" />
          {tarballName}
        </div>
        {files === null || failed ? (
          <div className="flex h-[300px] items-center justify-center text-muted-foreground text-sm">
            {failed ? "Could not load the file list." : "Loading files..."}
          </div>
        ) : (
          <FileBrowser name={name} version={version} files={files} />
        )}
        <div className="flex items-center justify-between gap-2 border-border border-t bg-muted px-4 py-2.5 text-muted-foreground text-xs">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="size-3.5 text-emerald-500" />
            Exactly these files are installed, nothing else runs.
          </span>
          {tarballUrl ? (
            <a
              href={tarballUrl}
              className="shrink-0 font-semibold text-brand"
              target="_blank"
              rel="noreferrer"
            >
              Download tarball
            </a>
          ) : null}
        </div>
      </div>
    </section>
  );
}
