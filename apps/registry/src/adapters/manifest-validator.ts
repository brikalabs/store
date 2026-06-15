import type { ManifestValidator } from "@brika/registry-core";
import { RegistryPublishSchema } from "@brika/schema/store";

/**
 * Publish-time manifest gate. A package is publishable only when it is a valid
 * Brika plugin manifest AND carries the store metadata the registry needs to
 * list it (icon, title, description). `@brika/schema` is the single source of
 * truth for that contract; this adapter just surfaces the first issue as a
 * human-readable message for the publish response.
 */
export class SchemaManifestValidator implements ManifestValidator {
  validate(manifest: Record<string, unknown>): { ok: true } | { ok: false; message: string } {
    const parsed = RegistryPublishSchema.safeParse(manifest);
    if (parsed.success) return { ok: true };
    const issue = parsed.error.issues[0];
    const where = issue && issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
    return { ok: false, message: `${where}${issue?.message ?? "invalid manifest"}` };
  }
}
