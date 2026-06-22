import { describe, expect, test } from "bun:test";
import { InjectionToken, inject, provide } from "./injector";
import { testBed } from "./testing";

interface Clock {
  now(): number;
}
const Clock = new InjectionToken<Clock>({ description: "Clock" });
const Multiplier = new InjectionToken<number>({ description: "Multiplier" });

// A field-injected service, the shape the bed is meant to wire up.
class Stamper {
  readonly #clock = inject(Clock);
  readonly #mult = inject(Multiplier, { optional: true }) ?? 1;
  stamp(): number {
    return this.#clock.now() * this.#mult;
  }
}

describe("testBed", () => {
  test("injects a field-injected service over provided ports", () => {
    const bed = testBed(provide(Clock, { now: () => 10 }));
    expect(bed.inject(Stamper).stamp()).toBe(10);
  });

  test("repeated inject on one bed shares a singleton", () => {
    const bed = testBed(provide(Clock, { now: () => 1 }));
    expect(bed.inject(Stamper)).toBe(bed.inject(Stamper));
  });

  test("with() layers an override without mutating the base bed", () => {
    const base = testBed(provide(Clock, { now: () => 10 }));
    const scaled = base.with(provide(Multiplier, 3));
    expect(scaled.inject(Stamper).stamp()).toBe(30);
    // The base is untouched - it never saw Multiplier.
    expect(base.inject(Stamper).stamp()).toBe(10);
  });

  test("optional inject yields undefined for an unprovided token", () => {
    const bed = testBed(provide(Clock, { now: () => 1 }));
    expect(bed.inject(Multiplier, { optional: true })).toBeUndefined();
  });
});
