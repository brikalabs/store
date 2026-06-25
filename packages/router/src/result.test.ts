import { describe, expect, test } from "bun:test";
import { z } from "zod";
import { HttpError } from "./errors";
import { okOrThrow, readBody, readBytes, readQuery } from "./result";

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

describe("readQuery", () => {
  const schema = z.object({
    q: z.string().optional(),
    limit: z.coerce.number().default(20),
    tags: z
      .preprocess(
        (v) => (typeof v === "string" ? v.split(",").filter(Boolean) : v),
        z.array(z.string()),
      )
      .default([]),
  });
  const get = (qs: string): Request => new Request(`https://x/search?${qs}`);

  test("validates the query string against the schema, applying coercions and defaults", () => {
    expect(readQuery(get("q=map&limit=5&tags=geo,maps"), schema)).toEqual({
      q: "map",
      limit: 5,
      tags: ["geo", "maps"],
    });
    expect(readQuery(get(""), schema)).toEqual({ limit: 20, tags: [] });
  });

  test("throws a 400 on a schema mismatch", () => {
    expect(() => readQuery(get("limit=notanumber"), schema, "Bad query")).toThrow(HttpError);
    try {
      readQuery(get("limit=notanumber"), schema, "Bad query");
    } catch (error) {
      expect((error as HttpError).status).toBe(400);
      expect((error as HttpError).message).toBe("Bad query");
    }
  });
});

describe("readBytes", () => {
  const upload = (body: BodyInit, headers?: Record<string, string>): Request =>
    new Request("https://x/", { method: "POST", body, headers });

  test("returns the buffered bytes within the limit", async () => {
    const bytes = await readBytes(upload(new Uint8Array([1, 2, 3])), 1024);
    expect([...bytes]).toEqual([1, 2, 3]);
  });

  test("rejects up front on an oversize Content-Length (413), before buffering", async () => {
    await expect(
      readBytes(upload("ignored", { "content-length": "99999" }), 8, "too big"),
    ).rejects.toMatchObject({ status: 413, message: "too big" });
  });

  test("rejects an oversize body even when Content-Length lies/absent (413)", async () => {
    await expect(readBytes(upload(new Uint8Array(64)), 8, "too big")).rejects.toMatchObject({
      status: 413,
    });
  });

  test("rejects an empty body with a 400", async () => {
    await expect(readBytes(upload(new Uint8Array(0)), 1024)).rejects.toMatchObject({ status: 400 });
  });
});
