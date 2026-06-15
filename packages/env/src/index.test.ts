import { describe, expect, test } from "bun:test";
import { z } from "zod";
import { defineEnv, EnvError } from "./index";

describe("defineEnv", () => {
  test("parses the source and applies defaults", () => {
    const vars = defineEnv(
      {
        STORE_URL: z.url().default("https://store.brika.dev"),
        TOKEN: z.string().min(1),
      },
      () => ({ TOKEN: "abc" }),
    );
    expect(vars()).toEqual({ STORE_URL: "https://store.brika.dev", TOKEN: "abc" });
  });

  test("reads the source once, then serves from cache", () => {
    let reads = 0;
    const vars = defineEnv({ A: z.string() }, () => {
      reads += 1;
      return { A: "x" };
    });
    vars();
    vars();
    expect(reads).toBe(1);
  });

  test("throws EnvError listing every problem and where to set it", () => {
    const vars = defineEnv(
      {
        SESSION_SECRET: z.string().min(1),
        GITHUB_CLIENT_ID: z.string().min(1),
      },
      () => ({}),
    );
    expect(() => vars()).toThrow(EnvError);
    try {
      vars();
      throw new Error("expected vars() to throw");
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toContain("SESSION_SECRET");
      expect(message).toContain("GITHUB_CLIENT_ID");
      expect(message).toContain(".dev.vars");
    }
  });
});
