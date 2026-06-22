import type { PluginDetail } from "@brika/registry-contract";
import { Lock } from "lucide-react";
import type { ReactNode } from "react";
import { type GrantFamily, type GrantScope, groupGrants } from "@/lib/social/grants";
import { familyIcon } from "./helpers";

/** A small "Sensitive" (amber) or "Standard" risk tag on a family card. */
function RiskTag({ risk }: Readonly<{ risk: GrantFamily["risk"] }>) {
  return risk === "sensitive" ? (
    <span className="inline-flex items-center rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 font-semibold text-[10px] text-amber-600 uppercase tracking-[0.04em] dark:text-amber-400">
      Sensitive
    </span>
  ) : (
    <span className="inline-flex items-center rounded-full border border-border bg-muted px-2 py-0.5 font-semibold text-[10px] text-muted-foreground uppercase tracking-[0.04em]">
      Standard
    </span>
  );
}

/** Uppercase scope sub-label (Allowed hosts / Read / Write / Operations). */
function ScopeLabel({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <span className="font-semibold text-[10px] text-muted-foreground uppercase tracking-[0.04em]">
      {children}
    </span>
  );
}

/** A mono scope value chip; wildcard hosts render dashed, like the hub does. */
function ScopeChip({ children, dashed }: Readonly<{ children: ReactNode; dashed?: boolean }>) {
  return (
    <span
      className={
        dashed
          ? "inline-flex items-center rounded-md border border-muted-foreground/50 border-dashed px-2 py-0.5 font-mono text-[11px] text-muted-foreground"
          : "inline-flex items-center rounded-md border border-border bg-muted px-2 py-0.5 font-mono text-[11px] text-foreground"
      }
    >
      {children}
    </span>
  );
}

/** A labelled row of path-pattern chips (the fs Read / Write blocks). */
function PathScope({ label, paths }: Readonly<{ label: string; paths: readonly string[] }>) {
  return (
    <div className="flex flex-col gap-1.5">
      <ScopeLabel>{label}</ScopeLabel>
      <div className="flex flex-wrap gap-1.5">
        {paths.map((path) => (
          <ScopeChip key={path}>{path}</ScopeChip>
        ))}
      </div>
    </div>
  );
}

/** Render a family's requested scope: hosts, ports, paths, ops, or raw items. */
function GrantScopeView({ scope }: Readonly<{ scope: GrantScope }>) {
  if (scope.kind === "hosts") {
    return (
      <div className="flex flex-col gap-1.5">
        <ScopeLabel>Allowed hosts</ScopeLabel>
        <div className="flex flex-wrap gap-1.5">
          {scope.hosts.map((host) => (
            <ScopeChip key={host.value} dashed={host.wildcard}>
              {host.value}
            </ScopeChip>
          ))}
        </div>
      </div>
    );
  }
  if (scope.kind === "ports") {
    return (
      <div className="flex flex-col gap-1.5">
        <ScopeLabel>Loopback ports</ScopeLabel>
        <div className="flex flex-wrap gap-1.5">
          {scope.ports.map((port) => (
            <ScopeChip key={port}>localhost:{port}</ScopeChip>
          ))}
        </div>
      </div>
    );
  }
  if (scope.kind === "paths") {
    return (
      <div className="flex flex-col gap-2.5">
        {scope.read.length > 0 ? <PathScope label="Read" paths={scope.read} /> : null}
        {scope.write.length > 0 ? <PathScope label="Write" paths={scope.write} /> : null}
      </div>
    );
  }
  if (scope.kind === "ops") {
    return (
      <div className="flex flex-col gap-1.5">
        <ScopeLabel>Operations</ScopeLabel>
        <div className="flex flex-wrap gap-1.5">
          {scope.ops.map((op) => (
            <span
              key={op}
              className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 font-medium text-[11px] text-foreground capitalize"
            >
              {op}
            </span>
          ))}
        </div>
      </div>
    );
  }
  if (scope.kind === "raw") {
    return (
      <div className="flex flex-col gap-1.5">
        <ScopeLabel>Scope</ScopeLabel>
        <div className="flex flex-wrap gap-1.5">
          {scope.items.map((item) => (
            <ScopeChip key={item}>{item}</ScopeChip>
          ))}
        </div>
      </div>
    );
  }
  return <span className="text-muted-foreground text-xs">Full family access</span>;
}

/** One permission-family consent card: icon, label, risk, scope, grant ids. */
function GrantFamilyCard({ family }: Readonly<{ family: GrantFamily }>) {
  const Icon = familyIcon(family.id);
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card px-4 py-3.5">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <Icon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-foreground text-sm">{family.label}</span>
            <RiskTag risk={family.risk} />
          </div>
          {family.verbs.length > 0 ? (
            <div className="mt-0.5 text-muted-foreground text-xs">
              Covers {family.verbs.join(" · ")}
            </div>
          ) : null}
        </div>
      </div>
      <GrantScopeView scope={family.scope} />
      <div className="flex flex-wrap gap-x-3 gap-y-1 border-border border-t pt-2.5 font-mono text-[11px] text-muted-foreground/70">
        {family.grantIds.map((id) => (
          <span key={id}>{id}</span>
        ))}
      </div>
    </div>
  );
}

/** "Permissions requested" section: grants grouped by family, each with its scope and risk tag. */
export function PermissionsSection({
  grants,
  grantKeys,
}: Readonly<{ grants: PluginDetail["grants"]; grantKeys: string[] }>) {
  if (grantKeys.length === 0) return null;
  const families = groupGrants(grants);
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-bold font-heading text-lg tracking-tight">Permissions requested</h2>
      <div className="flex flex-col gap-2.5">
        {families.map((family) => (
          <GrantFamilyCard key={family.id} family={family} />
        ))}
      </div>
      <p className="flex items-start gap-2 text-muted-foreground text-xs leading-relaxed">
        <Lock className="mt-0.5 size-3.5 shrink-0" />
        Consent is granted per family and revocable at any time from your hub. Every grant call is
        recorded in the audit log, with secrets and request bodies redacted.
      </p>
    </section>
  );
}
