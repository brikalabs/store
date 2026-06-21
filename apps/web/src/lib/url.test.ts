import { describe, expect, test } from "bun:test";
import { joinUrl } from "./url";

describe("joinUrl", () => {
  test("joins with a single slash, no duplicates, no missing separator", () => {
    expect(joinUrl("https://cdn.example.com", "user-avatars/x.webp")).toBe(
      "https://cdn.example.com/user-avatars/x.webp",
    );
    expect(joinUrl("https://cdn.example.com/", "/user-avatars/x.webp")).toBe(
      "https://cdn.example.com/user-avatars/x.webp",
    );
    expect(joinUrl("https://cdn.example.com//", "/user-avatars/", "/x.webp")).toBe(
      "https://cdn.example.com/user-avatars/x.webp",
    );
  });

  test("preserves the scheme's :// and slashes within a segment", () => {
    expect(joinUrl("https://cdn.example.com", "a/b/c.webp")).toBe(
      "https://cdn.example.com/a/b/c.webp",
    );
  });

  test("drops empty segments", () => {
    expect(joinUrl("https://cdn.example.com", "", "x.webp")).toBe("https://cdn.example.com/x.webp");
  });
});
