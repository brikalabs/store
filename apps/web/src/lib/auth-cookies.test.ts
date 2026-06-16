import { describe, expect, test } from "bun:test";
import { parseCookies, safeReturnPath } from "./auth-cookies";

describe("safeReturnPath (open-redirect guard)", () => {
  test("keeps a same-site path unchanged", () => {
    expect(safeReturnPath("/")).toBe("/");
    expect(safeReturnPath("/dashboard")).toBe("/dashboard");
    expect(safeReturnPath("/device?code=BCDF-GHJK")).toBe("/device?code=BCDF-GHJK");
    expect(safeReturnPath("/a/b/c#frag")).toBe("/a/b/c#frag");
  });

  test("rejects absolute URLs", () => {
    expect(safeReturnPath("https://evil.example")).toBe("/");
    expect(safeReturnPath("http://evil.example/login")).toBe("/");
  });

  test("rejects protocol-relative `//host` (the classic open-redirect)", () => {
    expect(safeReturnPath("//evil.example")).toBe("/");
    expect(safeReturnPath("//evil.example/login")).toBe("/");
  });

  test("rejects non-path, scheme, and empty/missing input", () => {
    expect(safeReturnPath("dashboard")).toBe("/");
    expect(safeReturnPath("javascript:alert(1)")).toBe("/");
    expect(safeReturnPath("")).toBe("/");
    expect(safeReturnPath(null)).toBe("/");
    expect(safeReturnPath(undefined)).toBe("/");
  });
});

describe("parseCookies", () => {
  test("parses name=value pairs, trimming whitespace and percent-decoding", () => {
    expect(parseCookies("a=1; b=2")).toEqual({ a: "1", b: "2" });
    expect(parseCookies("brika_session=abc.def")).toEqual({ brika_session: "abc.def" });
    expect(parseCookies("x=%2Ffoo%2Fbar")).toEqual({ x: "/foo/bar" });
  });

  test("returns an empty map for a missing header", () => {
    expect(parseCookies(null)).toEqual({});
  });

  test("skips segments without `=` and empty keys", () => {
    expect(parseCookies("garbage; a=1")).toEqual({ a: "1" });
    expect(parseCookies("=novalue; a=1")).toEqual({ a: "1" });
  });

  test("does not throw on malformed percent-encoding, keeps the raw value", () => {
    expect(parseCookies("x=%")).toEqual({ x: "%" });
    expect(parseCookies("x=%E0%A4%A; ok=1")).toEqual({ x: "%E0%A4%A", ok: "1" });
  });
});
