import { Link } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Long-form legal/policy page with a sticky table of contents. Title, last-updated line, and
 * draft disclaimer are parsed out of the policy markdown so chrome and prose never drift.
 */

export type LegalSlug = "terms" | "privacy" | "licenses" | "cookies" | "acceptable-use";

const TABS: { slug: LegalSlug; label: string; to: string }[] = [
  { slug: "terms", label: "Terms", to: "/legal/terms" },
  { slug: "privacy", label: "Privacy", to: "/legal/privacy" },
  { slug: "licenses", label: "Licenses", to: "/legal/licenses" },
  { slug: "cookies", label: "Cookies", to: "/legal/cookies" },
];

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function textOf(children: ReactNode): string {
  if (typeof children === "string") return children;
  if (Array.isArray(children)) return children.map(textOf).join("");
  return "";
}

function stripInlineMarkdown(text: string): string {
  return text
    .replaceAll("**", "")
    .replace(/\[([^[\]]+)\]\(([^()]*)\)/g, "$1")
    .replaceAll("`", "");
}

interface ParsedDoc {
  readonly title: string;
  readonly lastUpdated: string;
  readonly disclaimer: string;
  readonly body: string;
}

function parseLegalDoc(markdown: string): ParsedDoc {
  let title = "";
  let lastUpdated = "";
  const disclaimer: string[] = [];
  const body: string[] = [];
  for (const line of markdown.split("\n")) {
    const heading = /^#\s+(\S.*)$/.exec(line);
    if (heading?.[1] && !title) {
      title = heading[1].trim();
      continue;
    }
    const updated = /^\*\*Last updated:\*\*\s*(\S.*)$/.exec(line);
    if (updated?.[1]) {
      lastUpdated = updated[1].trim();
      continue;
    }
    if (line.startsWith(">")) {
      disclaimer.push(line.replace(/^>\s?/, ""));
      continue;
    }
    body.push(line);
  }
  return {
    title,
    lastUpdated,
    disclaimer: stripInlineMarkdown(disclaimer.join(" ")).trim(),
    body: body.join("\n").trim(),
  };
}

function tableOfContents(body: string): { id: string; text: string }[] {
  const items: { id: string; text: string }[] = [];
  for (const line of body.split("\n")) {
    const heading = /^##\s+(\S.*)$/.exec(line);
    if (heading?.[1]) {
      const text = heading[1].trim();
      items.push({ id: slugify(text), text });
    }
  }
  return items;
}

function formatDate(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}

/** Highlight the table-of-contents entry for the section nearest the top. */
function useActiveHeading(idsKey: string): string {
  const [active, setActive] = useState("");
  useEffect(() => {
    const ids = idsKey ? idsKey.split("|") : [];
    if (ids.length === 0) return;
    setActive((prev) => prev || ids[0] || "");
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        const top = visible[0]?.target.id;
        if (top) setActive(top);
      },
      { rootMargin: "-96px 0px -66% 0px" },
    );
    for (const id of ids) {
      const element = document.getElementById(id);
      if (element) observer.observe(element);
    }
    return () => observer.disconnect();
  }, [idsKey]);
  return active;
}

const COMPONENTS: Components = {
  h2: ({ children }) => (
    <h2
      id={slugify(textOf(children))}
      className="mt-9 mb-2 scroll-mt-24 font-heading font-semibold text-[18px] text-foreground first:mt-0"
    >
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-5 mb-1.5 font-heading font-semibold text-[15px] text-foreground">
      {children}
    </h3>
  ),
  p: ({ children }) => (
    <p className="my-3 text-[14.5px] text-foreground/80 leading-[1.7] first:mt-0">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="my-3 list-disc space-y-1.5 pl-5 text-[14.5px] text-foreground/80 leading-[1.7] marker:text-muted-foreground">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="my-3 list-decimal space-y-1.5 pl-5 text-[14.5px] text-foreground/80 leading-[1.7] marker:text-muted-foreground">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="pl-1">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  code: ({ children }) => (
    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[12.5px] text-foreground">
      {children}
    </code>
  ),
  a: ({ href, children }) => {
    const url = href ?? "#";
    const external = url.startsWith("http");
    return (
      <a
        href={url}
        {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
        className="font-medium text-brand-ink underline-offset-2 hover:underline"
      >
        {children}
      </a>
    );
  },
  table: ({ children }) => (
    <div className="my-4 overflow-x-auto">
      <table className="w-full border-collapse text-[13px]">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border border-border bg-muted/50 px-3 py-2 text-left font-semibold text-foreground">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border border-border px-3 py-2 text-foreground/80">{children}</td>
  ),
  hr: () => <hr className="my-6 border-border" />,
};

export function LegalPage({ slug, content }: Readonly<{ slug: LegalSlug; content: string }>) {
  const { title, lastUpdated, disclaimer, body } = parseLegalDoc(content);
  const toc = tableOfContents(body);
  const active = useActiveHeading(toc.map((item) => item.id).join("|"));

  return (
    <main className="mx-auto max-w-[1000px] px-6 pt-9 pb-16 sm:px-7">
      <div className="flex flex-col gap-2.5">
        <span className="self-start rounded-full border border-brand/30 bg-brand/10 px-2.5 py-1 font-mono font-semibold text-brand-ink text-xs uppercase tracking-[0.05em]">
          Legal
        </span>
        <h1 className="font-bold font-heading text-[32px] text-foreground tracking-[-0.025em] sm:text-[34px]">
          {title}
        </h1>
        <p className="text-muted-foreground text-sm">
          {lastUpdated ? `Last updated ${formatDate(lastUpdated)} · Draft` : "Draft"}
        </p>
      </div>

      <nav className="mt-5 flex items-center gap-6 border-border border-b text-sm">
        {TABS.map((tab) => {
          const isActive = tab.slug === slug;
          return (
            <Link
              key={tab.slug}
              to={tab.to}
              className={`-mb-px border-b-2 py-2.5 transition-colors ${
                isActive
                  ? "border-brand font-semibold text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-7 grid items-start gap-9 lg:grid-cols-[218px_1fr]">
        {toc.length > 0 ? (
          <aside className="sticky top-24 hidden flex-col gap-0.5 lg:flex">
            <div className="pb-2 font-semibold text-[11.5px] text-muted-foreground uppercase tracking-[0.05em]">
              On this page
            </div>
            {toc.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className={`border-l-2 py-1.5 pl-3 text-[13px] transition-colors ${
                  active === item.id
                    ? "border-brand font-semibold text-brand-ink"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {item.text}
              </a>
            ))}
          </aside>
        ) : null}

        <div className="min-w-0">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={COMPONENTS}>
            {body}
          </ReactMarkdown>

          {disclaimer ? (
            <div className="mt-8 flex items-center gap-2.5 rounded-xl border border-border bg-muted/40 px-4 py-3.5 text-[13px] text-muted-foreground">
              <ShieldCheck className="size-4 shrink-0 text-brand-ink" />
              <span>{disclaimer}</span>
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}
