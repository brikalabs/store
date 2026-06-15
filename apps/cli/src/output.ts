import type { CommandSpec } from "./command";
import type { Packed } from "./pack";

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}

/** Show exactly what a publish would upload: digests, sizes, and the file list. */
export function printSummary(packed: Packed): void {
  console.log(`\n${packed.name}@${packed.version}`);
  console.log(`  tarball    ${packed.filename}`);
  console.log(
    `  size       ${formatBytes(packed.size)} packed / ${formatBytes(packed.unpackedSize)} unpacked`,
  );
  console.log(`  integrity  ${packed.integrity}`);
  console.log(`  shasum     ${packed.shasum}`);
  console.log(`  files (${packed.files.length})`);
  for (const file of packed.files) {
    console.log(`    ${file.path}  (${formatBytes(file.size)})`);
  }
}

/** Render help straight from the command list, so it never drifts out of sync. */
export function printHelp(commands: readonly CommandSpec[]): void {
  const label = (spec: CommandSpec): string => `${spec.name} ${spec.args ?? ""}`.trimEnd();
  const width = Math.max(0, ...commands.map((spec) => label(spec).length));
  const lines = commands.map((spec) => `  ${label(spec).padEnd(width)}   ${spec.summary}`);
  console.log(
    [
      "brika - publish Brika plugins to the registry",
      "",
      "Usage:",
      ...lines,
      "",
      "Env:",
      "  BRIKA_REGISTRY   Registry URL (default https://registry.brika.dev)",
      "  BRIKA_TOKEN      Publish token to use instead of the saved login (CI)",
    ].join("\n"),
  );
}
