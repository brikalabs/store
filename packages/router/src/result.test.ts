import { describe, expect, test } from "bun:test";
import { z } from "zod";
import { HttpError } from "./errors";
import { okOrThrow, readBody } from "./result";

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

describe("readBody", () => {
  const schema = z.object({ name: z.string() });
  const post = (body: string): Request => new Request("https://x/", { method: "POST", body });

  test("reads and validates a JSON body in one step", async () => {
    expect(await readBody(post(JSON.stringify({ name: "x" })), schema)).toEqual({ name: "x" });
  });

  test("turns malformed JSON into a 400, not a 500", async () => {
    await expect(readBody(post("{ not json"), schema, "Invalid body")).rejects.toMatchObject({
      status: 400,
      message: "Invalid body",
    });
  });

  test("throws a 400 on a schema mismatch", async () => {
    await expect(readBody(post(JSON.stringify({ name: 1 })), schema)).rejects.toBeInstanceOf(
      HttpError,
    );
  });
});
