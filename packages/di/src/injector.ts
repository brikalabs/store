import { AsyncLocalStorage } from "node:async_hooks";
import { callerFrame, moduleFile } from "@brika/stack";

/**
 * Angular-style functional DI, no decorators or reflection. The injection context is an
 * `AsyncLocalStorage`, so `inject()` survives `await`s - a request handler can inject before and
 * after awaiting.
 */

/** Optional config for an {@link InjectionToken}. */
export interface InjectionTokenOptions<T> {
  /** A `providedIn: 'root'` default provider, used when nothing else provides the token. */
  readonly factory?: () => T;
  /** An explicit label for error messages; omit it and the token is named by its creation site. */
  readonly description?: string;
}

const DI_FILE = moduleFile(new Error("di location probe").stack);

/**
 * The first stack frame outside this module: where the token was declared. Names a token by its
 * declaration site so a missing-provider error reads `InjectionToken(server/services.ts:41:14)`
 * rather than an unstable `token#N`.
 */
function creationSite(): string | undefined {
  const loc = callerFrame(new Error("di token site").stack, DI_FILE);
  if (loc === undefined) return undefined;
  const parts = loc.split("/");
  return parts.length > 2 ? parts.slice(-2).join("/") : loc;
}

let tokenCounter = 0;

/**
 * A runtime identity for a dependency that has none on its own (an interface, a config value).
 * Prefer the {@link token} helper over `new InjectionToken`; this class is the underlying primitive.
 */
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

/** Bind a token to a ready value: `{ provide: BaseUrl, useValue: "https://..." }`. */
export interface ValueProvider<T> {
  readonly provide: ProviderToken<T>;
  readonly useValue: T;
}
/** Bind a token to a lazy factory (which may `inject()` inside it). */
export interface FactoryProvider<T> {
  readonly provide: ProviderToken<T>;
  readonly useFactory: () => T;
}
export interface ClassProvider<T> {
  readonly provide: ProviderToken<T>;
  /** A field-injected class to build for this token: `{ provide: Port, useClass: D1Adapter }`. */
  readonly useClass: new () => T;
}
/**
 * Anything bindable to a token. A bare class provides itself; `useValue` a ready instance;
 * `useFactory` a lazy build (which may `inject()`, so a factory also aliases one token to another);
 * `useClass` a port token to a field-injected adapter.
 */
export type Provider<T = unknown> =
  | (new () => T)
  | ValueProvider<T>
  | FactoryProvider<T>
  | ClassProvider<T>;

/** Value-provider shorthand: `provide(Token, value)` ≡ `{ provide: Token, useValue: value }`. */
export function provide<T>(token: ProviderToken<T>, value: T): ValueProvider<T> {
  return { provide: token, useValue: value };
}

// The injection context, created lazily on first use. Importing `@brika/di` (e.g. a client component
// that imports a token or pure helper from a domain package that field-injects) must NOT touch
// `node:async_hooks`, which the browser externalizes; only `inject()` / `runInContext` - server-only -
// materialize the AsyncLocalStorage.
let activeStore: AsyncLocalStorage<Injector> | undefined;
function active(): AsyncLocalStorage<Injector> {
  activeStore ??= new AsyncLocalStorage<Injector>();
  return activeStore;
}

/**
 * The ergonomic way to declare a token. Declare an interface and a same-named token so the one
 * identifier is both type and runtime value (TypeScript merges them); pass a `factory` for a
 * `providedIn: 'root'` default.
 *
 *   export interface Clock { now(): number; }
 *   export const Clock = token<Clock>("Clock");   // inject(Clock) is typed Clock
 *   export const Audit = token("Audit", () => new D1AuditLog(inject(Db)));
 */
export function token<T>(description?: string, factory?: () => T): InjectionToken<T> {
  return new InjectionToken<T>({ description, factory });
}

/** True when called inside an injection context (a provider build, or {@link runInInjectionContext}). */
export function isInInjectionContext(): boolean {
  return active().getStore() !== undefined;
}

/** Options for {@link inject} / {@link Injector.get}. */
export interface InjectOptions {
  /** Return `undefined` instead of throwing when nothing provides the token. */
  readonly optional?: boolean;
}

