import { Badge } from "@brika/clay/components/badge";
import {
  CodeBlock,
  CodeBlockActions,
  CodeBlockContent,
  CodeBlockCopyButton,
  CodeBlockHeader,
  CodeBlockInfo,
} from "@brika/clay/components/code-block";
import { Tree, TreeItem } from "@brika/clay/components/tree";
import type { PluginFile } from "@brika/registry-contract";
import { Box, File as FileIcon, Folder, ShieldCheck } from "lucide-react";
import { type ReactNode, useCallback, useMemo, useState } from "react";
import { usePluginFileContent, usePluginFiles } from "@/hooks/use-plugin-files";
import { formatBytes } from "@/lib/format";
import {
  buildTree,
  type FileTreeNode,
  type fileKind,
  fileMeta,
  langLabel,
  shikiLang,
  sortedChildren,
} from "./file-tree";

// npm-style file browser for a published tarball: a two-pane tree + source viewer.

/** A file's label: the mono name plus a "manifest" pill for package.json. */
function FileLabel({ name }: Readonly<{ name: string }>) {
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <span className="truncate font-mono text-[12.5px]">{name}</span>
      {name === "package.json" ? (
        <span className="shrink-0 rounded-full border border-brand/40 bg-brand/10 px-1.5 py-0.5 font-medium font-sans text-[10px] text-brand">
          manifest
        </span>
      ) : null}
    </span>
  );
}

/** Recursively render a level of the file tree with Clay's Tree. A folder is a
 *  TreeItem with nested children; a file is a leaf TreeItem. */
function FileTreeItems({ level }: Readonly<{ level: Map<string, FileTreeNode> }>) {
  return sortedChildren(level).map((node) =>
    node.isDir ? (
      <TreeItem key={node.path} nodeId={node.path} label={node.name}>
        <FileTreeItems level={node.children} />
      </TreeItem>
    ) : (
      <TreeItem key={node.path} nodeId={node.path} label={<FileLabel name={node.name} />} />
    ),
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

// Pinned line-number gutter: `sticky left-0` keeps line numbers visible during horizontal
// scroll. The background rebuilds the code-block header's token layers opaquely, because
// Clay's own gutter token is semi-transparent and would let the scrolling code show through.
const STICKY_GUTTER =
  "[&>*:first-child]:sticky [&>*:first-child]:left-0 [&>*:first-child]:z-10 " +
  "[&>*:first-child]:[background:linear-gradient(var(--code-block-header-bg),var(--code-block-header-bg)),linear-gradient(var(--code-block-subtle-bg),var(--code-block-subtle-bg)),var(--card)]";

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
  const { src, kind, previewable, text, status } = usePluginFileContent(name, version, file);

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
      // Single scroll region: `w-max min-w-full` lets the grid grow to its content so
      // Clay's inner `overflow-x-auto` never adds a second scrollbar.
      <div className="min-h-0 flex-1 overflow-auto">
        <CodeBlockContent
          language={shikiLang(file.path)}
          filename={file.path}
          showLineNumbers
          className={`min-h-full w-max min-w-full ${STICKY_GUTTER}`}
        >
          {text}
        </CodeBlockContent>
      </div>
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
    // Adaptive two-pane browser: the row grows with content (grid minmax); past the
    // max, the tree and source each scroll within their own pane.
    <div className="grid grid-cols-[190px_1fr] grid-rows-[minmax(300px,620px)] sm:grid-cols-[230px_1fr]">
      <div className="min-h-0 overflow-auto border-border border-r">
        <Tree
          expandedIds={expanded}
          onExpandedChange={setExpanded}
          selectedIds={selected}
          onSelectedChange={handleSelect}
          showLines
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
 * npm-style file browser for the published tarball. The file list is fetched lazily on mount
 * (when the Supply chain tab opens), so the detail page never ships it; contents are fetched per file.
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
  const { files, failed } = usePluginFiles(name, version);

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
