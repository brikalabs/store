import { describe, expect, test } from "bun:test";
import { created, devError, json, noContent, reply, text } from "./response";

/**
 * The response constructors: status defaults, header shapes, and the cache-control
 * markers. Covers `json`, `reply`, `created`, `text`, and `noContent`.
 */

describe("json", () => {
  test("defaults to 200 and serializes the body", async () => {
    const res = json({ a: 1 });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
    expect(await res.json()).toEqual({ a: 1 });
  });

  test("honors a custom status and extra headers", async () => {
    const res = json({ ok: true }, { status: 202, headers: { "x-test": "v" } });
    expect(res.status).toBe(202);
    expect(res.headers.get("x-test")).toBe("v");
    expect(await res.json()).toEqual({ ok: true });
  });
});

describe("reply", () => {
  test("defaults to 200 and marks cache-control no-store", async () => {
    const res = reply({ ok: true });
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ ok: true });
  });

  test("honors a custom status", () => {
    expect(reply({ error: "nope" }, 404).status).toBe(404);
  });
});

describe("created", () => {
  test("is a 201 no-store JSON response", async () => {
    const res = created({ id: "1" });
    expect(res.status).toBe(201);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ id: "1" });
  });
});

describe("text", () => {
  test("defaults to 200 plain text", async () => {
    const res = text("hello");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    expect(await res.text()).toBe("hello");
  });

  test("honors a custom status and lets extra headers override", async () => {
    const res = text("body", { status: 503, headers: { "x-extra": "1" } });
    expect(res.status).toBe(503);
    expect(res.headers.get("x-extra")).toBe("1");
    expect(res.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    expect(await res.text()).toBe("body");
  });
});

describe("devError", () => {
  test("is a 500 carrying the Error message and stack lines", async () => {
    const res = devError(new Error("boom"));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("boom");
    expect(body.stack[0]).toContain("boom");
  });

  test("coerces a non-Error throw into a message", async () => {
    const body = await devError("just a string").json();
    expect(body.error).toBe("just a string");
  });
});

describe("noContent", () => {
  test("is a 204 with an empty body", async () => {
    const res = noContent();
    expect(res.status).toBe(204);
    expect(await res.text()).toBe("");
  });

  test("accepts extra headers", () => {
    const res = noContent({ "x-h": "v" });
    expect(res.status).toBe(204);
    expect(res.headers.get("x-h")).toBe("v");
  });
});
