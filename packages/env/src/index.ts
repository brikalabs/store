import { z } from "zod";

/**
 * Build a typed, validated, cached accessor for a Worker's string env. Pass the field schemas and a
 * `read` getter (usually `() => env`, so the binding is touched lazily in request scope, not at module
 * load); the result parses + caches on first call, throwing one {@link EnvError} on failure. Imports
 * nothing from "cloudflare:workers", so it stays unit-testable: the caller injects the source via `read`.
 *
 * @example
 * import { env } from "cloudflare:workers";
 * export const vars = defineEnv(
 *   { STORE_URL: z.url().default("https://store.brika.dev") },
 *   () => env,
 * );
 * // ...later, anywhere: vars().STORE_URL
 */
export function defineEnv<T extends z.ZodRawShape>(shape: T, read: () => unknown) {
  const schema = z.object(shape);
  type Output = z.infer<typeof schema>;
  let cached: Output | undefined;
  return (): Output => {
    if (cached !== undefined) return cached;
    const result = schema.safeParse(read());
    if (!result.success) throw new EnvError(result.error.issues);
    cached = result.data;
    return cached;
  };
}

/** A single validation problem; structural so no Zod issue type is pinned. */
interface EnvIssue {
  readonly path: readonly PropertyKey[];
  readonly message: string;
}

/** Thrown when env validation fails; the message enumerates every problem. */
export class EnvError extends Error {
  constructor(issues: readonly EnvIssue[]) {
    const lines = issues.map(
      (issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`,
    );
    super(
      [
        "Invalid environment configuration:",
        ...lines,
        "",
        "Set these in .dev.vars (local dev) or with `wrangler secret put` (deployed).",
      ].join("\n"),
    );
    this.name = "EnvError";
  }
}
