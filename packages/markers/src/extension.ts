import { execFile } from "node:child_process";
import { promisify } from "node:util";
import * as vscode from "vscode";
import {
  type BlameInfo,
  CONFIG_FILE,
  formatTimestamp,
  KINDS,
  type Marker,
  type MarkerKindSpec,
  parseBlame,
  parseText,
  resolveKinds,
  withBlame,
} from "./core";

/**
 * Brika Markers: surface every marker kind live in the editor, driven by the
 * same parser the CLI uses. Kinds come from `markers.config.json`; the tree
 * groups by kind or, toggled, sorts by git authorship date.
 */

const SELECTOR: vscode.DocumentSelector = [
  { language: "typescript", scheme: "file" },
  { language: "typescriptreact", scheme: "file" },
];

const FILE_GLOB = "**/*.{ts,tsx}";
const EXCLUDE_GLOB = "{**/node_modules/**,**/dist/**,**/.wrangler/**,packages/markers/**}";
const DEBOUNCE_MS = 350;

const exec = promisify(execFile);

function severityFor(kind: string, kinds: readonly MarkerKindSpec[]): vscode.DiagnosticSeverity {
  switch (kinds.find((spec) => spec.name === kind)?.severity) {
    case "error":
      return vscode.DiagnosticSeverity.Error;
    case "warning":
      return vscode.DiagnosticSeverity.Warning;
    default:
      return vscode.DiagnosticSeverity.Information;
  }
}

function isIgnored(relativePath: string, kinds: readonly MarkerKindSpec[]): boolean {
  if (relativePath.startsWith("packages/markers/")) return true;
  return kinds.some((kind) => kind.ignore.includes(relativePath));
}

/** `author, Jun 16, 2026, 2:30 PM` (or just the author for an uncommitted line). */
function authorLabel(blame: BlameInfo | null | undefined): string {
  if (blame === null || blame === undefined) return "";
  return blame.authorTime > 0
    ? `${blame.author}, ${formatTimestamp(blame.authorTime)}`
    : blame.author;
}

function toDiagnostic(marker: Marker, kinds: readonly MarkerKindSpec[]): vscode.Diagnostic {
  const line = Math.max(0, marker.line - 1);
  const range = new vscode.Range(
    line,
    Math.max(0, marker.column - 1),
    line,
    Number.MAX_SAFE_INTEGER,
  );
  const spec = kinds.find((entry) => entry.name === marker.kind);
  const who = authorLabel(marker.blame);
  const detail = who ? `  ·  added by ${who}` : "";
  const message = `${spec?.title ?? marker.kind}: ${marker.reason || "(no reason given)"}${detail}`;
  const diagnostic = new vscode.Diagnostic(range, message, severityFor(marker.kind, kinds));
  diagnostic.source = "markers";
  diagnostic.code = spec
    ? {
        value: marker.kind,
        target: vscode.Uri.parse(
          `https://github.com/brikalabs/store/blob/main/packages/markers/README.md#kinds`,
        ),
      }
    : marker.kind;
  return diagnostic;
}

/** Read author + git blame from the workspace via the `git` CLI; empty on failure. */
async function gitBlame(
  cwd: string,
  file: string,
  lines: readonly number[],
): Promise<Map<number, BlameInfo>> {
  try {
    const ranges = lines.flatMap((line) => ["-L", `${line},${line}`]);
    const { stdout } = await exec("git", ["blame", "--line-porcelain", ...ranges, "--", file], {
      cwd,
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
    });
    return parseBlame(stdout.toString());
  } catch {
    return new Map();
  }
}

type SortMode = "kind" | "date";

type TreeNode =
  | { readonly node: "group"; readonly kind: string }
  | { readonly node: "leaf"; readonly marker: Marker };

/** The Markers view: grouped by kind, or a flat list sorted by authorship date. */
class MarkerTreeProvider implements vscode.TreeDataProvider<TreeNode> {
  private readonly changed = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this.changed.event;
  private sort: SortMode = "kind";

  constructor(
    private readonly markers: () => readonly Marker[],
    private readonly kinds: () => readonly MarkerKindSpec[],
  ) {}

  refresh(): void {
    this.changed.fire();
  }

  toggleSort(): void {
    this.sort = this.sort === "kind" ? "date" : "kind";
    void vscode.commands.executeCommand("setContext", "brikaMarkers.sort", this.sort);
    this.refresh();
  }

  getTreeItem(node: TreeNode): vscode.TreeItem {
    return node.node === "group" ? this.groupItem(node.kind) : this.leafItem(node.marker);
  }

