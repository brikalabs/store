import { expect, test } from "bun:test";
import { emptyPage, hasMore, paginate } from "./pagination";

const ALL = [1, 2, 3, 4, 5];

test("paginate slices the window and reports the full total", () => {
  expect(paginate(ALL, { limit: 2, offset: 0 })).toEqual({
    items: [1, 2],
    total: 5,
    limit: 2,
    offset: 0,
  });
  expect(paginate(ALL, { limit: 2, offset: 4 }).items).toEqual([5]);
  expect(paginate(ALL, { limit: 2, offset: 10 }).items).toEqual([]);
});

test("hasMore is true until the window reaches the total", () => {
  expect(hasMore(paginate(ALL, { limit: 2, offset: 0 }))).toBe(true);
  expect(hasMore(paginate(ALL, { limit: 2, offset: 4 }))).toBe(false);
  expect(hasMore(paginate(ALL, { limit: 10, offset: 0 }))).toBe(false);
});

test("emptyPage carries the window with no items", () => {
  expect(emptyPage({ limit: 20, offset: 40 })).toEqual({
    items: [],
    total: 0,
    limit: 20,
    offset: 40,
  });
});
