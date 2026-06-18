import { mkdir, writeFile } from "node:fs/promises";
import { tarballPath } from "@brika/registry-core";
import { z } from "zod";

/**
 * Seed importer: mirror existing npm packages into the registry's R2 + D1,
 * preserving npm's published integrity. Writes `.seed/seed.sql` (the D1 inserts)
 * and `.seed/tarballs/*` + `.seed/puts.json` (the R2 objects) for wrangler to
 * apply locally or remotely. Latest version only, enough to prove `bun add`.
 *
 *   bun run scripts/seed.ts @brika/plugin-weather @brika/plugin-timer
 */

const NPM = "https://registry.npmjs.org";

const Dist = z.object({ tarball: z.url(), integrity: z.string(), shasum: z.string() });
const Version = z.looseObject({ dist: Dist });
const Packument = z.object({
  "dist-tags": z.object({ latest: z.string() }),
  versions: z.record(z.string(), Version),
});

function sql(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

const names = process.argv.slice(2);
if (names.length === 0) {
  console.error("usage: bun run scripts/seed.ts <name>...");
  process.exit(1);
}

await mkdir(".seed/tarballs", { recursive: true });
const statements: string[] = [];
const puts: Array<{ key: string; file: string }> = [];

for (const name of names) {
  const res = await fetch(`${NPM}/${name.replace("/", "%2F")}`, {
    headers: { accept: "application/json" },
  });
  if (!res.ok) {
    console.error(`skip ${name}: HTTP ${res.status}`);
    continue;
  }
  const parsed = Packument.safeParse(await res.json());
  if (!parsed.success) {
    console.error(`skip ${name}: invalid packument`);
    continue;
  }
  const latest = parsed.data["dist-tags"].latest;
  const version = parsed.data.versions[latest];
  if (version === undefined) {
    console.error(`skip ${name}: no latest version`);
    continue;
  }

  const tarball = await fetch(version.dist.tarball);
  const bytes = new Uint8Array(await tarball.arrayBuffer());
  const key = tarballPath(name, latest);
  const file = `.seed/tarballs/${key.replaceAll("/", "__")}`;
  await writeFile(file, bytes);
  puts.push({ key, file });

  const scope = name.startsWith("@") ? (name.split("/")[0] ?? "") : "";
  statements.push(
    `INSERT OR REPLACE INTO reg_packages (name, scope) VALUES (${sql(name)}, ${sql(scope)});`,
    `INSERT OR REPLACE INTO reg_versions (name, version, manifest, integrity, shasum, size, yanked) VALUES (${sql(name)}, ${sql(latest)}, ${sql(JSON.stringify(version))}, ${sql(version.dist.integrity)}, ${sql(version.dist.shasum)}, ${bytes.length}, 0);`,
    `INSERT OR REPLACE INTO reg_dist_tags (name, tag, version) VALUES (${sql(name)}, 'latest', ${sql(latest)});`,
  );
  console.error(`seeded ${name}@${latest} (${bytes.length} bytes)`);
}

await writeFile(".seed/seed.sql", statements.join("\n"));
await writeFile(".seed/puts.json", JSON.stringify(puts, null, 2));
console.error(`done: ${puts.length} package(s) -> .seed/seed.sql + .seed/tarballs/`);
