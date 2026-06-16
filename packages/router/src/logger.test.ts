import { describe, expect, test } from "bun:test";
import { Hono } from "hono";
import { type RouteLogEntry, toJsonRecord } from "./logger";
import { createRouter, formatRoutes } from "./router";

const { route, controller, mount, routes, logRoutes } = createRouter<null>();

describe("mount logger", () => {
  test("captures method, pattern, status, controller, handler, and client IP", async () => {
    const entries: RouteLogEntry[] = [];
    const app = new Hono();
    mount(
      app,
      [
        controller({
          name: "auth",
          prefix: "/api",
          routes: [
            route.post({
              path: "/login",
              handler: function handleLogin() {
                return { ok: true };
              },
            }),
          ],
        }),
      ],
      { context: () => null, logger: (entry) => entries.push(entry) },
    );

    await app.request("/api/login", {
      method: "POST",
      headers: { "cf-connecting-ip": "203.0.113.45" },
    });

    const entry = entries[0];
    expect(entry?.method).toBe("POST");
    expect(entry?.pattern).toBe("/api/login");
    expect(entry?.status).toBe(200);
    expect(entry?.controller).toBe("auth");
    expect(entry?.handler).toBe("handleLogin");
    expect(entry?.source).toContain("logger.test.ts");
    expect(entry?.clientIp).toBe("203.0.113.45");
    expect(typeof entry?.durationMs).toBe("number");
  });
});

describe("toJsonRecord", () => {
  test("shapes the structured record and rounds the duration", () => {
    const record = toJsonRecord(
      {
        method: "POST",
        pattern: "/api/login",
        path: "/api/login",
        status: 200,
        durationMs: 42.14,
        controller: "auth",
        handler: "handleLogin",
        clientIp: "203.0.113.45",
      },
      "API Request Processed",
    );
    expect(record.level).toBe("info");
    expect(record.message).toBe("API Request Processed");
    expect(record.http).toEqual({
      method: "POST",
      url: "/api/login",
      status_code: 200,
      duration_ms: 42.1,
      route: undefined,
    });
    expect(record.code_context).toEqual({ controller: "auth", handler: "handleLogin" });
    expect(record.network).toEqual({ client_ip: "203.0.113.45" });
  });

  test("level reflects status and thrown errors", () => {
    const base = { method: "GET", pattern: "/x", path: "/x", durationMs: 1 } as const;
    expect(toJsonRecord({ ...base, status: 404 }, "r").level).toBe("warn");
    expect(toJsonRecord({ ...base, status: 500 }, "r").level).toBe("error");
    expect(toJsonRecord({ ...base, status: 200, error: new Error("x") }, "r").level).toBe("error");
  });
});

function appWithRoutes(): Hono {
  const app = new Hono();
  app.use("/*", async (_c, next) => {
    await next();
  });
  app.get("/", (c) => c.text("root"));
  mount(
    app,
    [
      controller({
        prefix: "/api",
        routes: [
          route.get({ path: "/files/:dir?/:name", handler: () => ({}) }),
          route.post({ path: "/login", handler: () => ({}) }),
        ],
      }),
    ],
    { context: () => null },
  );
  return app;
}

describe("routes(app)", () => {
  test("reads the registered routes from Hono, including `/`, skipping middleware", () => {
    expect(routes(appWithRoutes())).toEqual([
      { method: "GET", pattern: "/" },
      { method: "GET", pattern: "/api/files/:dir/:name" },
      { method: "GET", pattern: "/api/files/:name" },
      { method: "POST", pattern: "/api/login" },
    ]);
  });
});

describe("formatRoutes()", () => {
  test("simple mode strips regex constraints; verbose keeps the raw matcher pattern", () => {
    const app = new Hono();
    mount(app, [controller([route.get({ path: "/:pkg{[^-][^\\x2f]*}", handler: () => ({}) })])], {
      context: () => null,
    });
    const infos = routes(app);
    expect(formatRoutes(infos)).toBe("GET  /:pkg");
    expect(formatRoutes(infos, { mode: "verbose" })).toBe("GET  /:pkg{[^-][^\\x2f]*}");
  });
});

describe("logRoutes(app)", () => {
  test("prints the table to a sink", () => {
    const lines: string[] = [];
    logRoutes(appWithRoutes(), { log: (table) => lines.push(table) });
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("GET   /");
    expect(lines[0]).toContain("POST  /api/login");
  });
});
