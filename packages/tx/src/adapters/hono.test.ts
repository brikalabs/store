import { describe, expect, test } from "bun:test";
import { Hono } from "hono";
import { InMemoryFiles } from "../testing/in-memory-files";
import { transactional } from "./hono";
import { transactionalStorage } from "./storage";

describe("Hono integration", () => {
  test("each request gets its own transaction; one rollback never affects another", async () => {
    const raw = new InMemoryFiles();
    const files = transactionalStorage(raw);

    const app = new Hono();
    // Own the error response (and keep the test output clean) instead of Hono's
    // default logger; the rollback has already run inside the handler by now.
    app.onError((_error, c) => c.text("rolled back", 500));
    app.post(
      "/:name",
      transactional(async (c) => {
        const name = c.req.param("name");
        await files.put(`${name}.tgz`, "bytes"); // staged; rolls back if this handler throws
        if (name === "bad") throw new Error("boom");
        return c.json({ ok: true });
      }),
    );

    // Fire both at the same time: their async contexts interleave.
    const [good, bad] = await Promise.all([
      app.request("/good", { method: "POST" }),
      app.request("/bad", { method: "POST" }),
    ]);

    expect(good.status).toBe(200);
    expect(bad.status).toBe(500);
    expect(raw.has("good.tgz")).toBe(true); // committed
    expect(raw.has("bad.tgz")).toBe(false); // rolled back, despite running alongside "good"
  });
});
