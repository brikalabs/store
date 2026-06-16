import { describe, expect, test } from "bun:test";
import {
  badRequest,
  conflict,
  forbidden,
  HttpError,
  httpError,
  notFound,
  unauthorized,
} from "./errors";

describe("HttpError", () => {
  test("carries a status and a body, with an optional code", () => {
    const error = new HttpError(418, "teapot", "short_and_stout");
    expect(error.status).toBe(418);
    expect(error.body).toEqual({ error: "teapot", code: "short_and_stout" });
  });

  test("omits code from the body when absent", () => {
    expect(unauthorized().body).toEqual({ error: "Unauthorized" });
  });

  test("helpers map to their statuses", () => {
    expect(badRequest().status).toBe(400);
    expect(unauthorized().status).toBe(401);
    expect(forbidden().status).toBe(403);
    expect(notFound().status).toBe(404);
    expect(conflict().status).toBe(409);
    expect(httpError(413, "too large").status).toBe(413);
  });
});
