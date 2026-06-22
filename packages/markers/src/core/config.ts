import { z } from "zod";
import { KINDS } from "./kinds";
import type { MarkerKindSpec } from "./types";

/**
 * Configurable kinds: a repo may drop a `markers.config.json` whose kinds overlay the defaults
 * ({@link KINDS}) by name (override an existing kind, or append a new one).
 */

/** Filename the CLI and the editor look for at the workspace root. */
export const CONFIG_FILE = "markers.config.json";

const KindConfigSchema = z.object({
  name: z.string().regex(/^[a-z][a-z0-9-]*$/, "kind name must be lowercase kebab-case"),
  title: z.string().min(1).optional(),
  description: z.string().min(1),
  severity: z.enum(["error", "warning", "info"]).default("info"),
  ignore: z.array(z.string()).default([]),
});

const ConfigSchema = z.object({ kinds: z.array(KindConfigSchema).default([]) });

/** Marker kinds config, before it is overlaid onto the defaults. */
export type MarkersConfig = z.infer<typeof ConfigSchema>;

function titleCase(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/** Resolve the active kinds from optional config JSON (each entry overlays the default of its name). */
export function resolveKinds(configJson?: string | null): MarkerKindSpec[] {
  if (configJson === undefined || configJson === null || configJson.trim() === "") {
    return [...KINDS];
  }
  const config = ConfigSchema.parse(JSON.parse(configJson));
  const byName = new Map<string, MarkerKindSpec>(KINDS.map((kind) => [kind.name, kind]));
  for (const entry of config.kinds) {
    byName.set(entry.name, {
      name: entry.name,
      title: entry.title ?? titleCase(entry.name),
      description: entry.description,
      severity: entry.severity,
      ignore: entry.ignore,
    });
  }
  return [...byName.values()];
}
