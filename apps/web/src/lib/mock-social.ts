import type { Comment, Review } from "@brika/registry-contract";
import { hashString } from "../components/clay/gradients";

/**
 * Mock reviews and discussion. The social layer (reviews/comments) lives in D1,
 * which isn't provisioned in the demo, so these deterministic fallbacks let the
 * plugin page render its Reviews distribution and threaded Discussion. The real
 * `/v1` data takes over whenever the API returns anything. Delete with `demo.ts`
 * once D1 is wired in.
 */

const REVIEWERS = [
  { id: "jordan-mei", login: "jmei", name: "Jordan Mei" },
  { id: "reza-pourat", login: "rpourat", name: "Reza Pourat" },
  { id: "ava-lin", login: "avalin", name: "Ava Lin" },
  { id: "devon-okafor", login: "devon", name: "Devon Okafor" },
  { id: "mira-sato", login: "miras", name: "Mira Sato" },
];

const REVIEW_COPY: { rating: number; title: string; body: string; helpful: number }[] = [
  {
    rating: 5,
    title: "Saved us a week",
    body: "Dropped it into our hub and had a working flow the same afternoon. Theming just worked.",
    helpful: 24,
  },
  {
    rating: 5,
    title: "Exactly what we needed",
    body: "Out-of-the-box behaviour is the detail I didn't know I needed, and the docs are excellent too.",
    helpful: 11,
  },
  {
    rating: 4,
    title: "Rock solid",
    body: "Running it in production for a month with zero issues. The capabilities are well thought out.",
    helpful: 6,
  },
  {
    rating: 5,
    title: "Great DX",
    body: "Clean API, sensible defaults, and it respects the hub's design tokens. Highly recommend.",
    helpful: 3,
  },
];

const DATES = [
  "2026-06-09T10:00:00.000Z",
  "2026-05-22T14:30:00.000Z",
  "2026-04-30T09:15:00.000Z",
  "2026-03-12T18:45:00.000Z",
];

function pick<T>(list: T[], seed: number): T {
  return list[seed % list.length] as T;
}

export function mockReviews(name: string): Review[] {
  const h = hashString(name);
  const count = 3 + (h % 2); // 3 or 4
  return Array.from({ length: count }, (_, index) => {
    const copy = pick(REVIEW_COPY, h + index);
    const reviewer = pick(REVIEWERS, h + index * 3);
    return {
      id: `${name}-r${index}`,
      pluginName: name,
      author: reviewer,
      rating: copy.rating,
      title: copy.title,
      body: copy.body,
      helpfulCount: copy.helpful,
      createdAt: pick(DATES, h + index),
      edited: false,
    } satisfies Review;
  });
}

export function mockComments(name: string): Comment[] {
  const h = hashString(name);
  const asker = pick(REVIEWERS, h + 1);
  const replier = pick(REVIEWERS, h + 4);
  const root = `${name}-c0`;
  return [
    {
      id: root,
      pluginName: name,
      parentId: null,
      author: asker,
      body: "Does this support multiple instances per hub, or just a single configured one?",
      createdAt: DATES[0] as string,
      edited: false,
      deleted: false,
    },
    {
      id: `${name}-c0-reply`,
      pluginName: name,
      parentId: root,
      author: { id: "brika-team", login: "brika", name: "BRIKA Team" },
      body: "Multiple instances are fully supported, each is configured and managed independently. 👍",
      createdAt: DATES[1] as string,
      edited: false,
      deleted: false,
    },
    {
      id: `${name}-c1`,
      pluginName: name,
      parentId: null,
      author: replier,
      body: "Migrated from a hand-rolled integration in an afternoon. The defaults alone are worth it.",
      createdAt: DATES[2] as string,
      edited: false,
      deleted: false,
    },
  ];
}
