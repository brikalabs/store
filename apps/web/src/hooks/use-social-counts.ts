import { useEffect, useState } from "react";

/** Live review/comment counts for the tab badges, fetched client-side; zero until loaded. */
export function useSocialCounts(name: string | undefined): { reviews: number; comments: number } {
  const [apiReviews, setApiReviews] = useState(0);
  const [apiComments, setApiComments] = useState(0);
  useEffect(() => {
    if (name === undefined) return;
    const enc = encodeURIComponent(name);
    const grab = (path: string, set: (n: number) => void) =>
      fetch(`/v1/plugins/${enc}/${path}`)
        .then((res) => res.json())
        .then((json: unknown) => {
          if (Array.isArray(json)) set(json.length);
        })
        .catch(() => undefined);
    grab("reviews", setApiReviews);
    grab("comments", setApiComments);
  }, [name]);
  return { reviews: apiReviews, comments: apiComments };
}
