import { afterEach, describe, expect, test } from "bun:test";
import {
  consoleLogger,
  formatLogEntry,
  jsonLogger,
  levelFor,
  type RouteLogEntry,
  toJsonRecord,
} from "./logger";

/**
 * The logging helpers: level selection, single-line formatting (including the
 * pattern suffix), and the two console-backed loggers. Console output is captured
 * and asserted on its observable text/level, not on internals.
 */

const base: Omit<RouteLogEntry, "status"> = {
  method: "GET",
  pattern: "/x",
  path: "/x",
  durationMs: 1,
};

describe("levelFor", () => {
  test("info for a 2xx with no error", () => {
    expect(levelFor({ ...base, status: 200 })).toBe("info");
  });

  test("warn for a 4xx", () => {
    expect(levelFor({ ...base, status: 404 })).toBe("warn");
    expect(levelFor({ ...base, status: 499 })).toBe("warn");
  });

  test("error for a 5xx", () => {
    expect(levelFor({ ...base, status: 500 })).toBe("error");
  });

  test("error when an error is present regardless of status", () => {
    expect(levelFor({ ...base, status: 200, error: new Error("boom") })).toBe("error");
  });
});

describe("formatLogEntry", () => {
  test("formats a single line and rounds the duration to one decimal", () => {
    expect(
      formatLogEntry({
        method: "POST",
        pattern: "/-/publish",
        path: "/-/publish",
        status: 201,
        durationMs: 12.34,
      }),
    ).toBe("POST 201 12.3ms /-/publish");
  });

  test("appends the pattern when it differs from the concrete path", () => {
    expect(
      formatLogEntry({
        method: "GET",
        pattern: "/users/:id",
        path: "/users/42",
        status: 200,
        durationMs: 5,
      }),
    ).toBe("GET 200 5.0ms /users/42 (/users/:id)");
  });
});

type ConsoleMethod = "log" | "warn" | "error";

interface ConsoleCall {
  readonly method: ConsoleMethod;
  readonly args: readonly unknown[];
}

interface Captured {
  readonly calls: ConsoleCall[];
  restore: () => void;
}

function captureConsole(): Captured {
  const calls: ConsoleCall[] = [];
  const original = { log: console.log, warn: console.warn, error: console.error };
  console.log = (...args: unknown[]) => calls.push({ method: "log", args });
  console.warn = (...args: unknown[]) => calls.push({ method: "warn", args });
  console.error = (...args: unknown[]) => calls.push({ method: "error", args });
  return {
    calls,
    restore() {
      console.log = original.log;
      console.warn = original.warn;
      console.error = original.error;
    },
  };
}

/** The first console arg as a string, or "" when absent or non-string. */
function lineOf(call: ConsoleCall | undefined): string {
  const first = call?.args[0];
  return typeof first === "string" ? first : "";
}

let captured: Captured | undefined;

afterEach(() => {
  captured?.restore();
  captured = undefined;
});

describe("consoleLogger", () => {
  test("writes an info line with console.log", () => {
    captured = captureConsole();
    consoleLogger({ method: "GET", pattern: "/x", path: "/x", status: 200, durationMs: 2 });
    expect(captured.calls).toHaveLength(1);
    const call = captured.calls[0];
    expect(call?.method).toBe("log");
    expect(call?.args[0]).toBe("GET 200 2.0ms /x");
  });

  test("writes a warn line with console.warn for a 4xx", () => {
    captured = captureConsole();
    consoleLogger({ method: "GET", pattern: "/x", path: "/x", status: 404, durationMs: 2 });
    expect(captured.calls[0]?.method).toBe("warn");
  });

  test("writes an error line with the error appended for a thrown error", () => {
    captured = captureConsole();
    const error = new Error("boom");
    consoleLogger({ method: "GET", pattern: "/x", path: "/x", status: 500, durationMs: 2, error });
    const call = captured.calls[0];
    expect(call?.method).toBe("error");
    expect(call?.args[1]).toBe(error);
  });

  test("error line passes an empty string when there is no error object", () => {
    captured = captureConsole();
    consoleLogger({ method: "GET", pattern: "/x", path: "/x", status: 500, durationMs: 2 });
    const call = captured.calls[0];
    expect(call?.method).toBe("error");
    expect(call?.args[1]).toBe("");
  });
});

