import { describe, expect, test } from "bun:test";
import { gradientCss, gradientFor, hashString } from "./gradients";

describe("hashString", () => {
  test("is deterministic and non-negative", () => {
    expect(hashString("@brika/plugin-i18n")).toBe(hashString("@brika/plugin-i18n"));
    expect(hashString("anything")).toBeGreaterThanOrEqual(0);
    expect(hashString("")).toBe(0);
  });

  test("differs for different inputs", () => {
    expect(hashString("a")).not.toBe(hashString("b"));
  });
});

describe("gradientFor", () => {
  test("generates a stable two-stop hex gradient per seed", () => {
    const g = gradientFor("@brika/plugin-snapshot");
    expect(g).toHaveLength(2);
    for (const stop of g) expect(stop).toMatch(/^#[0-9a-f]{6}$/);
    expect(gradientFor("@brika/plugin-snapshot")).toEqual(g);
  });

  test("differs across seeds", () => {
    expect(gradientFor("@brika/plugin-i18n")).not.toEqual(gradientFor("@brika/plugin-clock"));
  });
});

describe("gradientCss", () => {
  test("renders a linear-gradient with the two stops", () => {
    expect(gradientCss(["#000000", "#ffffff"])).toBe("linear-gradient(140deg, #000000, #ffffff)");
    expect(gradientCss(["#000000", "#ffffff"], 90)).toBe(
      "linear-gradient(90deg, #000000, #ffffff)",
    );
  });
});
