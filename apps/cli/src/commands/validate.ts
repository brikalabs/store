import { CliError } from "@brika/cli-kit";
import { RegistryPublishSchema, validateStoreLocales } from "@brika/schema/store";
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

/** Reject bundled `locales/<lang>/store.json` files that don't match the schema. */
export function assertLocalesValid(packed: Packed): void {
  const screenshots = packed.manifest.screenshots;
  const screenshotCount = Array.isArray(screenshots) ? screenshots.length : undefined;
  const issues = validateStoreLocales(packed.localeFiles, { screenshotCount });
  if (issues.length === 0) return;
  const detail = issues.map((issue) => `  - ${issue.path}: ${issue.message}`).join("\n");
  throw new CliError(`${packed.name} has invalid localized store metadata:\n${detail}`);
}
