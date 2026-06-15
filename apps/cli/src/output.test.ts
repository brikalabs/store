import { expect, test } from "bun:test";
import { formatBytes } from "./output";

test("formatBytes scales units", () => {
  expect(formatBytes(0)).toBe("0 B");
  expect(formatBytes(512)).toBe("512 B");
  expect(formatBytes(1024)).toBe("1.0 KiB");
  expect(formatBytes(1536)).toBe("1.5 KiB");
  expect(formatBytes(1024 * 1024)).toBe("1.0 MiB");
});
