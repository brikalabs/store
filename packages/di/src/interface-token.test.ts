import { describe, expect, test } from "bun:test";
import { createInjector, inject, token } from "./injector";

/**
 * Injecting by interface, with no abstract class. A pure `interface` has no runtime identity, so
 * it cannot be a token on its own; `token<X>()` mints the minimal runtime value, and declaring it
 * under the SAME name as the interface (TypeScript merges a type and a value) means the one
 * identifier `X` is both the type and the thing you `inject(X)`. The implementation is bound once
 * with an ordinary provider.
 */

interface Clock {
  now(): number;
}
const Clock = token<Clock>();

class SystemClock implements Clock {
  now(): number {
    return 1000;
  }
}

describe("interface tokens via token()", () => {
  test("inject(X) resolves by interface to the bound implementation", () => {
    const injector = createInjector([{ provide: Clock, useFactory: () => new SystemClock() }]);
    expect(injector.get(Clock).now()).toBe(1000);
  });

  test("a test overrides the same interface with a fake", () => {
    const injector = createInjector([{ provide: Clock, useValue: { now: () => 0 } }]);
    expect(injector.get(Clock).now()).toBe(0);
  });

  test("a consumer injects the interface, not the concrete class", () => {
    class Greeter {
      readonly clock = inject(Clock);
      greet(): string {
        return `now=${this.clock.now()}`;
      }
    }
    const result = createInjector([{ provide: Clock, useFactory: () => new SystemClock() }]).get(
      Greeter,
    );
    expect(result.greet()).toBe("now=1000");
  });
});
