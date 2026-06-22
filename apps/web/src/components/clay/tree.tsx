import { cn } from "@brika/clay";
import { ChevronRight, File as FileIcon, Folder } from "lucide-react";
import { createContext, type ReactNode, useCallback, useContext, useMemo } from "react";

/**
 * A slot-based file-tree primitive (Radix-style): a `TreeItem` wraps a `TreeItemRow` and,
 * for folders, a `TreeItemContent` of nested items. Controlled expanded/selected.
 */

interface TreeContextValue {
  readonly expanded: ReadonlySet<string>;
  readonly selected: ReadonlySet<string>;
  readonly onToggle: (id: string) => void;
  readonly onSelect: (id: string) => void;
}

interface ItemContextValue {
  readonly isFolder: boolean;
  readonly open: boolean;
  readonly selected: boolean;
  readonly depth: number;
  readonly activate: () => void;
}

const TreeContext = createContext<TreeContextValue | null>(null);
const ItemContext = createContext<ItemContextValue | null>(null);

function useTree(): TreeContextValue {
  const ctx = useContext(TreeContext);
  if (ctx === null) throw new Error("TreeItem must be rendered inside a Tree");
  return ctx;
}

function useItem(component: string): ItemContextValue {
  const ctx = useContext(ItemContext);
  if (ctx === null) throw new Error(`${component} must be rendered inside a TreeItem`);
  return ctx;
}

export function Tree({
  expandedIds = [],
  onExpandedChange,
  selectedIds = [],
  onSelectedChange,
  className,
  children,
}: Readonly<{
  expandedIds?: readonly string[];
  onExpandedChange?: (ids: string[]) => void;
  selectedIds?: readonly string[];
  onSelectedChange?: (ids: string[]) => void;
  className?: string;
  children: ReactNode;
}>) {
  const expanded = useMemo(() => new Set(expandedIds), [expandedIds]);
  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);
  const onToggle = useCallback(
    (id: string) => {
      const next = new Set(expanded);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      onExpandedChange?.([...next]);
    },
    [expanded, onExpandedChange],
  );
  const onSelect = useCallback((id: string) => onSelectedChange?.([id]), [onSelectedChange]);
  const value = useMemo(
    () => ({ expanded, selected, onToggle, onSelect }),
    [expanded, selected, onToggle, onSelect],
  );
  return (
    <TreeContext.Provider value={value}>
      <div role="tree" className={cn("flex flex-col py-1.5", className)}>
        {children}
      </div>
    </TreeContext.Provider>
  );
}

/** A node in the tree. Folders pass `isFolder` and hold a `TreeItemContent`. */
export function TreeItem({
  nodeId,
  isFolder = false,
  children,
}: Readonly<{ nodeId: string; isFolder?: boolean; children: ReactNode }>) {
  const tree = useTree();
  const parent = useContext(ItemContext);
  const depth = parent === null ? 0 : parent.depth + 1;
  const open = tree.expanded.has(nodeId);
  const selected = tree.selected.has(nodeId);
  const activate = useCallback(
    () => (isFolder ? tree.onToggle(nodeId) : tree.onSelect(nodeId)),
    [isFolder, nodeId, tree.onToggle, tree.onSelect],
  );
  const value = useMemo(
    () => ({ isFolder, open, selected, depth, activate }),
    [isFolder, open, selected, depth, activate],
  );
  return <ItemContext.Provider value={value}>{children}</ItemContext.Provider>;
}

// One indent step; the chevron and guide columns share this width so a child's
// guide line lands exactly under its ancestor folder's chevron.
const INDENT = 18;

// Indent rail: a single repeating gradient (1px line per INDENT-wide band) so the
// guides stay aligned with the chevron column without an array of positional spans.
function GuideLines({ depth }: Readonly<{ depth: number }>) {
  if (depth === 0) return null;
  return (
    <span
      aria-hidden
      className="shrink-0 self-stretch"
      style={{
        width: depth * INDENT,
        backgroundImage: `repeating-linear-gradient(to right, transparent 0 8px, var(--border) 8px 9px, transparent 9px ${INDENT}px)`,
      }}
    />
  );
}

/** The clickable row: indent guides + chevron + glyph + slot children. */
export function TreeItemRow({ children }: Readonly<{ children: ReactNode }>) {
  const item = useItem("TreeItemRow");
  return (
    <button
      type="button"
      role="treeitem"
      aria-expanded={item.isFolder ? item.open : undefined}
      aria-selected={item.selected}
      onClick={item.activate}
      className={cn(
        "flex w-full items-stretch border-l-2 pr-2.5 pl-1.5 text-left transition-colors",
        item.selected
          ? "border-brand bg-brand/10 text-brand"
          : "border-transparent text-foreground hover:bg-muted/50",
      )}
    >
      <GuideLines depth={item.depth} />
      <span className="flex min-w-0 flex-1 items-center gap-1.5 py-1.5">
        <span className="flex shrink-0 items-center justify-center" style={{ width: INDENT }}>
          {item.isFolder ? (
            <ChevronRight
              className={cn(
                "size-3.5 text-muted-foreground/70 transition-transform",
                item.open && "rotate-90",
              )}
            />
          ) : null}
        </span>
        {item.isFolder ? (
          <Folder className="size-4 shrink-0 text-brand" />
        ) : (
          <FileIcon
            className={cn(
              "size-3.5 shrink-0",
              item.selected ? "text-brand" : "text-muted-foreground/45",
            )}
          />
        )}
        {children}
      </span>
    </button>
  );
}

/** The row's name, styled from context (bold folder / mono file) and truncated. */
export function TreeItemLabel({ children }: Readonly<{ children: ReactNode }>) {
  const item = useItem("TreeItemLabel");
  return (
    <span
      className={cn(
        "truncate",
        item.isFolder ? "font-bold font-heading text-[13.5px]" : "font-mono text-[12.5px]",
      )}
    >
      {children}
    </span>
  );
}

/** A trailing brand pill slot (e.g. "manifest"). */
export function TreeItemBadge({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <span className="ml-1 shrink-0 rounded-full border border-brand/40 bg-brand/10 px-1.5 py-0.5 font-medium font-sans text-[10px] text-brand">
      {children}
    </span>
  );
}

/** A folder's nested items; rendered only while the folder is open. */
export function TreeItemContent({ children }: Readonly<{ children: ReactNode }>) {
  const item = useItem("TreeItemContent");
  if (!item.open) return null;
  return children;
}
