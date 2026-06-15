import * as p from "@brika/cli-kit/prompts";
import type { Packed } from "../lib/tarball";

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}

/** Render the packed tarball (digests, sizes, file list) as a note box. */
export function printSummary(packed: Packed): void {
  const rows: [label: string, value: string][] = [
    ["tarball", packed.filename],
    ["size", `${formatBytes(packed.size)} packed / ${formatBytes(packed.unpackedSize)} unpacked`],
    ["integrity", packed.integrity],
    ["shasum", packed.shasum],
  ];
  const labelWidth = Math.max(...rows.map(([label]) => label.length));
  const lines = [
    ...rows.map(([label, value]) => `${label.padEnd(labelWidth)}  ${value}`),
    "",
    `files (${packed.files.length})`,
    ...packed.files.map((file) => `  ${file.path}  (${formatBytes(file.size)})`),
  ];
  p.note(lines.join("\n"), `${packed.name}@${packed.version}`);
}
