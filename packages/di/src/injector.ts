import { AsyncLocalStorage } from "node:async_hooks";
import { callerFrame, moduleFile } from "@brika/stack";

/**
 * Angular-style functional DI, no decorators or reflection. You `inject(Token)` inside a class
 * the injector builds (a field initializer / constructor) or anywhere within
 * {@link runInInjectionContext}; the active injector resolves the token to a lazily-built,
 * cached singleton. The injection context is an `AsyncLocalStorage`, so it survives `await`s -
 * a request handler can `inject()` before and after awaiting. One injector definition serves
 * both the hono and the tanstack app.
 */

/** Optional config for an {@link InjectionToken}. Everything is optional - `new InjectionToken<T>()` is valid. */
export interface InjectionTokenOptions<T> {
  /** A default provider (Angular's `providedIn: 'root'` factory), used when nothing else provides it. */
  readonly factory?: () => T;
  /** An explicit label for error messages. Omit it and the token is named by where it was created. */
  readonly description?: string;
}

/** This module's own file (from a load-time stack), so token naming can skip its own frames. */
const DI_FILE = moduleFile(new Error("di location probe").stack);

/**
 * The first stack frame OUTSIDE this module: where `new InjectionToken()` / `token<T>()` was called.
 * Names a token by its declaration site, so a missing-provider error reads
 * `InjectionToken(server/services.ts:41:14)` instead of an unstable `token#N` - with no caller label.
 * Shortened to the last two path segments so the label stays compact.
 */
function creationSite(): string | undefined {
  const loc = callerFrame(new Error("di token site").stack, DI_FILE);
  if (loc === undefined) return undefined;
  const parts = loc.split("/");
  return parts.length > 2 ? parts.slice(-2).join("/") : loc;
}

let tokenCounter = 0;

export class InjectionToken<T> {
  /** Phantom: keeps `T` attached to the token for inference. Never read at runtime. */
  declare readonly _type: T;
  readonly description: string;
  readonly factory: (() => T) | undefined;
  constructor(options: InjectionTokenOptions<T> = {}) {
    tokenCounter += 1;
    this.description = options.description ?? creationSite() ?? `token#${tokenCounter}`;
    this.factory = options.factory;
  }
  toString(): string {
    return `InjectionToken(${this.description})`;
  }
}

/** A class usable as its own token, e.g. `inject(ReviewStore)`. Abstract classes are allowed as tokens. */
export type Type<T> = (abstract new (...args: never[]) => T) & { readonly name: string };
/** Anything you can `inject()`: a class or an {@link InjectionToken}. */
export type ProviderToken<T> = Type<T> | InjectionToken<T>;

export interface ValueProvider<T> {
  readonly provide: ProviderToken<T>;
  readonly useValue: T;
}
export interface FactoryProvider<T> {
  readonly provide: ProviderToken<T>;
  readonly useFactory: () => T;
}
export interface ClassProvider<T> {
  readonly provide: ProviderToken<T>;
  readonly useClass: new () => T;
}
export interface ExistingProvider<T> {
  readonly provide: ProviderToken<T>;
  /** Alias: `provide` resolves to whatever `useExisting` resolves to. */
  readonly useExisting: ProviderToken<T>;
}
/** A bare class is shorthand for `{ provide: Class, useClass: Class }`. */
export type Provider<T = unknown> =
  | (new () => T)
  | ValueProvider<T>
  | FactoryProvider<T>
  | ClassProvider<T>
  | ExistingProvider<T>;

/**
 * Value-provider shorthand: `provide(Token, value)` ≡ `{ provide: Token, useValue: value }`, with
 * `value` type-checked against the token's `T`. Cuts the `{ provide, useValue }` noise from provider
 * lists - composition roots, and especially tests, where most overrides are just a fake value.
 */
export function provide<T>(token: ProviderToken<T>, value: T): ValueProvider<T> {
  return { provide: token, useValue: value };
}

const ACTIVE = new AsyncLocalStorage<Injector>();

