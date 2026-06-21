import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Box, Check, Copy, Rocket, ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { AdminShell } from "@/components/layout/admin-shell";
import { useMyPlugins } from "@/hooks/use-my-plugins";
import { formatCount } from "@/lib/format";
import { fetchIsOperator } from "@/server/require-operator";

export const Route = createFileRoute("/dashboard/")({
  component: OverviewPage,
});

const WORKFLOW = `name: Publish plugin
on:
  release:
    types: [published]
permissions:
  contents: read
  id-token: write # Brika trusted publishing (tokenless OIDC)
jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install --frozen-lockfile
      - run: bunx @brika/cli check --types
      - run: bunx @brika/cli publish`;

function OverviewPage() {
  const { user } = Route.useRouteContext();
  const plugins = useMyPlugins();

  const weekly = plugins.reduce((sum, p) => sum + p.downloadsWeekly, 0);
  const rated = plugins.filter((p) => p.rating);
  const avgRating =
    rated.length > 0
      ? rated.reduce((sum, p) => sum + (p.rating?.average ?? 0), 0) / rated.length
      : 0;
  const verified = plugins.filter((p) => p.verified).length;

  return (
    <AdminShell id={user.id} name={user.name} activeLabel="Overview">
      <section className="flex flex-col gap-6">
        <div>
          <h1 className="font-bold font-heading text-2xl tracking-tight">Overview</h1>
          <p className="mt-1 text-muted-foreground text-sm">
            Welcome back, {user.name ?? "there"}. Here's how your plugins are doing.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
          <StatCard label="Total plugins" value={String(plugins.length)} to="/dashboard/plugins" />
          <StatCard label="Weekly downloads" value={weekly > 0 ? formatCount(weekly) : "·"} />
          <StatCard label="Avg rating" value={avgRating > 0 ? avgRating.toFixed(1) : "·"} />
          <StatCard label="Verified" value={String(verified)} />
        </div>

        <Link
          to="/dashboard/plugins"
          className="inline-flex w-fit items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 font-semibold text-foreground text-sm transition-colors hover:bg-muted"
        >
          <Box className="size-4 text-brand-ink" />
          Manage my plugins
        </Link>

        <OperatorConsoleLink />
      </section>

      <PublishCard />
    </AdminShell>
  );
}

/**
 * A link into the operator console, rendered only for registry operators. Operator status
 * comes from a server function (the allowlist is server-only), so this resolves it after
 * mount and renders nothing for everyone else - the console's existence stays hidden.
 */
function OperatorConsoleLink() {
  const [operator, setOperator] = useState(false);
  useEffect(() => {
    fetchIsOperator()
      .then(setOperator)
      .catch(() => setOperator(false));
  }, []);
  if (!operator) return null;
  return (
    <Link
      to="/operator/scopes"
      className="inline-flex w-fit items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/5 px-4 py-2.5 font-semibold text-foreground text-sm transition-colors hover:bg-amber-500/10"
    >
      <ShieldAlert className="size-4 text-amber-600" />
      Operator console
    </Link>
  );
}

function StatCard({ label, value, to }: Readonly<{ label: string; value: string; to?: string }>) {
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

function PublishCard() {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(WORKFLOW);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6">
      <h2 className="flex items-center gap-2 font-bold font-heading text-xl tracking-tight">
        <Rocket className="size-5 text-brand-ink" />
        Publish from GitHub
      </h2>
      <ol className="flex list-decimal flex-col gap-2 pl-5 text-muted-foreground text-sm">
        <li>Push your plugin to a GitHub repository.</li>
        <li>
          On your scope, add a{" "}
          <span className="font-medium text-foreground">trusted publisher</span>, linked to that
          repo and workflow (tokenless OIDC). Plugins publish to Brika, never npm.
        </li>
        <li>Add the workflow below as `.github/workflows/publish.yml`.</li>
        <li>
          Cut a GitHub release. It publishes to the Brika store with provenance, and the listing
          updates automatically.
        </li>
      </ol>
      <div className="relative">
        <pre className="overflow-auto rounded-xl border border-border bg-muted/50 p-4 font-mono text-xs">
          {WORKFLOW}
        </pre>
        <button
          type="button"
          onClick={copy}
          aria-label="Copy workflow"
          className="absolute top-2 right-2 rounded-md border border-border bg-card p-1.5 text-muted-foreground hover:text-foreground"
        >
          {copied ? <Check className="size-4 text-brand-ink" /> : <Copy className="size-4" />}
        </button>
      </div>
      <p className="text-muted-foreground text-xs">
        Other CI (GitLab, etc.)? The same{" "}
        <span className="font-mono text-foreground">@brika/cli</span> publishes anywhere, set a{" "}
        <span className="font-mono text-foreground">BRIKA_TOKEN</span> secret instead of using OIDC.
      </p>
      <Link
        to="/dashboard/scopes"
        className="inline-flex w-fit items-center gap-1 text-brand-ink text-sm hover:underline"
      >
        Manage trusted publishers
        <ArrowRight className="size-3.5" />
      </Link>
    </div>
  );
}
