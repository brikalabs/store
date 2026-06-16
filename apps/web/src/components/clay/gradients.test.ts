import { describe, expect, test } from "bun:test";
import { GRADIENTS, gradientCss, gradientFor, hashString } from "./gradients";

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
  test("picks a palette from the table, stable per seed", () => {
    const g = gradientFor("@brika/plugin-snapshot");
    expect(GRADIENTS).toContainEqual(g);
    expect(gradientFor("@brika/plugin-snapshot")).toEqual(g);
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
