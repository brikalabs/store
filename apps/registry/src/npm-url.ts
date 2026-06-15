import { unscopedName } from "@brika/registry-core";

/** Decode a path segment, tolerating `%2f`-encoded scoped names. */
export function decodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/** Parse the version out of a tarball filename: `plugin-x-1.2.3.tgz` -> `1.2.3`. */
export function parseTarballVersion(name: string, file: string): string | null {
  const prefix = `${unscopedName(name)}-`;
  if (!file.startsWith(prefix) || !file.endsWith(".tgz")) return null;
  return file.slice(prefix.length, -".tgz".length);
}
