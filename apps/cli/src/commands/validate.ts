import { CliError } from "@brika/cli-kit";
import { RegistryPublishSchema } from "@brika/schema/store";
import type { Packed } from "../lib/tarball";

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
