import { describe, expect, test } from "bun:test";
import { Hono } from "hono";
import { z } from "zod";
import { notFound } from "./errors";
import { PKG, packageName } from "./npm";
import { createRouter } from "./router";

/**
 * End-to-end wiring of the router over a real Hono app (no app-specific services):
 * that `mount` injects the per-request context, applies a controller `prefix`,
 * validates body + query, expands the optional-scope `PKG` pattern across every
 * npm name form, serializes plain values + `undefined`, and turns a thrown
 * HttpError into its status.
 */

const { route, controller, mount } = createRouter<{ tag: string }>();

function makeApp(): Hono {
  const app = new Hono();
  mount(
    app,
    [
      // The package routes are mounted FIRST on purpose: thanks to the PKG pattern's
      // regex constraints they are not catch-alls, so the static routes below still
      // match. Registration order does not matter.
      controller([
        // Returns a plain value -> the router serializes it as JSON (200, no-store).
        route.get({
          path: `/${PKG}`,
          handler: ({ params, ctx }) => ({ name: packageName(params), tag: ctx.tag }),
        }),
      ]),
      controller({
        prefix: "/api",
        routes: [
          route.post({
            path: "/echo",
            body: z.object({ x: z.number() }),
            handler: ({ body }) => Response.json(body),
          }),
          route.get({
            path: "/q",
            query: z.object({ sort: z.enum(["asc", "desc"]) }),
            handler: ({ query }) => query,
          }),
          route.get({
            path: "/boom",
            handler: () => {
              throw notFound("nope");
            },
          }),
          route.delete({ path: "/gone", handler: () => undefined }),
        ],
      }),
    ],
    { context: () => ({ tag: "ctx" }) },
  );
  return app;
}

describe("PKG routing + injected context", () => {
  test("expands the scoped, %2f, and unscoped forms to one name and injects ctx", async () => {
    const app = makeApp();
    expect(await (await app.request("/@brika/clay")).json()).toEqual({
      name: "@brika/clay",
      tag: "ctx",
    });
    expect(await (await app.request("/@brika%2fclay")).json()).toEqual({
      name: "@brika/clay",
      tag: "ctx",
    });
    expect(await (await app.request("/react")).json()).toEqual({ name: "react", tag: "ctx" });
  });
});

describe("result serialization", () => {
  test("plain values become 200 JSON; undefined becomes 204; thrown HttpError its status", async () => {
    const app = makeApp();
    const value = await app.request("/react");
    expect(value.status).toBe(200);
    expect(value.headers.get("cache-control")).toBe("no-store");
    expect((await app.request("/api/gone", { method: "DELETE" })).status).toBe(204);
    expect((await app.request("/api/boom")).status).toBe(404);
  });
});

describe("controller prefix + validation", () => {
  test("applies the prefix and validates the body", async () => {
    const app = makeApp();
    const send = (body: string) =>
      app.request("/api/echo", {
        method: "POST",
        body,
        headers: { "content-type": "application/json" },
      });
    expect((await send("not json")).status).toBe(400);
    expect((await send(JSON.stringify({ x: "no" }))).status).toBe(400);
    expect(await (await send(JSON.stringify({ x: 1 }))).json()).toEqual({ x: 1 });
  });

  test("validates the query string", async () => {
    const app = makeApp();
    expect((await app.request("/api/q?sort=sideways")).status).toBe(400);
    expect(await (await app.request("/api/q?sort=asc")).json()).toEqual({ sort: "asc" });
  });
});
