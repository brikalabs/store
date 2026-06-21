import { describe, expect, test } from "bun:test";
import { createInjector, InjectionToken, inject, runInInjectionContext, token } from "./injector";

/** `{ optional: true }` turns a missing dependency into `undefined` instead of a throw. */

interface Telemetry {
  track(event: string): void;
}
const Telemetry = token<Telemetry>();

describe("optional injection", () => {
  test("returns undefined when nothing provides the token", () => {
    expect(createInjector().get(Telemetry, { optional: true })).toBeUndefined();
  });

  test("returns the value when something does provide it", () => {
    const sink: string[] = [];
    const injector = createInjector([
      { provide: Telemetry, useValue: { track: (e: string) => sink.push(e) } },
    ]);
    injector.get(Telemetry, { optional: true })?.track("hit");
    expect(sink).toEqual(["hit"]);
  });

  test("a non-optional missing token still throws", () => {
    const Missing = new InjectionToken<string>();
    expect(() => createInjector().get(Missing)).toThrow(/No provider for/);
  });

  test("inject(token, { optional: true }) works inside a class / context, no throw", () => {
    class Analytics {
      readonly telemetry = inject(Telemetry, { optional: true });
      enabled(): boolean {
        return this.telemetry !== undefined;
      }
    }
    const result = runInInjectionContext(createInjector(), () => inject(Analytics).enabled());
    expect(result).toBe(false);
  });

  test("optional outside an injection context is undefined, not a throw", () => {
    expect(inject(Telemetry, { optional: true })).toBeUndefined();
  });
});
