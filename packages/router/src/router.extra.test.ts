import { describe, expect, test } from "bun:test";
import { Hono } from "hono";
import { z } from "zod";
import { badRequest } from "./errors";
import type { RouteLogEntry } from "./logger";
import { createRouter, formatRoutes, simplifyPattern } from "./router";

/**
 * Router branches not covered by router.test.ts: the PUT and PATCH builders, a
 * bare route-list controller, query/body validation success on those verbs, the
 * unexpected-error path (rethrown, surfaced to the logger), the X-Forwarded-For
 * client IP, and the standalone `simplifyPattern`/`formatRoutes` helpers.
 */

const { route, controller, mount, routes } = createRouter<{ tag: string }>();

describe("PUT and PATCH builders", () => {
  test("mount registers PUT and PATCH and parses their bodies", async () => {
    const app = new Hono();
    mount(
      app,
      [
        controller([
          route.put({
            path: "/item/:id",
            body: z.object({ name: z.string() }),
            handler: ({ params, body }) => ({ id: params.id, name: body.name, verb: "put" }),
          }),
          route.patch({
            path: "/item/:id",
            body: z.object({ name: z.string() }),
            handler: ({ params, body }) => ({ id: params.id, name: body.name, verb: "patch" }),
          }),
        ]),
      ],
      { context: () => ({ tag: "ctx" }) },
    );

    const put = await app.request("/item/7", {
      method: "PUT",
      body: JSON.stringify({ name: "a" }),
      headers: { "content-type": "application/json" },
    });
    expect(put.status).toBe(200);
    expect(await put.json()).toEqual({ id: "7", name: "a", verb: "put" });

    const patch = await app.request("/item/7", {
      method: "PATCH",
      body: JSON.stringify({ name: "b" }),
      headers: { "content-type": "application/json" },
    });
    expect(await patch.json()).toEqual({ id: "7", name: "b", verb: "patch" });
  });

  test("PUT rejects an invalid body with a 400", async () => {
    const app = new Hono();
    mount(
      app,
      [
        controller([
          route.put({
            path: "/item",
            body: z.object({ name: z.string() }),
            handler: ({ body }) => body,
          }),
        ]),
      ],
      { context: () => ({ tag: "ctx" }) },
    );
    const res = await app.request("/item", {
      method: "PUT",
      body: JSON.stringify({ name: 5 }),
      headers: { "content-type": "application/json" },
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid request body" });
  });
});

describe("optional-segment expansion", () => {
  test("a sole optional with no prefix never registers an empty pattern (would bind '/')", () => {
    const app = new Hono();
    mount(app, [controller([route.get({ path: ":x?", handler: () => ({ ok: true }) })])], {
      context: () => ({ tag: "ctx" }),
    });
    const patterns = routes(app).map((r) => r.pattern);
    expect(patterns).not.toContain("");
    expect(patterns.some((p) => p.includes(":x"))).toBe(true);
  });
});

describe("bare route-list controller", () => {
  test("a plain array of routes mounts at the root with no prefix or middleware", async () => {
    const app = new Hono();
    mount(app, [controller([route.get({ path: "/ping", handler: () => ({ pong: true }) })])], {
      context: () => ({ tag: "ctx" }),
    });
    expect(await (await app.request("/ping")).json()).toEqual({ pong: true });
  });
});

describe("unexpected errors", () => {
  test("a non-HttpError is rethrown and reported to the logger", async () => {
    const entries: RouteLogEntry[] = [];
    const app = new Hono();
    let caught: unknown;
    app.onError((error) => {
      caught = error;
      return new Response("handled", { status: 500 });
    });
    mount(
      app,
      [
        controller([
          route.get({
            path: "/crash",
            handler: () => {
              throw new Error("kaboom");
            },
          }),
        ]),
      ],
      { context: () => ({ tag: "ctx" }), logger: (entry) => entries.push(entry) },
    );

    const res = await app.request("/crash");
    expect(res.status).toBe(500);
    expect(caught).toBeInstanceOf(Error);
    const entry = entries[0];
    expect(entry?.status).toBe(500);
    expect(entry?.error).toBeInstanceOf(Error);
  });

  test("a thrown HttpError becomes its status and is not surfaced as an error", async () => {
    const entries: RouteLogEntry[] = [];
    const app = new Hono();
    mount(
      app,
      [
        controller([
          route.get({
            path: "/bad",
            handler: () => {
              throw badRequest("nope");
            },
          }),
        ]),
      ],
      { context: () => ({ tag: "ctx" }), logger: (entry) => entries.push(entry) },
    );
    const res = await app.request("/bad");
    expect(res.status).toBe(400);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ error: "nope" });
    expect(entries[0]?.status).toBe(400);
    expect(entries[0]?.error).toBeUndefined();
  });
});

