import { BrikaLogo } from "@brika/clay";
import { Link } from "@tanstack/react-router";
import { Box } from "lucide-react";
import type { ReactNode } from "react";
import { GithubIcon } from "@/components/clay/icons";

type FooterLink = { label: string; to?: string; href?: string };

const COLUMNS: { title: string; links: FooterLink[] }[] = [
  {
    title: "Product",
    links: [
      { label: "Browse plugins", to: "/plugins" },
      { label: "Trending", to: "/plugins" },
      { label: "Categories" },
      { label: "Publish a plugin", to: "/dashboard" },
    ],
  },
  {
    title: "Developers",
    links: [
      { label: "Documentation" },
      { label: "API reference" },
      { label: "Registry contract" },
      { label: "Status", href: "https://status.brika.dev" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Terms of Service", to: "/legal/terms" },
      { label: "Privacy Policy", to: "/legal/privacy" },
      { label: "Licenses", to: "/legal/licenses" },
      { label: "Cookie settings", to: "/legal/cookies" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-border border-t bg-muted/40">
      <div className="mx-auto max-w-7xl px-6 pt-9 pb-6">
        <div className="grid gap-x-8 gap-y-7 sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr_1fr]">
          <div className="flex max-w-xs flex-col gap-3">
            <div className="flex items-center gap-2">
              <BrikaLogo className="h-6 w-auto" />
              <span className="font-bold font-heading tracking-tight">Brika Store</span>
            </div>
            <p className="text-muted-foreground text-sm leading-relaxed">
              The marketplace for Brika plugins. A fast, searchable home for every Brika plugin.
            </p>
            <div className="mt-0.5 flex gap-2">
              <FooterSocial href="https://github.com/brikalabs" label="GitHub">
                <GithubIcon className="size-4" />
              </FooterSocial>
              <FooterSocial href="https://www.npmjs.com/search?q=keywords:brika" label="npm">
                <Box className="size-4" />
              </FooterSocial>
            </div>
          </div>

          {COLUMNS.map((column) => (
            <div key={column.title} className="flex flex-col gap-2.5">
              <div className="font-semibold text-muted-foreground text-xs uppercase tracking-[0.05em]">
                {column.title}
              </div>
              {column.links.map((link) => (
                <FooterItem key={link.label} link={link} />
              ))}
            </div>
          ))}
        </div>

        <div className="mt-7 flex flex-wrap items-center justify-between gap-2.5 border-border border-t pt-5 text-muted-foreground text-xs">
          <span>© 2026 Brika</span>
          <span className="font-mono">store.brika.dev</span>
        </div>
      </div>
    </footer>
  );
}

function FooterItem({ link }: Readonly<{ link: FooterLink }>) {
  const className = "w-fit text-foreground/80 text-sm transition-colors hover:text-brand-ink";
  if (link.to) {
    return (
      <Link to={link.to} className={className}>
        {link.label}
      </Link>
    );
  }
  if (link.href) {
    return (
      <a href={link.href} target="_blank" rel="noreferrer" className={className}>
        {link.label}
      </a>
    );
  }
  return <span className="w-fit text-foreground/60 text-sm">{link.label}</span>;
}

function FooterSocial({
  href,
  label,
  children,
}: Readonly<{ href: string; label: string; children: ReactNode }>) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      title={label}
      aria-label={label}
      className="inline-flex size-8 items-center justify-center rounded-lg border border-border bg-card text-foreground transition-colors hover:bg-muted"
    >
      {children}
    </a>
  );
}
