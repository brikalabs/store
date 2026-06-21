import { describe, expect, test } from "bun:test";
import {
  createInjector,
  DestroyRef,
  Injectable,
  inject,
  runInContext,
  runInInjectionContext,
  testBed,
  token,
} from "./injector";

describe("multi-providers", () => {
  interface Hook {
    name(): string;
  }
  const Hooks = token<Hook[]>();

  test("collects every contribution into an array, in registration order", () => {
    class A implements Hook {
      name() {
        return "a";
      }
    }
    class B implements Hook {
      name() {
        return "b";
      }
    }
    const injector = createInjector([
      { provide: Hooks, useClass: A, multi: true },
      { provide: Hooks, useClass: B, multi: true },
      { provide: Hooks, useValue: { name: () => "c" }, multi: true },
    ]);
    expect(injector.get(Hooks).map((h) => h.name())).toEqual(["a", "b", "c"]);
  });

  test("a consumer injects the whole collection", () => {
    const injector = createInjector([
      { provide: Hooks, useValue: { name: () => "only" }, multi: true },
    ]);
    class Runner {
      readonly hooks = inject(Hooks);
      names() {
        return this.hooks.map((h) => h.name());
      }
    }
    expect(injector.get(Runner).names()).toEqual(["only"]);
  });
});

describe("lifecycle (DestroyRef + destroy)", () => {
  test("onDestroy callbacks run most-recent-first on destroy", async () => {
    const order: number[] = [];
    const injector = createInjector();
    injector.onDestroy(() => {
      order.push(1);
    });
    injector.onDestroy(() => {
      order.push(2);
    });
    await injector.destroy();
    expect(order).toEqual([2, 1]);
  });

  test("inject(DestroyRef).onDestroy registers cleanup for the surrounding scope", async () => {
    const closed: string[] = [];
    class Connection {
      constructor() {
        inject(DestroyRef).onDestroy(() => closed.push("closed"));
      }
    }
    const injector = createInjector();
    runInInjectionContext(injector, () => inject(Connection));
    expect(closed).toEqual([]); // not yet
    await injector.destroy();
    expect(closed).toEqual(["closed"]);
  });

  test("runInContext tears the scope down after an async body settles", async () => {
    const closed: string[] = [];
    class Connection {
      constructor() {
        inject(DestroyRef).onDestroy(() => closed.push("x"));
      }
    }
    await runInContext([], async () => {
      inject(Connection);
      await Promise.resolve();
    });
    expect(closed).toEqual(["x"]);
  });
});

describe("testBed", () => {
  test("resolves the real graph with a single token overridden by a mock", () => {
    const Now = token<() => number>();
    class Clock {
      readonly now = inject(Now);
      tick() {
        return this.now();
      }
    }
    const bed = testBed([{ provide: Now, useValue: () => 7 }]);
    expect(bed.inject(Clock).tick()).toBe(7);
  });

  test("run executes a body in the injection context", () => {
    const Greeting = token<string>();
    const bed = testBed([{ provide: Greeting, useValue: "hi" }]);
    expect(bed.run(() => inject(Greeting))).toBe("hi");
  });
});

// Registered at module load by the decorator (like Angular's providedIn: 'root').
let bootCount = 0;
@Injectable({ providedIn: "root", eager: true })
class Boot {
  constructor() {
    bootCount += 1;
  }
}
let seq = 0;
@Injectable({ providedIn: "root" })
class Cache {
  readonly id: number;
  constructor() {
    seq += 1;
    this.id = seq;
  }
}

describe("@Injectable root singletons", () => {
  test("a root singleton is one shared instance across separate request scopes", () => {
    const a = runInContext([], () => inject(Cache));
    const b = runInContext([], () => inject(Cache));
    expect(a).toBe(b);
    expect(a.id).toBe(b.id);
  });

  test("an eager root singleton is built once when the root injector is first created", () => {
    const boot = runInContext([], () => inject(Boot)); // root exists -> Boot already eager-built
    expect(boot).toBeInstanceOf(Boot);
    expect(bootCount).toBe(1); // eager-built once, not re-constructed on inject
  });
});