describe("jsonLogger", () => {
  test("emits a structured JSON line at info level via console.log", () => {
    captured = captureConsole();
    jsonLogger()({ method: "GET", pattern: "/x", path: "/x", status: 200, durationMs: 3.14 });
    const call = captured.calls[0];
    expect(call?.method).toBe("log");
    const parsed = JSON.parse(lineOf(call));
    expect(parsed.level).toBe("info");
    expect(parsed.message).toBe("request");
    expect(parsed.http.method).toBe("GET");
    expect(parsed.http.status_code).toBe(200);
  });

  test("uses a custom message and routes 4xx to console.warn", () => {
    captured = captureConsole();
    jsonLogger("custom")({ method: "GET", pattern: "/x", path: "/x", status: 403, durationMs: 1 });
    const call = captured.calls[0];
    expect(call?.method).toBe("warn");
    expect(JSON.parse(lineOf(call)).message).toBe("custom");
  });

  test("routes errors to console.error", () => {
    captured = captureConsole();
    jsonLogger()({
      method: "GET",
      pattern: "/x",
      path: "/x",
      status: 500,
      durationMs: 1,
      error: new Error("nope"),
    });
    const call = captured.calls[0];
    expect(call?.method).toBe("error");
    expect(JSON.parse(lineOf(call)).error).toContain("nope");
  });
});

describe("toJsonRecord edge values", () => {
  test("omits code_context, network, and error when none are present", () => {
    const record = toJsonRecord(
      { method: "GET", pattern: "/x", path: "/x", status: 200, durationMs: 1 },
      "request",
    );
    expect(record.code_context).toBeUndefined();
    expect(record.network).toBeUndefined();
    expect(record.error).toBeUndefined();
    expect(record.http.route).toBeUndefined();
  });

  test("includes the route when the pattern differs from the path", () => {
    const record = toJsonRecord(
      { method: "GET", pattern: "/users/:id", path: "/users/7", status: 200, durationMs: 1 },
      "request",
    );
    expect(record.http.route).toBe("/users/:id");
  });

  test("serializes an Error to its stack or message", () => {
    const record = toJsonRecord(
      {
        method: "GET",
        pattern: "/x",
        path: "/x",
        status: 500,
        durationMs: 1,
        error: new Error("boom"),
      },
      "request",
    );
    expect(record.error).toContain("boom");
  });

  test("serializes a non-Error value as JSON", () => {
    const record = toJsonRecord(
      {
        method: "GET",
        pattern: "/x",
        path: "/x",
        status: 500,
        durationMs: 1,
        error: { reason: "denied", retry: false },
      },
      "request",
    );
    expect(record.error).toBe('{"reason":"denied","retry":false}');
  });

  test("falls back to String() when an error value cannot be JSON-serialized", () => {
    const circular: { self?: unknown } = {};
    circular.self = circular;
    const record = toJsonRecord(
      { method: "GET", pattern: "/x", path: "/x", status: 500, durationMs: 1, error: circular },
      "request",
    );
    expect(typeof record.error).toBe("string");
    expect(record.error).toContain("object");
  });

  test("includes a partial code_context when only the source is known", () => {
    const record = toJsonRecord(
      {
        method: "GET",
        pattern: "/x",
        path: "/x",
        status: 200,
        durationMs: 1,
        source: "file.ts:1:1",
      },
      "request",
    );
    expect(record.code_context).toEqual({
      controller: undefined,
      handler: undefined,
      source: "file.ts:1:1",
    });
  });
});
