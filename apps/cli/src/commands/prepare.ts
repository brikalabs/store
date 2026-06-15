import { type Packed, packDirectory } from "../lib/tarball";
import { printSummary } from "./summary";
import { assertPublishable } from "./validate";

/**
 * Pack a plugin directory, validate it against the publish contract, and print
 * the tarball summary. Shared by `pack` and `publish`; throws a CliError when
 * the manifest is not a publishable Brika plugin.
 */
export async function prepare(dir: string): Promise<Packed> {
  const packed = await packDirectory(dir);
  assertPublishable(packed);
  printSummary(packed);
  return packed;
}
