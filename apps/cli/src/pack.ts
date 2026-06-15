import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

/**
 * Pack a package directory into an npm-compatible tarball using `npm pack`, so
 * the published bytes are byte-identical to what npm/bun would produce
 * (respecting `files` / `.npmignore`). The digests and file list come straight
 * from npm's `--json` report, so `brika pack` and `brika publish --dry-run` can
 * show exactly what a publish will upload before it happens.
 */

export interface PackedFile {
  readonly path: string;
  readonly size: number;
}

export interface Packed {
  readonly name: string;
  readonly version: string;
  readonly manifest: Record<string, unknown>;
  readonly tarball: Uint8Array;
  readonly filename: string;
  /** Subresource Integrity (`sha512-<base64>`); compared against the registry's. */
  readonly integrity: string;
  readonly shasum: string;
  /** Packed (gzipped) size in bytes. */
  readonly size: number;
  readonly unpackedSize: number;
  readonly files: readonly PackedFile[];
}

interface NpmPackEntry {
  readonly filename: string;
  readonly integrity: string;
  readonly shasum: string;
  readonly size: number;
  readonly unpackedSize: number;
  readonly files: readonly { readonly path: string; readonly size: number }[];
}

export async function packDirectory(dir: string): Promise<Packed> {
  const pkg = Bun.file(join(dir, "package.json"));
  if (!(await pkg.exists())) throw new Error(`no package.json found in ${dir}`);
  const manifest = (await pkg.json()) as Record<string, unknown>;
  const name = manifest.name;
  const version = manifest.version;
  if (typeof name !== "string" || typeof version !== "string") {
    throw new Error("package.json must have a string name and version");
  }

  const dest = await mkdtemp(join(tmpdir(), "brika-pack-"));
  try {
    const proc = Bun.spawn(["npm", "pack", "--json", "--pack-destination", dest], {
      cwd: dir,
      stdout: "pipe",
      stderr: "pipe",
    });
    const stdout = await new Response(proc.stdout).text();
    if ((await proc.exited) !== 0) {
      const stderr = await new Response(proc.stderr).text();
      throw new Error(`npm pack failed: ${stderr.trim() || "non-zero exit"}`);
    }
    const entry = (JSON.parse(stdout) as NpmPackEntry[])[0];
    if (entry === undefined) throw new Error("npm pack produced no tarball");
    const filename = basename(entry.filename);
    const tarball = new Uint8Array(await readFile(join(dest, filename)));
    return {
      name,
      version,
      manifest,
      tarball,
      filename,
      integrity: entry.integrity,
      shasum: entry.shasum,
      size: entry.size,
      unpackedSize: entry.unpackedSize,
      files: entry.files.map((file) => ({ path: file.path, size: file.size })),
    };
  } finally {
    await rm(dest, { recursive: true, force: true });
  }
}
