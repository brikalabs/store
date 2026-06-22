/**
 * Option descriptor (Node's parseArgs format plus a help description). `type: 'number'` is parsed as a
 * string by parseArgs and auto-coerced by the CLI; a `default` makes the value non-optional.
 */
export interface CommandOption {
  type: "string" | "boolean" | "number";
  short?: string;
  description?: string;
  default?: string | boolean | number;
}

/** Positional argument descriptor: matched to declared args by order; a `default` makes it non-optional. */
export interface CommandArg {
  description?: string;
  default?: string;
}

/** Command context passed to handlers. */
export interface CommandContext<O extends Record<string, CommandOption> | undefined = undefined>
  extends HandlerArgs<O> {}

/** Middleware that wraps a command handler. */
export type Middleware<O extends Record<string, CommandOption> | undefined = undefined> = (
  handler: (args: HandlerArgs<O>) => Promise<void> | void,
) => (args: HandlerArgs<O>) => Promise<void> | void;

/** Resolve the base JS type for an option's `type` field. */
type BaseValue<T extends CommandOption> = T["type"] extends "boolean"
  ? boolean
  : T["type"] extends "number"
    ? number
    : string;

/** If a default is declared, the value is guaranteed (non-optional). */
type InferValue<T extends CommandOption> = T extends {
  default: string | boolean | number;
}
  ? BaseValue<T>
  : BaseValue<T> | undefined;

/** Convert a kebab-case option key to camelCase, so the handler reads `values.noBoot` not `values['no-boot']`. */
type CamelCase<S extends string> = S extends `${infer Head}-${infer Rest}`
  ? `${Head}${Capitalize<CamelCase<Rest>>}`
  : S;

/** Map an options record to its parsed values type (keys camelCased). */
type InferValues<O extends Record<string, CommandOption> | undefined> =
  O extends Record<string, CommandOption>
    ? { [K in keyof O as CamelCase<K & string>]: InferValue<O[K]> }
    : Record<string, string | boolean | number | undefined>;

/** If a default is declared, the positional is guaranteed (non-optional). */
type InferArg<T extends CommandArg> = T extends { default: string } ? string : string | undefined;

/** Map a positional-args record to its parsed values type, keyed by name. */
type InferArgs<A extends Record<string, CommandArg> | undefined> =
  A extends Record<string, CommandArg>
    ? { [K in keyof A]: InferArg<A[K]> }
    : Record<string, string | undefined>;

export interface HandlerArgs<
  O extends Record<string, CommandOption> | undefined = undefined,
  A extends Record<string, CommandArg> | undefined = undefined,
> {
  /** Parsed flag values, keyed by the camelCased option name. */
  values: InferValues<O>;
  /** Parsed positional arguments, keyed by their declared name. */
  args: InferArgs<A>;
  /** Raw positional arguments, in order. */
  positionals: string[];
  commands: Command[];
}

/** A declarative command definition; all metadata is inferred from this single object. */
export interface Command<Name extends string = string> {
  name: Name;
  description: string;
  details?: string;
  options?: Record<string, CommandOption>;
  args?: Record<string, CommandArg>;
  aliases?: string[];
  examples?: string[];
  subcommands?: Command[];
  /** Omit from the global help listing; the command is still resolvable by name and runs normally. */
  hidden?: boolean;
  handler: (args: HandlerArgs) => Promise<void> | void;
}

/**
 * Define a command with fully typed option AND positional-argument values in the handler. `const` type
 * parameters preserve the descriptors' literal types, so `values`/`args` narrow by `type` and `default`.
 */
export function defineCommand<
  const Name extends string,
  const O extends Record<string, CommandOption>,
  const A extends Record<string, CommandArg>,
>(def: {
  name: Name;
  description: string;
  details?: string;
  options?: O;
  args?: A;
  aliases?: string[];
  examples?: string[];
  hidden?: boolean;
  handler: (args: HandlerArgs<O, A>) => Promise<void> | void;
}): Command<Name> {
  return def as unknown as Command<Name>;
}
