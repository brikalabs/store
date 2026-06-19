/** A named class of module specifier, e.g. "the database/ORM". */
export interface Category {
  readonly label: string;
  readonly test: (specifier: string) => boolean;
}

/** Build a category from raw predicate logic (the escape hatch; prefer {@link modules}). */
export function category(label: string, test: (specifier: string) => boolean): Category {
  return { label, test };
}

/**
 * A category matching a set of module names/prefixes (the ergonomic common case):
 *
 *   modules("drizzle-orm", "@brika/store-db")  // matches those + their submodules
 *   modules("cloudflare:", "@cloudflare/")     // prefix match (ends in : or /)
 *
 * A bare name matches itself and its submodules (`drizzle-orm` -> `drizzle-orm/d1`); a
 * name ending in `:` or `/` is a prefix match.
 */
export function modules(...names: string[]): Category {
  const quoted = names.map((n) => `"${n}"`).join(", ");
  const label = names.length === 1 ? quoted : `one of ${quoted}`;
  return {
    label,
    test: (s) =>
      names.some((name) =>
        name.endsWith(":") || name.endsWith("/")
          ? s.startsWith(name)
          : s === name || s.startsWith(`${name}/`),
      ),
  };
}
