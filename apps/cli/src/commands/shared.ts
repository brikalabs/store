import { CliError } from "@brika/cli-kit";
import * as p from "@brika/cli-kit/prompts";
import { RegistryPublishSchema } from "@brika/schema/store";
import type { Packed } from "../lib/tarball";

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

/** Reject anything that is not a valid, listable Brika plugin before uploading. */
export function assertPublishable(packed: Packed): void {
  const result = RegistryPublishSchema.safeParse(packed.manifest);
  if (result.success) return;
  const detail = result.error.issues
    .map((issue) => {
      const where = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
      return `  - ${where}${issue.message}`;
    })
    .join("\n");
  throw new CliError(`${packed.name} is not a publishable Brika plugin:\n${detail}`);
}