/**
 * Resolve a dependency from the active injector. Throws when there is no active context (so a
 * forgotten `runInInjectionContext` fails loudly), or when nothing provides the token - unless
 * `{ optional: true }`, which yields `undefined`.
 */
export function inject<T>(token: ProviderToken<T>): T;
export function inject<T>(token: ProviderToken<T>, options: { optional: true }): T | undefined;
export function inject<T>(token: ProviderToken<T>, options?: InjectOptions): T | undefined {
  const injector = active().getStore();
  if (injector === undefined) {
    if (options?.optional === true) return undefined;
    throw new Error(`inject(${tokenName(token)}) called outside an injection context`);
  }
  return options?.optional === true ? injector.get(token, { optional: true }) : injector.get(token);
}

/**
 * Resolve `token`, or `fallback` when nothing provides it - the one-liner for an optional seam with
 * an in-class default. A provided `null`/`undefined` also takes the fallback (it is a `??`).
 */
export function injectOr<T>(token: ProviderToken<T>, fallback: T): T {
  return inject(token, { optional: true }) ?? fallback;
}

/** Run `fn` with `injector` active, so `inject()` inside it (and its awaits) resolves against it. */
export function runInInjectionContext<R>(injector: Injector, fn: () => R): R {
  return active().run(injector, fn);
}

function tokenName(token: ProviderToken<unknown>): string {
  return token instanceof InjectionToken ? token.toString() : token.name;
}

function providerKey(provider: Provider): ProviderToken<unknown> {
  return typeof provider === "function" ? provider : provider.provide;
}

/**
 * A hierarchical injector. Every token resolves once and is cached (a singleton within this
 * injector); a child delegates unknown tokens to its parent, so app-wide singletons live in a root
 * injector while request-scoped values live in a per-request child.
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

  /** Whether `token` can be resolved at all. Drives `{ optional: true }`. */
  #providable(token: ProviderToken<unknown>): boolean {
    if (this.#canResolve(token)) return true;
    if (token instanceof InjectionToken) return token.factory !== undefined;
    return true; // a concrete class is its own provider
  }

  #resolve(token: ProviderToken<unknown>): unknown {
    if (this.#instances.has(token)) return this.#instances.get(token);
    const provider = this.#providers.get(token);
    if (provider !== undefined) return this.#instantiate(token, () => this.#build(provider));
    // An explicit provider up the chain wins and resolves in ITS scope (so a parent singleton stays
    // one instance). Otherwise the token auto-resolves HERE, so an unregistered store's `inject()`ed
    // deps come from the scope it was asked from (e.g. the request's db), not the root.
    const parent = this.#parent;
    if (parent !== undefined) {
      if (parent.#canResolve(token)) return parent.#resolve(token);
    }
    if (token instanceof InjectionToken) {
      const factory = token.factory;
      if (factory === undefined) throw new Error(`No provider for ${tokenName(token)}`);
      // `providedIn: 'root'`: a default-factory token is an app-wide singleton, so build and cache
      // it at the ROOT injector (not the child it was asked from), giving one shared instance.
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
      const value = active().run(this, build);
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
    return new provider.useClass();
  }
}

/**
 * Construct a concrete class token. `abstract` is erased at runtime, so an abstract class still has
 * a callable constructor and would be `new`ed rather than rejected - use one as a token only when
 * you always provide a concrete `useClass` for it; for a pure interface prefer {@link token}.
 */
function construct(token: ProviderToken<unknown>): unknown {
  if (typeof token !== "function") throw new Error(`Cannot construct ${tokenName(token)}`);
  const Ctor = token as unknown as new () => unknown;
  return new Ctor();
}

/** Create an {@link Injector} from a provider list, optionally as a child of `parent`. */
export function createInjector(providers: readonly Provider[] = [], parent?: Injector): Injector {
  return new Injector(providers, parent);
}

/** Create a fresh injector from `providers` and run `fn` inside it. */
export function runInContext<R>(providers: readonly Provider[], fn: () => R): R {
  return runInInjectionContext(createInjector(providers), fn);
}
