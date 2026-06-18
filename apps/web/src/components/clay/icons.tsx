import type { SVGProps } from "react";

/**
 * GitHub mark in the lucide visual language (sized via `className`, e.g.
 * `size-4`). lucide-react dropped brand glyphs, so the store ships its own.
 */
export function GithubIcon({ className = "size-4", ...props }: Readonly<SVGProps<SVGSVGElement>>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <path d="M9 19c-4 1.4-4-2.4-6-3m12 5v-3.4c0-1 .1-1.4-.5-2 2.8-.3 5.6-1.4 5.6-6a4.7 4.7 0 0 0-1.3-3.2 4.3 4.3 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12 12 0 0 0-6 0C6.6 2.3 5.5 2.6 5.5 2.6a4.3 4.3 0 0 0-.1 3.2A4.7 4.7 0 0 0 4 9c0 4.6 2.8 5.7 5.6 6-.6.6-.6 1.2-.5 2V21" />
    </svg>
  );
}

/** X (formerly Twitter) mark, sized via `className`. */
export function XIcon({ className = "size-4", ...props }: Readonly<SVGProps<SVGSVGElement>>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}
