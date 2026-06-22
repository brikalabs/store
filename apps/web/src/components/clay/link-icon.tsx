import { Globe } from "lucide-react";
import type { ComponentType, SVGProps } from "react";
import { FacebookIcon, GithubIcon, LinkedInIcon, NpmIcon, XIcon, YouTubeIcon } from "./icons";

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

// Hostname suffix -> brand glyph, matched so `www.` and any subdomain still resolve.
const BY_HOST: ReadonlyArray<readonly [string, IconComponent]> = [
  ["github.com", GithubIcon],
  ["x.com", XIcon],
  ["twitter.com", XIcon],
  ["linkedin.com", LinkedInIcon],
  ["npmjs.com", NpmIcon],
  ["facebook.com", FacebookIcon],
  ["youtube.com", YouTubeIcon],
  ["youtu.be", YouTubeIcon],
];

/** Pick a brand glyph for a link's URL by its hostname; falls back to a generic globe. */
export function iconForUrl(url: string): IconComponent {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return Globe;
  }
  for (const [suffix, Icon] of BY_HOST) {
    if (host === suffix || host.endsWith(`.${suffix}`)) return Icon;
  }
  return Globe;
}

/** Renders the inferred brand icon for a link URL. */
export function LinkIcon({
  url,
  className = "size-4",
}: Readonly<{ url: string; className?: string }>) {
  const Icon = iconForUrl(url);
  return <Icon className={className} />;
}
