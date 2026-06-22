/**
 * Grant-family model for the plugin Permissions section. Grants are keyed by reverse-DNS id
 * (`dev.brika.net.fetch`); the store groups them by permission family (net, secrets, fs, ...) to
 * mirror how the hub renders consent, deriving the family from the grant id.
 */

export type GrantRisk = "sensitive" | "standard";

/** A single requested host, with the wildcard flag the hub renders specially. */
export interface GrantHost {
  readonly value: string;
  readonly wildcard: boolean;
}

/** The visualised scope for a family (host allow-list, paths, secret ops, ports, ...). */
export type GrantScope =
  | { readonly kind: "hosts"; readonly hosts: readonly GrantHost[] }
  | { readonly kind: "ports"; readonly ports: readonly string[] }
  | { readonly kind: "paths"; readonly read: readonly string[]; readonly write: readonly string[] }
  | { readonly kind: "ops"; readonly ops: readonly string[] }
  | { readonly kind: "raw"; readonly items: readonly string[] }
  | { readonly kind: "none" };

/** One permission family, aggregating every grant the plugin requests in it. */
export interface GrantFamily {
  readonly id: string;
  readonly label: string;
  readonly risk: GrantRisk;
  /** Distinct verbs across the family's grants, e.g. ["get", "set", "delete"]. */
  readonly verbs: readonly string[];
  /** The full reverse-DNS grant ids, shown as the technical detail. */
  readonly grantIds: readonly string[];
  readonly scope: GrantScope;
}

interface FamilySpec {
  readonly label: string;
  readonly risk: GrantRisk;
  readonly order: number;
}

// Known families. Secrets is the only "sensitive" family (it can read the keys
// other plugins store); everything else is standard. Unknown families fall back
// to a title-cased label at the end of the list.
const FAMILY_SPECS: Record<string, FamilySpec> = {
  net: { label: "Network", risk: "standard", order: 1 },
  netLocal: { label: "Local network", risk: "standard", order: 2 },
  rawSocket: { label: "Raw sockets", risk: "standard", order: 3 },
  fs: { label: "Filesystem", risk: "standard", order: 4 },
  secrets: { label: "Secrets", risk: "sensitive", order: 5 },
  storage: { label: "Storage", risk: "standard", order: 6 },
};

const PREFIX = "dev.brika.";

/** Split a grant id into its family and verb: `dev.brika.net.fetch` -> net/fetch. */
export function parseGrantId(id: string): { family: string; verb: string } {
  const body = id.startsWith(PREFIX) ? id.slice(PREFIX.length) : id;
  const dot = body.indexOf(".");
  if (dot === -1) return { family: body, verb: "" };
  return { family: body.slice(0, dot), verb: body.slice(dot + 1) };
}

function titleCase(id: string): string {
  const spaced = id.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[-_]/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function specFor(family: string): FamilySpec {
  return FAMILY_SPECS[family] ?? { label: titleCase(family), risk: "standard", order: 99 };
}

/** Pull a string array out of a scope object under any of the given keys. */
function stringList(value: unknown, keys: readonly string[]): string[] {
  if (value === null || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  const out: string[] = [];
  for (const key of keys) {
    const entry = record[key];
    if (Array.isArray(entry)) {
      for (const item of entry) {
        if (typeof item === "string" || typeof item === "number") out.push(String(item));
      }
    }
  }
  return out;
}

function uniq(values: readonly string[]): string[] {
  return [...new Set(values)];
}

// Secret grant verbs map to the read/write/delete operations the hub exposes.
const SECRET_OP_BY_VERB: Record<string, string> = {
  get: "read",
  read: "read",
  set: "write",
  write: "write",
  delete: "delete",
};
const SECRET_OP_ORDER = ["read", "write", "delete"];

type Entry = { verb: string; value: unknown };

function hostScope(entries: readonly Entry[]): GrantScope {
  const hosts = uniq(entries.flatMap((e) => stringList(e.value, ["allow", "hosts"]))).map(
    (value) => ({ value, wildcard: value.includes("*") }),
  );
  return hosts.length > 0 ? { kind: "hosts", hosts } : { kind: "none" };
}

function portScope(entries: readonly Entry[]): GrantScope {
  const ports = uniq(entries.flatMap((e) => stringList(e.value, ["ports", "allow", "hosts"])));
  return ports.length > 0 ? { kind: "ports", ports } : { kind: "none" };
}

function pathScope(entries: readonly Entry[]): GrantScope {
  const read: string[] = [];
  const write: string[] = [];
  for (const entry of entries) {
    const paths = stringList(entry.value, ["paths", "allow", "read", "write"]);
    if (entry.verb === "write" || entry.verb === "append") write.push(...paths);
    else read.push(...paths);
  }
  return read.length + write.length > 0
    ? { kind: "paths", read: uniq(read), write: uniq(write) }
    : { kind: "none" };
}

function opScope(entries: readonly Entry[]): GrantScope {
  const ops = uniq(entries.map((e) => SECRET_OP_BY_VERB[e.verb] ?? e.verb)).sort(
    (a, b) => SECRET_OP_ORDER.indexOf(a) - SECRET_OP_ORDER.indexOf(b),
  );
  return ops.length > 0 ? { kind: "ops", ops } : { kind: "none" };
}

function rawScope(entries: readonly Entry[]): GrantScope {
  const items = uniq(entries.flatMap((e) => stringList(e.value, ["allow", "keys", "namespaces"])));
  return items.length > 0 ? { kind: "raw", items } : { kind: "none" };
}

const SCOPE_BUILDERS: Record<string, (entries: readonly Entry[]) => GrantScope> = {
  net: hostScope,
  rawSocket: hostScope,
  netLocal: portScope,
  fs: pathScope,
  secrets: opScope,
};

function buildScope(family: string, entries: readonly Entry[]): GrantScope {
  return (SCOPE_BUILDERS[family] ?? rawScope)(entries);
}

/** Group a plugin's raw grants (id -> scope) into permission families, known families first. */
export function groupGrants(grants: Record<string, unknown>): GrantFamily[] {
  const byFamily = new Map<string, { verb: string; value: unknown; id: string }[]>();
  for (const [id, value] of Object.entries(grants)) {
    const { family, verb } = parseGrantId(id);
    const list = byFamily.get(family) ?? [];
    list.push({ verb, value, id });
    byFamily.set(family, list);
  }

  const families: GrantFamily[] = [];
  for (const [family, entries] of byFamily) {
    const spec = specFor(family);
    families.push({
      id: family,
      label: spec.label,
      risk: spec.risk,
      verbs: uniq(entries.map((e) => e.verb).filter((v) => v.length > 0)),
      grantIds: entries.map((e) => e.id).sort((a, b) => a.localeCompare(b)),
      scope: buildScope(family, entries),
    });
  }

  return families.sort(
    (a, b) => specFor(a.id).order - specFor(b.id).order || a.id.localeCompare(b.id),
  );
}
