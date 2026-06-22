import {
  createInjector,
  type InjectOptions,
  type Injector,
  type Provider,
  type ProviderToken,
} from "./injector";

/**
 * The `@brika/di` analog of Angular's `TestBed`: configure a service's ports/config once, then
 * `inject()` the service - field injection wires the rest. Unlike Angular it is not a global
 * singleton (each {@link testBed} is isolated), and {@link TestBed.with} returns a NEW bed layered
 * on this one, so a shared base bed built in `beforeEach` is never mutated by one test's override.
 *
 *   bed = testBed(provide(ScopeStore, scopes), provide(ScopeMembers, members));
 *   service = bed.inject(ScopeService);
 *   const capped = bed.with(provide(MaxScopesPerAccount, 2)).inject(ScopeService);
 */
export class TestBed {
  readonly #providers: readonly Provider[];
  /** Built lazily on first {@link inject} and reused, so repeated injects share one singleton set. */
  #injector: Injector | undefined;

  constructor(providers: readonly Provider[] = []) {
    this.#providers = providers;
  }

  /** A new bed = this bed's providers plus `extra`; `extra` is appended, so it overrides on conflict. */
  with(...extra: Provider[]): TestBed {
    return new TestBed([...this.#providers, ...extra]);
  }

  /** Resolve a token from this bed (same lazy, cached, singleton semantics as a production injector). */
  inject<T>(token: ProviderToken<T>): T;
  inject<T>(token: ProviderToken<T>, options: { optional: true }): T | undefined;
  inject<T>(token: ProviderToken<T>, options?: InjectOptions): T | undefined {
    this.#injector ??= createInjector(this.#providers);
    return options?.optional === true
      ? this.#injector.get(token, { optional: true })
      : this.#injector.get(token);
  }
}

/** Create a {@link TestBed} seeded with `providers` (commonly {@link provide} value shorthands). */
export function testBed(...providers: Provider[]): TestBed {
  return new TestBed(providers);
}
