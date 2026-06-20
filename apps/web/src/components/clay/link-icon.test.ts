import { describe, expect, test } from "bun:test";
import { Globe } from "lucide-react";
import { FacebookIcon, GithubIcon, LinkedInIcon, NpmIcon, XIcon, YouTubeIcon } from "./icons";
import { iconForUrl } from "./link-icon";

describe("iconForUrl", () => {
  test("infers the brand icon from the hostname (incl. www/subdomains)", () => {
    expect(iconForUrl("https://github.com/brika")).toBe(GithubIcon);
    expect(iconForUrl("https://x.com/brika")).toBe(XIcon);
    expect(iconForUrl("https://twitter.com/brika")).toBe(XIcon);
    expect(iconForUrl("https://www.linkedin.com/company/brika")).toBe(LinkedInIcon);
    expect(iconForUrl("https://npmjs.com/org/brika")).toBe(NpmIcon);
    expect(iconForUrl("https://facebook.com/brika")).toBe(FacebookIcon);
    expect(iconForUrl("https://youtu.be/abc")).toBe(YouTubeIcon);
  });

  test("falls back to a globe for unknown hosts and invalid URLs", () => {
    expect(iconForUrl("https://example.com")).toBe(Globe);
    expect(iconForUrl("not a url")).toBe(Globe);
    // A look-alike host must not match by substring.
    expect(iconForUrl("https://notgithub.com")).toBe(Globe);
  });
});
