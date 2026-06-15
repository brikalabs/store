import { describe, expect, test } from "bun:test";
import { clipboardCommand } from "./clipboard";

describe("clipboardCommand", () => {
  test("uses the platform clipboard tool", () => {
    expect(clipboardCommand("darwin")).toEqual(["pbcopy"]);
    expect(clipboardCommand("win32")).toEqual(["clip"]);
    expect(clipboardCommand("linux")).toEqual(["xclip", "-selection", "clipboard"]);
  });
});
