import { describe, expect, test } from "bun:test";
import {
  createInjector,
  InjectionToken,
  inject,
  isInInjectionContext,
  runInInjectionContext,
} from "./injector";

// A dependency with no class to name it (an interface / binding) -> an InjectionToken.
const DB = new InjectionToken<{ readonly tag: string }>();

// Stores/services declare their deps with inject(), Angular-style - no constructor params.
class ReviewStore {
  readonly db = inject(DB);
  list(): string {
    return `reviews@${this.db.tag}`;
  }
}
class SocialService {
  readonly reviews = inject(ReviewStore);
  recent(): string {
    return this.reviews.list();
  }
}

describe("inject + auto-provide", () => {
  test("resolves a class and its injected token dependency", () => {
    const injector = createInjector([{ provide: DB, useValue: { tag: "prod" } }]);
    expect(injector.get(SocialService).recent()).toBe("reviews@prod");
  });

  test("singletons: the same instance is shared within an injector", () => {
    const injector = createInjector([{ provide: DB, useValue: { tag: "x" } }]);
    expect(injector.get(ReviewStore)).toBe(injector.get(ReviewStore));
    expect(injector.get(SocialService).reviews).toBe(injector.get(ReviewStore));
  });
});

describe("providers", () => {
  test("useClass + useExisting + useFactory + useValue", () => {
    class Real {
      who(): string {
        return "real";
      }
    }
    const TOKEN = new InjectionToken<{ who(): string }>();
    const ALIAS = new InjectionToken<{ who(): string }>();
    const injector = createInjector([
      { provide: TOKEN, useClass: Real },
      { provide: ALIAS, useExisting: TOKEN },
      { provide: DB, useFactory: () => ({ tag: "f" }) },
    ]);
    expect(injector.get(TOKEN).who()).toBe("real");
    expect(injector.get(ALIAS)).toBe(injector.get(TOKEN)); // an alias shares the one instance
    expect(injector.get(DB).tag).toBe("f");
  });

  test("an InjectionToken's default factory acts like providedIn: 'root'", () => {
    const CONFIG = new InjectionToken<number>({ factory: () => 42 });
    expect(createInjector().get(CONFIG)).toBe(42);
  });

  test("a default-factory token is a ROOT singleton: one instance shared by every child scope", () => {
    let builds = 0;
    const CONFIG = new InjectionToken<{ n: number }>({
      factory: () => {
        builds += 1;
        return { n: builds };
      },
    });
    const root = createInjector();
    const childA = createInjector([], root);
    const childB = createInjector([], root);
    // First asked from a child, but built once at the root and shared - not one copy per scope.
    expect(childA.get(CONFIG)).toBe(childB.get(CONFIG));
    expect(root.get(CONFIG)).toBe(childA.get(CONFIG));
    expect(builds).toBe(1);
  });
});

describe("mock injection for tests", () => {
  test("override one dependency with a mock; the rest of the graph stays real", () => {
    const fakeReviews: ReviewStore = { db: { tag: "" }, list: () => "MOCK" };
    const injector = createInjector([
      { provide: DB, useValue: { tag: "ignored" } },
      { provide: ReviewStore, useValue: fakeReviews },
    ]);
    expect(injector.get(SocialService).recent()).toBe("MOCK");
  });
});

describe("hierarchical injectors", () => {
  test("a child overrides its parent; unknown tokens delegate up", () => {
    const root = createInjector([{ provide: DB, useValue: { tag: "root" } }]);
    const child = createInjector([{ provide: DB, useValue: { tag: "child" } }], root);
    expect(child.get(DB).tag).toBe("child");
    expect(child.get(ReviewStore).list()).toBe("reviews@child");
  });
});

describe("injection context", () => {
  test("inject() outside a context throws loudly", () => {
    expect(() => inject(DB)).toThrow(/outside an injection context/);
  });

  test("runInInjectionContext keeps the scope across an await", async () => {
    const injector = createInjector([{ provide: DB, useValue: { tag: "async" } }]);
    const result = await runInInjectionContext(injector, async () => {
      const before = inject(DB).tag;
      await Promise.resolve();
      const after = inject(SocialService).recent(); // still in context after the await
      return `${before}:${after}`;
    });
    expect(result).toBe("async:reviews@async");
  });

  test("isInInjectionContext reflects the active scope", () => {
    expect(isInInjectionContext()).toBe(false);
    runInInjectionContext(createInjector(), () => {
      expect(isInInjectionContext()).toBe(true);
    });
  });
});

describe("errors", () => {
  test("a missing provider throws", () => {
    const MISSING = new InjectionToken<string>();
    expect(() => createInjector().get(MISSING)).toThrow(/No provider for/);
  });

  test("a circular dependency throws", () => {
    class A {
      b = inject(B);
    }
    class B {
      a = inject(A);
    }
    expect(() => createInjector().get(A)).toThrow(/Circular dependency/);
  });
});
