#!/usr/bin/env bun
/**
 * `markers` CLI: find and report every marker in the repo. Informational by
 * design (it always exits 0); it surfaces the gap between "declared" and "done"
 * so it stays visible rather than rotting.
 *
 * Usage:
 *   markers                      grouped human report of all markers
 *   markers --kind mock          only one kind (repeatable)
 *   markers --path apps/web      only paths containing this substring (repeatable)
 *   markers --blame              annotate each marker with git author + date
 *   markers --sort date          sort by date (implies --blame); also: file | kind
 *   markers --format json        machine output (json | github | human)
 *
 * Kinds come from `markers.config.json` at the repo root (overlaying the built-in defaults) if present.
 */
import { CONFIG_FILE, resolveKinds } from "./core/config";
import type { Marker } from "./core/types";
import { type Format, format } from "./format";
import { blameMarkers, scan } from "./scan";

type Sort = "file" | "kind" | "date";

interface Args {
  readonly kinds: string[];
  readonly paths: string[];
  readonly format: Format;
  readonly sort: Sort;
  readonly blame: boolean;
}

const VALUE_FLAGS: Readonly<Record<string, "kind" | "path" | "format" | "sort">> = {
  "--kind": "kind",
  "-k": "kind",
  "--path": "path",
  "-p": "path",
  "--format": "format",
  "-f": "format",
  "--sort": "sort",
  "-s": "sort",
};

interface MutableArgs {
  kinds: string[];
  paths: string[];
  format: Format;
  sort: Sort;
  blame: boolean;
}

function applyValueFlag(
  args: MutableArgs,
  target: "kind" | "path" | "format" | "sort",
  value: string,
): void {
  if (target === "kind") args.kinds.push(value);
  else if (target === "path") args.paths.push(value);
  else if (target === "sort" && (value === "file" || value === "kind" || value === "date")) {
    args.sort = value;
  } else if (target === "format" && (value === "json" || value === "github" || value === "human")) {
    args.format = value;
  }
}

function parseArgs(argv: readonly string[]): Args {
  const args: MutableArgs = { kinds: [], paths: [], format: "human", sort: "file", blame: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index] ?? "";
    if (arg === "--blame") {
      args.blame = true;
      continue;
    }
    const target = VALUE_FLAGS[arg];
    const value = argv[index + 1];
    if (target === undefined || value === undefined) continue;
    applyValueFlag(args, target, value);
    index += 1;
  }
  return args;
}

function sortMarkers(markers: readonly Marker[], sort: Sort): Marker[] {
  if (sort === "date") {
    return [...markers].sort((a, b) => (b.blame?.authorTime ?? 0) - (a.blame?.authorTime ?? 0));
  }
  if (sort === "kind") {
    return [...markers].sort(
      (a, b) => a.kind.localeCompare(b.kind) || a.file.localeCompare(b.file),
    );
  }
  return [...markers];
}

const args = parseArgs(process.argv.slice(2));

const configFile = Bun.file(CONFIG_FILE);
const allKinds = resolveKinds((await configFile.exists()) ? await configFile.text() : null);

const unknown = args.kinds.filter((name) => !allKinds.some((kind) => kind.name === name));
if (unknown.length > 0) {
  console.error(`Unknown kind(s): ${unknown.join(", ")}`);
  console.error(`Known kinds: ${allKinds.map((kind) => kind.name).join(", ")}`);
  process.exit(2);
}

const selected =
  args.kinds.length > 0 ? allKinds.filter((kind) => args.kinds.includes(kind.name)) : allKinds;
const result = await scan({ kinds: selected });
const matched =
  args.paths.length > 0
    ? result.markers.filter((marker) => args.paths.some((path) => marker.file.includes(path)))
    : result.markers;

const enriched = args.blame || args.sort === "date" ? await blameMarkers(matched) : matched;
const markers = sortMarkers(enriched, args.sort);

const counts: Record<string, number> = {};
for (const marker of markers) counts[marker.kind] = (counts[marker.kind] ?? 0) + 1;

console.log(format({ markers, counts }, args.format, allKinds));
