import { Link } from "@tanstack/react-router";
import { ArrowRight, Check, Copy, Rocket } from "lucide-react";
import { useState } from "react";

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

export function PublishCard() {
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
