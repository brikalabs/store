import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

/**
 * Pack a package directory into an npm-compatible tarball using `npm pack`,
 * so the bytes we publish are byte-identical to what npm/bun would produce
 * (respecting `files` / `.npmignore`).
 */

export interface Packed {
  readonly name: string;
  readonly version: string;
  readonly manifest: Record<string, unknown>;
  readonly tarball: Uint8Array;
}

interface NpmPackEntry {
  readonly filename: string;
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
    const entries = JSON.parse(stdout) as NpmPackEntry[];
    const filename = entries[0]?.filename;
    if (filename === undefined) throw new Error("npm pack produced no tarball");
    const tarball = new Uint8Array(await readFile(join(dest, basename(filename))));
    return { name, version, manifest, tarball };
  } finally {
    await rm(dest, { recursive: true, force: true });
  }
}
