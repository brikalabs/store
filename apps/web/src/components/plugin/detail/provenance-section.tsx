import { Separator } from "@brika/clay/components/separator";
import type { PluginDetail } from "@brika/registry-contract";
import { ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { CopyButton } from "@/components/plugin/copy-button";
import { useT } from "@/i18n";
import { formatBytes } from "@/lib/format";
import { workflowPath } from "./helpers";

/** A label/value row in the provenance grid; value may be a link. */
function ProvenanceRow({
  label,
  href,
  children,
}: Readonly<{ label: string; href?: string; children: ReactNode }>) {
  const value = href ? (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="truncate font-mono text-brand text-xs underline decoration-1 underline-offset-2"
    >
      {children}
    </a>
  ) : (
    <span className="truncate font-mono text-foreground text-xs">{children}</span>
  );
  return (
    <>
      <span className="font-semibold text-foreground text-xs">{label}</span>
      {value}
    </>
  );
}

/** Built-from-CI block, anchored on the verified OIDC token (cannot be forged). */
function ProvenanceBlock({ provenance }: Readonly<{ provenance: PluginDetail["provenance"] }>) {
  const t = useT();
  if (provenance === undefined) return null;
  const { repository, sha, ref, workflowRef, runId } = provenance;
  const repoUrl = `https://github.com/${repository}`;
  return (
    <div className="grid grid-cols-[auto_1fr] items-start gap-x-7 gap-y-4 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-col gap-1.5">
        <span className="text-muted-foreground text-xs">{t("pluginDetail:builtAndSignedOn")}</span>
        <span className="inline-flex items-center gap-2 font-bold font-heading text-base text-foreground">
          <ShieldCheck className="size-4 text-emerald-500" />
          {t("pluginDetail:githubActions")}
        </span>
        {runId ? (
          <a
            href={`${repoUrl}/actions/runs/${runId}`}
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-foreground text-xs underline underline-offset-2"
          >
            {t("pluginDetail:viewBuildSummary")}
          </a>
        ) : null}
      </div>
      <div className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2.5">
        <ProvenanceRow
          label={t("pluginDetail:sourceCommit")}
          href={sha ? `${repoUrl}/commit/${sha}` : repoUrl}
        >
          github.com/{repository}
          {sha ? `@${sha.slice(0, 7)}` : ""}
        </ProvenanceRow>
        {workflowRef ? (
          <ProvenanceRow
            label={t("pluginDetail:buildFile")}
            href={
              ref
                ? `${repoUrl}/blob/${ref.replace("refs/heads/", "")}/${workflowPath(workflowRef)}`
                : repoUrl
            }
          >
            {workflowPath(workflowRef)}
          </ProvenanceRow>
        ) : null}
        {provenance.transparencyLog ? (
          <ProvenanceRow
            label={t("pluginDetail:publicLedger")}
            href={provenance.transparencyLog.logUrl}
          >
            {t("pluginDetail:transparencyLogEntry")}
          </ProvenanceRow>
        ) : null}
      </div>
    </div>
  );
}

/**
 * "Integrity & provenance" section: the tarball's SHA-512 SRI plus, for CI-published
 * versions, build provenance derived from the verified GitHub OIDC token.
 */
export function IntegrityProvenanceSection({
  integrity,
  provenance,
  size,
  unpackedSize,
  fileCount,
}: Readonly<{
  integrity: string;
  provenance: PluginDetail["provenance"];
  size?: number;
  unpackedSize?: number;
  fileCount?: number;
}>) {
  const t = useT();
  const digestSize = unpackedSize ?? size;
  return (
    <section className="flex flex-col gap-3">
      <h2 className="flex items-center gap-2 font-bold font-heading text-lg tracking-tight">
        <ShieldCheck className="size-4 text-emerald-500" />
        {t("pluginDetail:integrityProvenanceHeading")}
      </h2>
      <p className="text-muted-foreground text-sm leading-relaxed">
        {provenance
          ? t("pluginDetail:integrityProvenanceWithCi")
          : t("pluginDetail:integrityProvenanceNoCi")}
      </p>
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3.5">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="min-w-16 font-semibold text-muted-foreground text-xs">
            {t("pluginDetail:integrityLabel")}
          </span>
          <code className="min-w-0 flex-1 truncate rounded-md border border-border bg-muted px-2.5 py-1.5 font-mono text-foreground text-xs">
            {integrity}
          </code>
          <CopyButton value={integrity} />
        </div>
        {digestSize === undefined ? null : (
          <>
            <Separator />
            <div className="flex items-center gap-2.5">
              <span className="min-w-16 font-semibold text-muted-foreground text-xs">
                {t("pluginDetail:digestLabel")}
              </span>
              <span className="font-mono text-foreground text-xs">
                {t("pluginDetail:digestTarball")} · {formatBytes(digestSize)}
                {fileCount === undefined
                  ? ""
                  : ` · ${t("pluginDetail:digestFiles", { count: fileCount })}`}
              </span>
            </div>
          </>
        )}
      </div>
      <ProvenanceBlock provenance={provenance} />
    </section>
  );
}