describe("client IP resolution", () => {
  test("falls back to the first X-Forwarded-For hop when CF-Connecting-IP is absent", async () => {
    const entries: RouteLogEntry[] = [];
    const app = new Hono();
    mount(app, [controller([route.get({ path: "/whoami", handler: () => ({}) })])], {
      context: () => ({ tag: "ctx" }),
      logger: (entry) => entries.push(entry),
    });
    await app.request("/whoami", {
      headers: { "x-forwarded-for": "198.51.100.7, 70.41.3.18" },
    });
    expect(entries[0]?.clientIp).toBe("198.51.100.7");
  });

  test("prefers CF-Connecting-IP over X-Forwarded-For", async () => {
    const entries: RouteLogEntry[] = [];
    const app = new Hono();
    mount(app, [controller([route.get({ path: "/whoami", handler: () => ({}) })])], {
      context: () => ({ tag: "ctx" }),
      logger: (entry) => entries.push(entry),
    });
    await app.request("/whoami", {
      headers: { "cf-connecting-ip": "203.0.113.9", "x-forwarded-for": "198.51.100.7" },
    });
    expect(entries[0]?.clientIp).toBe("203.0.113.9");
  });

  test("leaves the client IP undefined when no forwarding headers are present", async () => {
    const entries: RouteLogEntry[] = [];
    const app = new Hono();
    mount(app, [controller([route.get({ path: "/whoami", handler: () => ({}) })])], {
      context: () => ({ tag: "ctx" }),
      logger: (entry) => entries.push(entry),
    });
    await app.request("/whoami");
    expect(entries[0]?.clientIp).toBeUndefined();
  });
});

/** Returns its argument, dropping the binding name so the function stays anonymous. */
function asAnonymous<T>(fn: T): T {
  return fn;
}

describe("anonymous handlers", () => {
  test("a nameless handler records no handler name", async () => {
    const entries: RouteLogEntry[] = [];
    const app = new Hono();
    // Passing the arrow straight through a helper keeps its `name` empty, so the
    // router maps it to an undefined handler name in the log entry.
    mount(app, [controller([route.get({ path: "/anon", handler: asAnonymous(() => ({})) })])], {
      context: () => ({ tag: "ctx" }),
      logger: (entry) => entries.push(entry),
    });
    await app.request("/anon");
    expect(entries[0]?.handler).toBeUndefined();
    // The route still captures a best-effort source location for debugging.
    expect(entries[0]?.source).toContain("router.extra.test.ts");
  });
});

describe("simplifyPattern", () => {
  test("strips every {regex} constraint from a pattern", () => {
    expect(simplifyPattern("/:scope{@[^/]+}/:pkg{[^-][^/]*}")).toBe("/:scope/:pkg");
    expect(simplifyPattern("/plain/:id")).toBe("/plain/:id");
  });
});

describe("formatRoutes alignment", () => {
  test("pads the method column to the widest method", () => {
    const app = new Hono();
    mount(
      app,
      [
        controller([
          route.get({ path: "/a", handler: () => ({}) }),
          route.delete({ path: "/b", handler: () => ({}) }),
        ]),
      ],
      { context: () => ({ tag: "ctx" }) },
    );
    const table = formatRoutes(routes(app));
    expect(table).toContain("GET     /a");
    expect(table).toContain("DELETE  /b");
  });
});
