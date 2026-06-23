import type { SVGProps } from "react";

/** GitHub mark in the lucide visual language (lucide-react dropped brand glyphs). */
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

/** A filled-mark brand icon (24x24, `currentColor`), sized via `className`. */
function BrandMark({
  d,
  className = "size-4",
  ...props
}: Readonly<SVGProps<SVGSVGElement> & { d: string }>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <path d={d} />
    </svg>
  );
}

/** GitLab tanuki mark, sized via `className`. */
export function GitlabIcon(props: Readonly<SVGProps<SVGSVGElement>>) {
  return (
    <BrandMark
      d="M23.955 13.587l-1.342-4.135-2.664-8.189a.455.455 0 0 0-.867 0L16.418 9.45H7.582L4.918 1.263a.455.455 0 0 0-.867 0L1.386 9.452.044 13.587a.924.924 0 0 0 .331 1.023L12 23.054l11.625-8.443a.924.924 0 0 0 .33-1.024"
      {...props}
    />
  );
}

/** X (formerly Twitter) mark, sized via `className`. */
export function XIcon(props: Readonly<SVGProps<SVGSVGElement>>) {
  return (
    <BrandMark
      d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"
      {...props}
    />
  );
}

/** LinkedIn mark. */
export function LinkedInIcon(props: Readonly<SVGProps<SVGSVGElement>>) {
  return (
    <BrandMark
      d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3 9h4v12H3zM9 9h3.8v1.7h.05c.53-1 1.83-2.05 3.77-2.05 4.03 0 4.78 2.65 4.78 6.1V21h-4v-5.3c0-1.26-.02-2.9-1.77-2.9-1.77 0-2.04 1.38-2.04 2.8V21H9z"
      {...props}
    />
  );
}

/** npm mark. */
export function NpmIcon(props: Readonly<SVGProps<SVGSVGElement>>) {
  return (
    <BrandMark
      d="M1.763 0C.786 0 0 .786 0 1.763v20.474C0 23.214.786 24 1.763 24h20.474c.977 0 1.763-.786 1.763-1.763V1.763C24 .786 23.214 0 22.237 0H1.763zm3.367 5.323h13.741v13.087h-3.43V8.738h-3.44v9.672H5.13z"
      {...props}
    />
  );
}

/** Facebook mark. */
export function FacebookIcon(props: Readonly<SVGProps<SVGSVGElement>>) {
  return (
    <BrandMark
      d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.69.24 2.69.24v2.97h-1.52c-1.49 0-1.96.93-1.96 1.89v2.25h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07z"
      {...props}
    />
  );
}

/** YouTube mark. */
export function YouTubeIcon(props: Readonly<SVGProps<SVGSVGElement>>) {
  return (
    <BrandMark
      d="M23.5 6.5a3 3 0 0 0-2.1-2.1C19.5 4 12 4 12 4s-7.5 0-9.4.4A3 3 0 0 0 .5 6.5 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.5 3 3 0 0 0 2.1 2.1C4.5 20 12 20 12 20s7.5 0 9.4-.4a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.5zM9.6 15.6V8.4l6.2 3.6z"
      {...props}
    />
  );
}
