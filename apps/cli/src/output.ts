import * as p from "@brika/cli-kit/prompts";
import type { Packed } from "./pack";

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}

/** Render the tarball contents (files, sizes, digests) as a note box. */
export function printSummary(packed: Packed): void {
  const lines = [
    `tarball    ${packed.filename}`,
    `size       ${formatBytes(packed.size)} packed / ${formatBytes(packed.unpackedSize)} unpacked`,
    `integrity  ${packed.integrity}`,
    `shasum     ${packed.shasum}`,
    "",
    `files (${packed.files.length})`,
    ...packed.files.map((file) => `  ${file.path}  (${formatBytes(file.size)})`),
  ];
  p.note(lines.join("\n"), `${packed.name}@${packed.version}`);
}
