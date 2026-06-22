import {
  createInjector,
  type InjectOptions,
  type Injector,
  type Provider,
  type ProviderToken,
} from "./injector";

/**
 * The `@brika/di` analog of Angular's `TestBed`: configure a service's ports/config once, then
 * `inject()` the service - field injection wires the rest. It removes the bespoke `makeScope`-style
 * helper each test file used to hand-roll (build an injector, list the always-present fakes, merge
 * per-test overrides, `.get()` the service).
 *
 * Two deliberate differences from Angular, both for safety:
 *  - It is NOT a global singleton, so there is no cross-test reset to forget: each {@link testBed}
 *    is its own isolated container.
 *  - {@link TestBed.with} returns a NEW bed layered on this one (later providers win), so a shared
 *    base bed built in `beforeEach` is never mutated by a single test's override.
 *
 *   let bed: TestBed;
 *   beforeEach(() => {
 *     bed = testBed(provide(ScopeStore, scopes), provide(ScopeMembers, members));
 *     service = bed.inject(ScopeService);
 *   });
 *   // a test that needs one extra binding, without touching the shared bed:
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
