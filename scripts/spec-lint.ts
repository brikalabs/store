#!/usr/bin/env bun
/**
 * Structural validator for the spec system. Catches malformed specs before they land:
 * missing/invalid frontmatter, code/filename/area/group mismatches, broken acceptance
 * criteria, duplicate ids, and unbalanced Gherkin fences. Exits non-zero on any error
 * (warnings do not fail), so CI can gate on `bun run spec:lint`.
 */
import { readFileSync } from "node:fs";
import { basename, dirname } from "node:path";
import { frontmatter, ROOT, SPECS_DIR, specFiles, STATUSES } from "./spec-lib";

const REQUIRED = ["id", "title", "status", "area", "group", "test_mode"];
const errors: string[] = [];
const warnings: string[] = [];
const seen = new Map<string, string>(); // id -> file

for (const file of specFiles()) {
  const rel = file.slice(ROOT.length + 1);
  const text = readFileSync(file, "utf8");
  const fm = frontmatter(text);
  const err = (m: string) => errors.push(`${rel}: ${m}`);

  for (const key of REQUIRED) {
    if (fm[key] === undefined || fm[key] === "") err(`missing frontmatter '${key}'`);
  }
  const id = fm.id;
  if (id === undefined) continue;

  if (!/^[A-Z]+-\d+$/.test(id)) err(`id '${id}' is not <AREA>-<NNN>`);
  if (seen.has(id)) err(`duplicate id '${id}' (also in ${seen.get(id)})`);
  seen.set(id, rel);

  if (fm.status !== undefined && !(STATUSES as readonly string[]).includes(fm.status)) {
    err(`invalid status '${fm.status}' (expected ${STATUSES.join("|")})`);
  }

  // filename must start with the id
  if (!basename(file).startsWith(`${id}-`)) err(`filename should start with '${id}-'`);

  // area prefix and folder must agree with the id
  const prefix = id.split("-")[0];
  if (fm.area !== undefined && fm.area !== prefix.toLowerCase()) {
    err(`area '${fm.area}' should be '${prefix.toLowerCase()}' (from id ${id})`);
  }
  const folder = basename(dirname(file));
  if (fm.group !== undefined && fm.group !== folder) {
    err(`group '${fm.group}' should match its folder '${folder}'`);
  }

  // acceptance criteria: at least one, all prefixed by the id, sequential, each with gherkin
  const acHeadings = [...text.matchAll(/^###\s+([A-Z]+-\d+-AC\d+)\b/gm)].map((m) => m[1]);
  if (acHeadings.length === 0) err("no acceptance criteria (### <id>-AC1 ...)");
  acHeadings.forEach((ac, i) => {
    if (!ac.startsWith(`${id}-AC`)) err(`criterion '${ac}' does not belong to ${id}`);
    if (ac !== `${id}-AC${i + 1}`) err(`criterion '${ac}' is out of sequence (expected AC${i + 1})`);
  });

  // gherkin fences must balance, and there should be one block per criterion
  const fences = (text.match(/```/g) ?? []).length;
  if (fences % 2 !== 0) err("unbalanced code fences (```)");
  const gherkin = (text.match(/```gherkin/g) ?? []).length;
  if (gherkin < acHeadings.length) {
    err(`only ${gherkin} gherkin block(s) for ${acHeadings.length} criteria`);
  }

  // done specs should cite at least one code path (warning, not an error)
  if (fm.status === "done" && /code:\s*\[\]/.test(text)) {
    warnings.push(`${rel}: status is done but traceability.code is empty`);
  }
}

console.log(`Checked ${seen.size} specs in ${SPECS_DIR.slice(ROOT.length + 1)}.`);
if (warnings.length > 0) {
  console.log(`\nWarnings (${warnings.length}):`);
  for (const w of warnings) console.log(`  ~ ${w}`);
}
if (errors.length > 0) {
  console.error(`\nErrors (${errors.length}):`);
  for (const e of errors) console.error(`  x ${e}`);
  process.exit(1);
}
console.log("\nAll specs valid.");
