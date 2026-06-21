import { LinkIcon } from "@/components/clay/link-icon";

/**
 * A row of labelled external-link pills, shared by the scope page and the user
 * profile page (`/u/:id`). Each link's icon is inferred from its URL. Renders
 * nothing when there are no links.
 */
export function ProfileLinks({
  links,
}: Readonly<{ links: readonly { label: string; url: string }[] }>) {
  if (links.length === 0) return null;
  return (
    <ul className="mt-3.5 flex flex-wrap items-center gap-2">
      {links.map((link) => (
        <li key={`${link.label}:${link.url}`}>
          <a
            href={link.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 font-medium text-foreground text-sm transition-colors hover:bg-muted"
          >
            <LinkIcon url={link.url} className="size-4 text-muted-foreground" />
            {link.label}
          </a>
        </li>
      ))}
    </ul>
  );
}
