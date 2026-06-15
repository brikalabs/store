import { describe, expect, test } from "bun:test";
import { browserCommand } from "./browser";

const URL = "https://store.brika.dev/device?code=ABCD-1234";

describe("browserCommand", () => {
  test("uses the platform launcher when $BROWSER is unset", () => {
    expect(browserCommand(URL, "darwin", undefined)).toEqual(["open", URL]);
    expect(browserCommand(URL, "linux", undefined)).toEqual(["xdg-open", URL]);
    expect(browserCommand(URL, "win32", undefined)).toEqual(["cmd", "/c", "start", "", URL]);
  });

  test("honors $BROWSER as the opener", () => {
    expect(browserCommand(URL, "linux", "firefox")).toEqual(["firefox", URL]);
  });

  test("disables auto-open for a headless $BROWSER", () => {
    expect(browserCommand(URL, "linux", "none")).toBeUndefined();
    expect(browserCommand(URL, "linux", "  ")).toBeUndefined();
  });
});
