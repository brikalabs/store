import { describe, expect, test } from "bun:test";
import { createInjector, inject, provides, token } from "./injector";

/**
 * Injecting by interface, with no abstract class. A pure `interface` has no runtime identity, so
 * it cannot be a token on its own; `token<X>()` mints the minimal runtime value, and declaring it
 * under the SAME name as the interface (TypeScript merges a type and a value) means the one
 * identifier `X` is both the type and the thing you `inject(X)`. `@provides(...)` then lets a
 * single class back several interface tokens at once - what `implements X, Y` expresses at the
 * type level, registered for DI.
 */

interface Clock {
  now(): number;
}
const Clock = token<Clock>();

interface Logger {
  log(message: string): void;
}
const Logger = token<Logger>();

// One class implements BOTH interfaces and is registered for both tokens.
@provides(Clock, Logger)
class SystemServices implements Clock, Logger {
  readonly lines: string[] = [];
  now(): number {
    return 1000;
  }
  log(message: string): void {
    this.lines.push(message);
  }
}

describe("interface tokens via token() + @provides()", () => {
  test("inject(X) resolves by interface to the providing class", () => {
    const injector = createInjector();
    expect(injector.get(Clock).now()).toBe(1000);
  });

  test("one class backs multiple interfaces, as a single shared instance", () => {
    const injector = createInjector();
    const clock = injector.get(Clock);
    const logger = injector.get(Logger);
    expect(clock).toBe(logger); // same SystemServices instance behind both tokens
    logger.log("hi");
    expect(injector.get(SystemServices).lines).toEqual(["hi"]);
  });

  test("an explicit provider still overrides the @provides default", () => {
    const fakeClock: Clock = { now: () => 0 };
    const injector = createInjector([{ provide: Clock, useValue: fakeClock }]);
    expect(injector.get(Clock).now()).toBe(0);
  });

  test("a consumer injects the interface, not the concrete class", () => {
    class Greeter {
      readonly clock = inject(Clock);
      greet(): string {
        return `now=${this.clock.now()}`;
      }
    }
    expect(createInjector().get(Greeter).greet()).toBe("now=1000");
  });
});
