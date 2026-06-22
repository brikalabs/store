import { Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

type Action = {
  label: string;
  icon: LucideIcon;
  to?: string;
  href?: string;
  onClick?: () => void;
};

/** Full-page error state shared across 404 / 500 / 403 / 503, below the global site header. */
export function ErrorState({
  codeLabel,
  title,
  message,
  icon: Icon,
  primary,
  secondary,
  mono,
}: Readonly<{
  codeLabel: string;
  title: string;
  message: string;
  icon?: LucideIcon;
  primary: Action;
  secondary?: Action;
  mono?: string;
}>) {
  return (
    <main className="mx-auto flex min-h-[60dvh] max-w-xl flex-col items-center justify-center gap-4 px-6 py-20 text-center">
      <div className="mb-1 flex items-center gap-3.5">
        <span className="size-[50px] rounded-[15px] border border-border bg-muted" />
        <span
          className="flex size-[50px] rotate-[-7deg] items-center justify-center rounded-[15px] text-white shadow-[0_10px_20px_-8px_rgba(242,84,45,0.5)]"
          style={{ background: "linear-gradient(140deg, #FF8A5B, var(--color-brand))" }}
        >
          {Icon ? <Icon className="size-6" /> : null}
        </span>
        <span className="size-[50px] rounded-[15px] border-2 border-border border-dashed" />
        <span className="size-[50px] rounded-[15px] border border-border bg-muted" />
      </div>

      <span className="rounded-full border border-brand/30 bg-brand/10 px-3 py-1.5 font-mono font-semibold text-brand-ink text-xs tracking-[0.06em]">
        {codeLabel}
      </span>
      <h1 className="font-bold font-heading text-3xl tracking-tight">{title}</h1>
      <p className="max-w-md text-muted-foreground leading-relaxed">{message}</p>

      <div className="mt-1.5 flex flex-wrap items-center justify-center gap-3">
        <ActionButton action={primary} variant="primary" />
        {secondary ? <ActionButton action={secondary} variant="secondary" /> : null}
      </div>

      {mono ? <p className="mt-2 font-mono text-muted-foreground text-xs">{mono}</p> : null}
    </main>
  );
}

function ActionButton({
  action,
  variant,
}: Readonly<{ action: Action; variant: "primary" | "secondary" }>) {
  const className =
    variant === "primary"
      ? "inline-flex h-11 items-center gap-2 rounded-xl bg-brand px-5 font-semibold text-brand-foreground shadow-[0_8px_20px_-8px_rgba(242,84,45,0.5)] transition-opacity hover:opacity-90"
      : "inline-flex h-11 items-center gap-2 rounded-xl border border-border bg-card px-5 font-semibold text-foreground transition-colors hover:bg-muted";
  const Icon = action.icon;
  const inner: ReactNode = (
    <>
      <Icon className="size-4" />
      {action.label}
    </>
  );

  if (action.to) {
    return (
      <Link to={action.to} className={className}>
        {inner}
      </Link>
    );
  }
  if (action.href) {
    return (
      <a href={action.href} target="_blank" rel="noreferrer" className={className}>
        {inner}
      </a>
    );
  }
  return (
    <button type="button" onClick={action.onClick} className={className}>
      {inner}
    </button>
  );
}