  getChildren(node?: TreeNode): TreeNode[] {
    if (node === undefined) return this.roots();
    if (node.node === "group") {
      return this.markers()
        .filter((marker) => marker.kind === node.kind)
        .map((marker) => ({ node: "leaf", marker }));
    }
    return [];
  }

  private roots(): TreeNode[] {
    if (this.sort === "date") {
      return [...this.markers()]
        .sort((a, b) => (b.blame?.authorTime ?? 0) - (a.blame?.authorTime ?? 0))
        .map((marker) => ({ node: "leaf", marker }));
    }
    return this.kinds()
      .filter((kind) => this.markers().some((marker) => marker.kind === kind.name))
      .map((kind) => ({ node: "group", kind: kind.name }));
  }

  private groupItem(kind: string): vscode.TreeItem {
    const spec = this.kinds().find((entry) => entry.name === kind);
    const count = this.markers().filter((marker) => marker.kind === kind).length;
    const item = new vscode.TreeItem(
      `${spec?.title ?? kind} (${count})`,
      vscode.TreeItemCollapsibleState.Expanded,
    );
    item.tooltip = spec?.description;
    item.iconPath = new vscode.ThemeIcon("tag");
    return item;
  }

  private leafItem(marker: Marker): vscode.TreeItem {
    const item = new vscode.TreeItem(
      marker.reason || "(no reason given)",
      vscode.TreeItemCollapsibleState.None,
    );
    const base = marker.file.split("/").pop() ?? marker.file;
    const who = authorLabel(marker.blame);
    const prefix = this.sort === "date" ? `${marker.kind} · ` : "";
    item.description = who
      ? `${prefix}${base}:${marker.line} · ${who}`
      : `${prefix}${base}:${marker.line}`;
    item.tooltip = this.tooltip(marker);
    item.iconPath = new vscode.ThemeIcon(marker.blame ? "git-commit" : "circle-small");
    item.command = {
      command: "brikaMarkers.reveal",
      title: "Reveal marker",
      arguments: [marker.file, marker.line, marker.column],
    };
    return item;
  }

  private tooltip(marker: Marker): string {
    const head = `${marker.file}:${marker.line}  [${marker.kind}]`;
    const reason = marker.reason || "(no reason given)";
    if (!marker.blame) return `${head}\n${reason}`;
    const when = marker.blame.authorTime > 0 ? `, ${formatTimestamp(marker.blame.authorTime)}` : "";
    return `${head}\n${reason}\n\n${marker.blame.author}${when} · ${marker.blame.commit}`;
  }
}

/** A CodeLens above each marker line, showing its kind and reason. */
class MarkerCodeLensProvider implements vscode.CodeLensProvider {
  constructor(private readonly kinds: () => readonly MarkerKindSpec[]) {}

  provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
    const relativePath = vscode.workspace.asRelativePath(document.uri, false);
    const kinds = this.kinds();
    if (isIgnored(relativePath, kinds)) return [];
    return parseText(relativePath, document.getText(), kinds).map((marker) => {
      const line = Math.max(0, marker.line - 1);
      const spec = kinds.find((entry) => entry.name === marker.kind);
      return new vscode.CodeLens(new vscode.Range(line, 0, line, 0), {
        title: `$(tag) ${spec?.title ?? marker.kind}: ${marker.reason || "no reason"}`,
        command: "brikaMarkers.reveal",
        arguments: [marker.file, marker.line, marker.column],
      });
    });
  }
}

/** Owns the resolved kinds, diagnostics, the marker cache, and the rescan lifecycle. */
class MarkersController {
  private readonly diagnostics = vscode.languages.createDiagnosticCollection("markers");
  private readonly byFile = new Map<string, Marker[]>();
  private readonly debounces = new Map<string, ReturnType<typeof setTimeout>>();
  private kinds: MarkerKindSpec[] = [...KINDS];
  readonly tree = new MarkerTreeProvider(
    () => [...this.byFile.values()].flat(),
    () => this.enabledKinds(),
  );

  codeLens(): MarkerCodeLensProvider {
    return new MarkerCodeLensProvider(() => this.enabledKinds());
  }

  private root(): string | undefined {
    return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  }

  /** Kinds from `markers.config.json` (overlaying defaults), minus any disabled in settings. */
  private enabledKinds(): MarkerKindSpec[] {
    const enabled = vscode.workspace
      .getConfiguration("brikaMarkers")
      .get<string[]>("enabledKinds", []);
    return enabled.length > 0
      ? this.kinds.filter((kind) => enabled.includes(kind.name))
      : this.kinds;
  }

