import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Angular-style functional DI, no decorators or reflection. You `inject(Token)` inside a class
 * the injector builds (a field initializer / constructor) or anywhere within
 * {@link runInInjectionContext}; the active injector resolves the token to a lazily-built,
 * cached singleton. The injection context is an `AsyncLocalStorage`, so it survives `await`s -
 * a request handler can `inject()` before and after awaiting. One injector definition serves
 * both the hono and the tanstack app.
 */

/** A DI key for something with no class to name it: an interface, a binding, a config value. */
/** Optional config for an {@link InjectionToken}. Everything is optional - `new InjectionToken<T>()` is valid. */
export interface InjectionTokenOptions<T> {
  /** A default provider (Angular's `providedIn: 'root'` factory), used when nothing else provides it. */
  readonly factory?: () => T;
  /** A label for error messages. Optional - omit it and the token gets a generated id. */
  readonly description?: string;
}

let tokenCounter = 0;

export class InjectionToken<T> {
  /** Phantom: keeps `T` attached to the token for inference. Never read at runtime. */
  declare readonly _type: T;
  readonly description: string;
  readonly factory: (() => T) | undefined;
  constructor(options: InjectionTokenOptions<T> = {}) {
    tokenCounter += 1;
    this.description = options.description ?? `token#${tokenCounter}`;
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
/**
 * A `multi` provider contributes ONE element to a collection token: register several and
 * `inject(token)` returns the array of all of them (across the injector hierarchy). The token's
 * type is the array (`InjectionToken<readonly E[]>`); each provider supplies an element `E`.
 * Use for plugin/hook/middleware lists discovered through DI.
 */
export interface MultiProvider<E = unknown> {
  readonly provide: InjectionToken<readonly E[]>;
  readonly multi: true;
  readonly useValue?: E;
  readonly useFactory?: () => E;
  readonly useClass?: new () => E;
  readonly useExisting?: ProviderToken<E>;
}

/** A single-value provider (a bare class is shorthand for `{ provide: Class, useClass: Class }`). */
export type SingleProvider<T = unknown> =
  | (new () => T)
  | ValueProvider<T>
  | FactoryProvider<T>
  | ClassProvider<T>
  | ExistingProvider<T>;

/** Anything `createInjector` accepts: a single-value provider or a `multi` contribution. */
export type Provider<T = unknown> = SingleProvider<T> | MultiProvider;

/**
 * Registers cleanup to run when the surrounding injector is destroyed (e.g. the request ends).
 * `inject(DestroyRef).onDestroy(() => ...)`. Provided by every injector for the scope it runs in.
 */
export abstract class DestroyRef {
  abstract onDestroy(callback: () => void | Promise<void>): void;
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
export function token<T>(description?: string): InjectionToken<T> {
  return new InjectionToken<T>(description === undefined ? {} : { description });
}

/**
 * App-wide default bindings (Angular's `providedIn: 'root'`), populated by {@link provides}.
 * Consulted only when no injector in the chain provides the token, so an explicit provider (e.g.
 * a test override) always wins.
 */
const ROOT_PROVIDERS = new Map<ProviderToken<unknown>, SingleProvider>();

/**
 * Class decorator: register the class as the app-wide implementation of each `tokens` entry, so
 * `inject(Token)` resolves to this one (shared) instance with no injector provider. Because a
 * class can `implements` many interfaces, one class can back several interface tokens:
 *
 *   @provides(Clock, Logger)
 *   class SystemServices implements Clock, Logger { ... }
 *
 * `inject(Clock)` and `inject(Logger)` then both resolve to the same `SystemServices`. A test can
 * still override any token with an injector provider; the default only fills the gap.
 */
export function provides(...tokens: readonly ProviderToken<unknown>[]) {
  return (value: Type<unknown>, _context: ClassDecoratorContext): void => {
    for (const token of tokens) ROOT_PROVIDERS.set(token, { provide: token, useExisting: value });
  };
}

/** Classes that are app-wide singletons (one instance across all requests), populated by {@link Injectable}. */
const ROOT_SCOPED = new Set<ProviderToken<unknown>>();
/** App-wide singletons to build as soon as the root injector exists, not on first inject. */
const EAGER: ProviderToken<unknown>[] = [];
let rootInjector: Injector | undefined;

/**
 * The app-wide root injector, holding the `@Injectable({ providedIn: 'root' })` singletons. Built
 * lazily (its eager members instantiated then); {@link runInContext} parents every request scope
 * to it, so a root singleton is one shared instance while request-scoped graphs come and go.
 */
function root(): Injector {
  if (rootInjector === undefined) {
    rootInjector = new Injector();
    for (const eager of EAGER) rootInjector.get(eager);
  }
  return rootInjector;
}

/**
 * Class decorator: make a class an app-wide singleton - resolved once in the root injector and
 * shared across every request, instead of the default per-injector (per-request) instance. With
 * `{ eager: true }` it is built when the root injector is first created. A root singleton must
 * only depend on other root/stateless things (it outlives any one request), like Angular's
 * `providedIn: 'root'`.
 */
export function Injectable(options: { readonly providedIn: "root"; readonly eager?: boolean }) {
  return (value: Type<unknown>, _context: ClassDecoratorContext): void => {
    ROOT_SCOPED.add(value);
    if (options.eager === true) EAGER.push(value);
  };
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

function isMulti(provider: Provider): provider is MultiProvider {
  return typeof provider === "object" && "multi" in provider && provider.multi === true;
}

/**
 * A hierarchical injector. Every token resolves once and is cached - a singleton within this
 * injector. A child delegates unknown tokens to its parent, so app-wide singletons live in a
 * root injector while request-scoped values (the db, the session) live in a per-request child.
 * An unregistered concrete class auto-resolves where the lookup bottoms out (its `inject()`ed
 * deps still come from the active scope), like Angular's `providedIn: 'root'`.
 */
export class Injector {
  readonly #providers = new Map<ProviderToken<unknown>, SingleProvider>();
  readonly #multi = new Map<ProviderToken<unknown>, MultiProvider[]>();
  readonly #instances = new Map<ProviderToken<unknown>, unknown>();
  readonly #resolving = new Set<ProviderToken<unknown>>();
  readonly #onDestroy: Array<() => void | Promise<void>> = [];
  readonly #parent: Injector | undefined;
  #destroyed = false;

  constructor(providers: readonly Provider[] = [], parent?: Injector) {
    this.#parent = parent;
    for (const provider of providers) {
      if (isMulti(provider)) this.#addMulti(provider);
      else this.#providers.set(providerKey(provider), provider);
    }
    this.#instances.set(Injector, this); // `inject(Injector)` yields the injector itself
    // `inject(DestroyRef)` registers cleanup on THIS injector (the surrounding scope).
    const ref: DestroyRef = { onDestroy: (cb) => this.onDestroy(cb) };
    this.#instances.set(DestroyRef, ref);
  }

  #addMulti(provider: MultiProvider): void {
    const list = this.#multi.get(provider.provide) ?? [];
    list.push(provider);
    this.#multi.set(provider.provide, list);
  }

  /** Register a callback to run when this injector is {@link destroy}ed (the scope ends). */
  onDestroy(callback: () => void | Promise<void>): void {
    if (this.#destroyed) throw new Error("Injector is already destroyed");
    this.#onDestroy.push(callback);
  }

  /** Run every `onDestroy` callback (most-recent first) and release instances. Idempotent. */
  async destroy(): Promise<void> {
    if (this.#destroyed) return;
    this.#destroyed = true;
    for (const callback of this.#onDestroy.toReversed()) await callback();
    this.#onDestroy.length = 0;
    this.#instances.clear();
  }

  get<T>(token: ProviderToken<T>): T;
  get<T>(token: ProviderToken<T>, options: { optional: true }): T | undefined;
  get<T>(token: ProviderToken<T>, options?: InjectOptions): T | undefined {
    if (options?.optional === true && !this.#providable(token)) return undefined;
    // The single typed boundary of a heterogeneous container: the maps are keyed by erased
    // tokens, so the value is recovered as `T` here (the provider's type guarantees it).
    return this.#resolve(token) as T;
  }

  /** Whether `token` can be resolved at all (a provider/instance anywhere, a root default, an
   *  InjectionToken default factory, or a constructable class). Drives `{ optional: true }`. */
  #providable(token: ProviderToken<unknown>): boolean {
    if (this.#canResolve(token) || ROOT_PROVIDERS.has(token)) return true;
    if (token instanceof InjectionToken) return token.factory !== undefined;
    return true; // a concrete class is its own provider
  }

  #resolve(token: ProviderToken<unknown>): unknown {
    if (this.#instances.has(token)) return this.#instances.get(token);
    const multi = this.#multi.get(token);
    if (multi !== undefined) {
      const values = multi.map((p) => ACTIVE.run(this, () => this.#buildMultiElement(p)));
      this.#instances.set(token, values);
      return values;
    }
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
    const rootDefault = ROOT_PROVIDERS.get(token);
    if (rootDefault !== undefined) return this.#instantiate(token, () => this.#build(rootDefault));
    if (token instanceof InjectionToken) {
      const factory = token.factory;
      if (factory === undefined) throw new Error(`No provider for ${tokenName(token)}`);
      return this.#instantiate(token, factory);
    }
    // An @Injectable({ providedIn: 'root' }) class is built once at the root, shared by every scope.
    if (parent !== undefined && ROOT_SCOPED.has(token)) return parent.#resolve(token);
    return this.#instantiate(token, () => construct(token));
  }

  /** Whether this injector or an ancestor explicitly provides (or has already built) `token`. */
  #canResolve(token: ProviderToken<unknown>): boolean {
    if (this.#instances.has(token) || this.#providers.has(token) || this.#multi.has(token)) {
      return true;
    }
    if (this.#parent === undefined) return false;
    return this.#parent.#canResolve(token);
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

  #build(provider: SingleProvider): unknown {
    if (typeof provider === "function") return construct(provider);
    if ("useValue" in provider) return provider.useValue;
    if ("useFactory" in provider) return provider.useFactory();
    if ("useClass" in provider) return new provider.useClass();
    return this.#resolve(provider.useExisting);
  }

  /** Build one element of a `multi` token (exactly one `use*` is set). */
  #buildMultiElement(provider: MultiProvider): unknown {
    if (provider.useFactory !== undefined) return provider.useFactory();
    if (provider.useClass !== undefined) return new provider.useClass();
    if (provider.useExisting !== undefined) return this.#resolve(provider.useExisting);
    return provider.useValue;
  }
}

/** Construct a concrete class token. Abstract tokens have no runtime constructor and throw. */
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
 * Create a fresh injector from `providers` (a child of the app `root`, so `@Injectable` root
 * singletons are shared), run `fn` inside it, and DESTROY the injector when `fn` settles (firing
 * every `onDestroy`). The one-liner a framework adapter uses so application code never touches
 * `createInjector`/`runInInjectionContext`: it just `inject()`s. `providers` is normally the
 * single runtime seam (e.g. the request bindings); everything else self-builds and is torn down
 * with the scope.
 */
export function runInContext<R>(providers: readonly Provider[], fn: () => R): R {
  const injector = createInjector(providers, root());
  const result = runInInjectionContext(injector, fn);
  if (result instanceof Promise) return result.finally(() => injector.destroy()) as R;
  void injector.destroy();
  return result;
}

/** A test injector with sugar. `testBed([{ provide: X, useValue: mock }]).inject(Service)` builds
 *  the real graph with your overrides; `run` executes a body in the context. Beats hand-writing
 *  createInjector + runInInjectionContext in every test. */
export interface TestBed {
  readonly injector: Injector;
  inject<T>(token: ProviderToken<T>): T;
  inject<T>(token: ProviderToken<T>, options: { optional: true }): T | undefined;
  run<R>(fn: () => R): R;
}

export function testBed(providers: readonly Provider[] = []): TestBed {
  const injector = createInjector(providers);
  return {
    injector,
    inject: <T>(token: ProviderToken<T>, options?: InjectOptions): T | undefined =>
      options?.optional === true ? injector.get(token, { optional: true }) : injector.get(token),
    run: (fn) => runInInjectionContext(injector, fn),
  };
}
