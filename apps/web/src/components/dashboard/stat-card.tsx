import { Link } from "@tanstack/react-router";

export function StatCard({
  label,
  value,
  to,
}: Readonly<{ label: string; value: string; to?: string }>) {
  const body = (
    <>
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="font-bold font-heading text-2xl text-foreground">{value}</span>
    </>
  );
  const className = "flex flex-col gap-1 rounded-2xl border border-border bg-card px-4 py-3.5";
  if (to !== undefined) {
    return (
      <Link to={to} className={`${className} transition-colors hover:border-brand/40`}>
        {body}
      </Link>
    );
  }
  return <div className={className}>{body}</div>;
}
