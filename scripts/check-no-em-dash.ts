#!/usr/bin/env bun
/**
 * Repo-wide em dash (U+2014) guard.
 *
 * The Biome plugin (`biome-plugins/no-em-dash.grit`) only sees string literals,
 * so this catches the rest: comments, template literals, and JSX text. We scan
 * tracked source files via `git grep` and fail if any em dash is found, pointing
 * the author at a comma, colon, or parentheses instead.
 *
 * Markdown is intentionally excluded: `docs/CONVENTIONS.md` documents the banned
 * character itself, which is the one legitimate occurrence in the repo.
 */
import { $ } from "bun";

const PATTERNS = ["*.ts", "*.tsx", "*.css", "*.json"] as const;

// `git grep` exits 0 when it finds matches, 1 when it finds none. `--untracked`
// also scans new files that are not yet staged (still honouring .gitignore, so
// node_modules and dist stay excluded).
const result = await $`git grep -n --untracked -P ${"\\x{2014}"} -- ${PATTERNS}`.nothrow().quiet();
const output = result.stdout.toString().trim();

if (output.length === 0) {
  console.log("check:no-em-dash: no em dashes found.");
  process.exit(0);
}

console.error("Em dash (U+2014) is banned. Use a comma, colon, or parentheses instead:\n");
console.error(output);
process.exit(1);