  private async loadConfig(): Promise<void> {
    const root = vscode.workspace.workspaceFolders?.[0];
    if (root === undefined) {
      this.kinds = [...KINDS];
      return;
    }
    try {
      const bytes = await vscode.workspace.fs.readFile(vscode.Uri.joinPath(root.uri, CONFIG_FILE));
      this.kinds = resolveKinds(new TextDecoder().decode(bytes));
    } catch {
      this.kinds = [...KINDS];
    }
  }

  /** Re-parse one document live (no blame; that follows on save). */
  update(document: vscode.TextDocument): void {
    if (!vscode.languages.match(SELECTOR, document)) return;
    const relativePath = vscode.workspace.asRelativePath(document.uri, false);
    if (isIgnored(relativePath, this.kinds)) {
      this.clear(document.uri);
      return;
    }
    const markers = parseText(relativePath, document.getText(), this.enabledKinds());
    this.store(document.uri, markers);
  }

  schedule(document: vscode.TextDocument): void {
    const key = document.uri.fsPath;
    clearTimeout(this.debounces.get(key));
    this.debounces.set(
      key,
      setTimeout(() => this.update(document), DEBOUNCE_MS),
    );
  }

  private clear(uri: vscode.Uri): void {
    this.diagnostics.delete(uri);
    this.byFile.delete(uri.fsPath);
    this.tree.refresh();
  }

  private store(uri: vscode.Uri, markers: Marker[]): void {
    if (markers.length === 0) {
      this.clear(uri);
      return;
    }
    this.byFile.set(uri.fsPath, markers);
    this.diagnostics.set(
      uri,
      markers.map((marker) => toDiagnostic(marker, this.kinds)),
    );
    this.tree.refresh();
  }

  /** Rescan every source file from disk, enriched with git blame. */
  async scanWorkspace(): Promise<void> {
    await this.loadConfig();
    const files = await vscode.workspace.findFiles(FILE_GLOB, EXCLUDE_GLOB);
    this.byFile.clear();
    this.diagnostics.clear();
    await Promise.all(files.map((uri) => this.scanFile(uri)));
    this.tree.refresh();
  }

  private async scanFile(uri: vscode.Uri): Promise<void> {
    const relativePath = vscode.workspace.asRelativePath(uri, false);
    if (isIgnored(relativePath, this.kinds)) return;
    const bytes = await vscode.workspace.fs.readFile(uri);
    const parsed = parseText(relativePath, new TextDecoder().decode(bytes), this.enabledKinds());
    if (parsed.length === 0) return;
    const root = this.root();
    const blameByLine = root
      ? await gitBlame(
          root,
          relativePath,
          parsed.map((marker) => marker.line),
        )
      : new Map<number, BlameInfo>();
    const markers = withBlame(parsed, new Map([[relativePath, blameByLine]]));
    this.byFile.set(uri.fsPath, markers);
    this.diagnostics.set(
      uri,
      markers.map((marker) => toDiagnostic(marker, this.kinds)),
    );
  }

  dispose(): void {
    for (const handle of this.debounces.values()) clearTimeout(handle);
    this.diagnostics.dispose();
  }
}

async function reveal(file: string, line: number, column: number): Promise<void> {
  const root = vscode.workspace.workspaceFolders?.[0];
  if (root === undefined) return;
  const document = await vscode.workspace.openTextDocument(vscode.Uri.joinPath(root.uri, file));
  const editor = await vscode.window.showTextDocument(document);
  const position = new vscode.Position(Math.max(0, line - 1), Math.max(0, column - 1));
  editor.selection = new vscode.Selection(position, position);
  editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
}

export function activate(context: vscode.ExtensionContext): void {
  const controller = new MarkersController();
  void vscode.commands.executeCommand("setContext", "brikaMarkers.sort", "kind");
  context.subscriptions.push(
    controller,
    vscode.window.registerTreeDataProvider("brikaMarkers.tree", controller.tree),
    vscode.languages.registerCodeLensProvider(SELECTOR, controller.codeLens()),
    vscode.commands.registerCommand("brikaMarkers.refresh", () => controller.scanWorkspace()),
    vscode.commands.registerCommand("brikaMarkers.toggleSort", () => controller.tree.toggleSort()),
    vscode.commands.registerCommand("brikaMarkers.reveal", reveal),
    vscode.workspace.onDidChangeTextDocument((event) => controller.schedule(event.document)),
    vscode.workspace.onDidOpenTextDocument((document) => controller.update(document)),
    vscode.workspace.onDidSaveTextDocument(() => controller.scanWorkspace()),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration("brikaMarkers")) void controller.scanWorkspace();
    }),
  );
  void controller.scanWorkspace();
}

export function deactivate(): void {
  // Disposables registered on the context are cleaned up by VSCode.
}
