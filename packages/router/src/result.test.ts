import { describe, expect, test } from "bun:test";
import { z } from "zod";
import { HttpError } from "./errors";
import { okOrThrow, parseBody } from "./result";

describe("okOrThrow", () => {
  test("returns the success branch unchanged", () => {
    const ok = { ok: true as const, value: 42 };
    expect(okOrThrow(ok)).toBe(ok);
  });

  test("throws the result's own status + message on failure", () => {
    try {
      okOrThrow({ ok: false, status: 409, message: "already exists" });
      throw new Error("expected throw");
    } catch (error) {
      expect(error).toBeInstanceOf(HttpError);
      expect((error as HttpError).status).toBe(409);
      expect((error as HttpError).message).toBe("already exists");
    }
  });
});

describe("parseBody", () => {
  const schema = z.object({ name: z.string() });

  test("returns the parsed, typed value", () => {
    expect(parseBody(schema, { name: "x" })).toEqual({ name: "x" });
  });

  test("throws a 400 HttpError with the given message on mismatch", () => {
    try {
      parseBody(schema, { name: 1 }, "Invalid name");
      throw new Error("expected throw");
    } catch (error) {
      expect(error).toBeInstanceOf(HttpError);
      expect((error as HttpError).status).toBe(400);
      expect((error as HttpError).message).toBe("Invalid name");
    }
  });
});