/**
 * Sugar for an interface token. Declare the interface and a same-named token so the one
 * identifier is both the type and the runtime value (TypeScript merges a type and a value):
 *
 *   export interface Clock { now(): number; }
 *   export const Clock = token<Clock>();   // inject(Clock) is typed Clock
 *
 * An interface has no runtime identity to inject by; this is the minimal token that gives it one
 * without an abstract class.
 */
export function token<T>(): InjectionToken<T> {
  return new InjectionToken<T>();
}

/** True when called inside an injection context (a provider build, or {@link runInInjectionContext}). */
export function isInInjectionContext(): boolean {
  return ACTIVE.getStore() !== undefined;
}

/** Options for {@link inject} / {@link Injector.get}. */
export interface InjectOptions {
  /** Return `undefined` instead of throwing when nothing provides the token. */
  readonly optional?: boolean;
}

/**
 * Resolve a dependency from the active injector. Call it in a field initializer / constructor of
 * an injector-built class, or anywhere within {@link runInInjectionContext}. Throws when there is
 * no active context (so a forgotten `runInInjectionContext` fails loudly, not silently), or when
 * nothing provides the token - unless `{ optional: true }`, which yields `undefined` instead.
 */
export function inject<T>(token: ProviderToken<T>): T;
export function inject<T>(token: ProviderToken<T>, options: { optional: true }): T | undefined;
export function inject<T>(token: ProviderToken<T>, options?: InjectOptions): T | undefined {
  const injector = ACTIVE.getStore();
  if (injector === undefined) {
    if (options?.optional === true) return undefined;
    throw new Error(`inject(${tokenName(token)}) called outside an injection context`);
  }
  return options?.optional === true ? injector.get(token, { optional: true }) : injector.get(token);
}

/** Run `fn` with `injector` active, so `inject()` inside it (and its awaits) resolves against it. */
export function runInInjectionContext<R>(injector: Injector, fn: () => R): R {
  return ACTIVE.run(injector, fn);
}

function tokenName(token: ProviderToken<unknown>): string {
  return token instanceof InjectionToken ? token.toString() : token.name;
}

function providerKey(provider: Provider): ProviderToken<unknown> {
  return typeof provider === "function" ? provider : provider.provide;
}

/**
 * A hierarchical injector. Every token resolves once and is cached - a singleton within this
 * injector. A child delegates unknown tokens to its parent, so app-wide singletons live in a
 * root injector while request-scoped values (the db, the session) live in a per-request child.
 * An unregistered concrete class auto-resolves where the lookup bottoms out (its `inject()`ed
 * deps still come from the active scope), like Angular's `providedIn: 'root'`.
 */
export class Injector {
  readonly #providers = new Map<ProviderToken<unknown>, Provider>();
  readonly #instances = new Map<ProviderToken<unknown>, unknown>();
  readonly #resolving = new Set<ProviderToken<unknown>>();
  readonly #parent: Injector | undefined;

  constructor(providers: readonly Provider[] = [], parent?: Injector) {
    this.#parent = parent;
    for (const provider of providers) this.#providers.set(providerKey(provider), provider);
    this.#instances.set(Injector, this); // `inject(Injector)` yields the injector itself
  }

