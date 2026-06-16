import { describe, expect, test } from "bun:test";
import { DOWNLOAD_WINDOW_DAYS, epochDay, summarizeDownloads, ZERO_DOWNLOADS } from "./downloads";

describe("epochDay", () => {
  test("floors milliseconds to a UTC day number", () => {
    expect(epochDay(0)).toBe(0);
    expect(epochDay(86_400_000 - 1)).toBe(0);
    expect(epochDay(86_400_000)).toBe(1);
    expect(epochDay(86_400_000 * 19_500 + 123)).toBe(19_500);
  });
});

describe("summarizeDownloads", () => {
  const today = 100;

  test("sums all days for total and the trailing window for weekly", () => {
    const rows = [
      { day: today, count: 5 },
      { day: today - 1, count: 3 },
      { day: today - (DOWNLOAD_WINDOW_DAYS - 1), count: 2 }, // oldest day still in window
      { day: today - DOWNLOAD_WINDOW_DAYS, count: 10 }, // just outside the window
      { day: today - 40, count: 100 },
    ];
    expect(summarizeDownloads(rows, today)).toEqual({ total: 120, weekly: 10 });
  });

  test("is zero for no rows", () => {
    expect(summarizeDownloads([], today)).toEqual({ total: 0, weekly: 0 });
  });

  test("counts today only within both totals", () => {
    expect(summarizeDownloads([{ day: today, count: 7 }], today)).toEqual({ total: 7, weekly: 7 });
  });
});

test("ZERO_DOWNLOADS is the empty summary", () => {
  expect(ZERO_DOWNLOADS).toEqual({ total: 0, weekly: 0 });
});