  get<T>(token: ProviderToken<T>): T;
  get<T>(token: ProviderToken<T>, options: { optional: true }): T | undefined;
  get<T>(token: ProviderToken<T>, options?: InjectOptions): T | undefined {
    if (options?.optional === true && !this.#providable(token)) return undefined;
    // The single typed boundary of a heterogeneous container: the maps are keyed by erased
    // tokens, so the value is recovered as `T` here (the provider's type guarantees it).
    return this.#resolve(token) as T;
  }

  /** Whether `token` can be resolved at all (a provider/instance anywhere, an InjectionToken
   *  default factory, or a constructable class). Drives `{ optional: true }`. */
  #providable(token: ProviderToken<unknown>): boolean {
    if (this.#canResolve(token)) return true;
    if (token instanceof InjectionToken) return token.factory !== undefined;
    return true; // a concrete class is its own provider
  }

  #resolve(token: ProviderToken<unknown>): unknown {
    if (this.#instances.has(token)) return this.#instances.get(token);
    const provider = this.#providers.get(token);
    if (provider !== undefined) return this.#instantiate(token, () => this.#build(provider));
    // An explicit provider/instance up the chain wins, and resolves in ITS scope (so a parent's
    // singleton stays one instance). Otherwise the token is auto-resolved HERE - the originating
    // injector - so an unregistered store/service is created in the scope it was asked from and
    // its `inject()`ed deps come from that scope (e.g. the request's db), not the root.
    const parent = this.#parent;
    if (parent !== undefined) {
      if (parent.#canResolve(token)) return parent.#resolve(token);
    }
    if (token instanceof InjectionToken) {
      const factory = token.factory;
      if (factory === undefined) throw new Error(`No provider for ${tokenName(token)}`);
      // `providedIn: 'root'`: a default-factory token is an app-wide singleton, so build (and
      // cache) it at the ROOT injector - not the child it was first asked from - and its own
      // `inject()`ed deps resolve from the root too. One instance, shared by every scope.
      const root = this.#root();
      if (root !== this) return root.#resolve(token);
      return this.#instantiate(token, factory);
    }
    return this.#instantiate(token, () => construct(token));
  }

  /** Whether this injector or an ancestor explicitly provides (or has already built) `token`. */
  #canResolve(token: ProviderToken<unknown>): boolean {
    if (this.#instances.has(token) || this.#providers.has(token)) return true;
    if (this.#parent === undefined) return false;
    return this.#parent.#canResolve(token);
  }

  /** The topmost ancestor (the root injector), where `providedIn: 'root'` factory tokens live. */
  #root(): Injector {
    return this.#parent === undefined ? this : this.#parent.#root();
  }

  #instantiate(token: ProviderToken<unknown>, build: () => unknown): unknown {
    if (this.#resolving.has(token)) {
      throw new Error(`Circular dependency resolving ${tokenName(token)}`);
    }
    this.#resolving.add(token);
    try {
      const value = ACTIVE.run(this, build);
      this.#instances.set(token, value);
      return value;
    } finally {
      this.#resolving.delete(token);
    }
  }

  #build(provider: Provider): unknown {
    if (typeof provider === "function") return construct(provider);
    if ("useValue" in provider) return provider.useValue;
    if ("useFactory" in provider) return provider.useFactory();
    if ("useClass" in provider) return new provider.useClass();
    return this.#resolve(provider.useExisting);
  }
}

/**
 * Construct a concrete class token. A non-function token (an {@link InjectionToken}) has no
 * constructor and throws here. Note `abstract` is erased at runtime, so an abstract class still
 * has a callable constructor and would be `new`ed rather than rejected - so use an abstract class
 * as a token only when you always provide a concrete `useClass`/`useExisting` for it; for a pure
 * interface, prefer {@link token}, whose missing provider throws a clear "No provider" instead.
 */
function construct(token: ProviderToken<unknown>): unknown {
  if (typeof token !== "function") throw new Error(`Cannot construct ${tokenName(token)}`);
  // A `Type` is `abstract new`; only a concrete class reaches here, so recover the concrete signature.
  const Ctor = token as unknown as new () => unknown;
  return new Ctor();
}

/** Create an {@link Injector} from a provider list, optionally as a child of `parent`. */
export function createInjector(providers: readonly Provider[] = [], parent?: Injector): Injector {
  return new Injector(providers, parent);
}

/**
 * Create a fresh injector from `providers` and run `fn` inside it - the one-liner a framework
 * adapter (a request handler, a server function) uses so application code never touches
 * `createInjector`/`runInInjectionContext` itself: it just `inject()`s. `providers` is normally
 * the single runtime seam (e.g. the request bindings); everything else self-builds.
 */
export function runInContext<R>(providers: readonly Provider[], fn: () => R): R {
  return runInInjectionContext(createInjector(providers), fn);
}
