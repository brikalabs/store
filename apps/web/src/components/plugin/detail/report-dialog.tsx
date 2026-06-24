import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  cn,
  Textarea,
} from "@brika/clay";
import { Check, Flag } from "lucide-react";
import { useState } from "react";
import { usePluginReport } from "@/hooks/use-plugin-report";
import { useT } from "@/i18n";
import {
  REPORT_REASON_KEYS,
  type ReportReason,
  reportReasonDescriptionKey,
  reportReasonLabelKey,
} from "@/lib/reports";

/** The "Report plugin" trigger (subtle ghost button) plus its dialog. */
export function ReportPluginButton({ name, version }: Readonly<{ name: string; version: string }>) {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-medium text-muted-foreground text-xs transition-colors hover:bg-destructive/10 hover:text-destructive"
      >
        <Flag className="size-3.5" />
        {t("pluginDetail:reportPlugin")}
      </button>
      <ReportDialog open={open} onOpenChange={setOpen} name={name} version={version} />
    </>
  );
}

/** One selectable reason: a radio-styled card with its label and description. */
function ReportReasonOption({
  reasonKey,
  selected,
  onSelect,
}: Readonly<{ reasonKey: ReportReason; selected: boolean; onSelect: () => void }>) {
  const t = useT();
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors",
        selected ? "border-brand bg-brand/10" : "border-border hover:bg-muted/50",
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border",
          selected ? "border-brand bg-brand" : "border-muted-foreground/40",
        )}
      >
        {selected ? <span className="size-1.5 rounded-full bg-white" /> : null}
      </span>
      <span className="min-w-0">
        <span className="block font-medium text-foreground text-sm">
          {t(reportReasonLabelKey(reasonKey))}
        </span>
        <span className="block text-muted-foreground text-xs">
          {t(reportReasonDescriptionKey(reasonKey))}
        </span>
      </span>
    </button>
  );
}

function ReportDialog({
  open,
  onOpenChange,
  name,
  version,
}: Readonly<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  version: string;
}>) {
  const t = useT();
  const { submitting, error, submitted, submit, reset } = usePluginReport(name);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState("");

  function change(next: boolean) {
    if (submitting) return; // don't dismiss mid-flight
    if (!next) {
      // Reset so the next open starts fresh (and the success panel doesn't flash).
      setReason(null);
      setDetails("");
      reset();
    }
    onOpenChange(next);
  }

  async function onSubmit() {
    if (reason === null) return;
    await submit(reason, details);
  }

  return (
    <AlertDialog open={open} onOpenChange={change}>
      <AlertDialogContent>
        {submitted ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-green-500/15 text-green-600 dark:text-green-400">
              <Check className="size-6" />
            </span>
            <AlertDialogHeader className="items-center">
              <AlertDialogTitle>{t("pluginDetail:reportSubmittedTitle")}</AlertDialogTitle>
              <AlertDialogDescription>
                {t("pluginDetail:reportThanksReview")}{" "}
                <span className="font-mono text-foreground">{name}</span>
                {` ${t("pluginDetail:reportFor")} `}
                <span className="text-foreground">
                  {t(reportReasonLabelKey(reason ?? "other")).toLowerCase()}
                </span>
                {t("pluginDetail:reportInQueue")}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <Button onClick={() => change(false)}>{t("pluginDetail:done")}</Button>
          </div>
        ) : (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <Flag className="size-4 text-destructive" />
                {t("pluginDetail:reportThisPlugin")}
              </AlertDialogTitle>
              <AlertDialogDescription className="font-mono">
                {name} · v{version}
              </AlertDialogDescription>
            </AlertDialogHeader>

            <div className="flex flex-col gap-3">
              <div className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
                {t("pluginDetail:whatsWrong")}
              </div>
              <div className="flex flex-col gap-2">
                {REPORT_REASON_KEYS.map((key) => (
                  <ReportReasonOption
                    key={key}
                    reasonKey={key}
                    selected={reason === key}
                    onSelect={() => setReason(key)}
                  />
                ))}
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="report-details" className="font-medium text-foreground text-sm">
                  {t("pluginDetail:detailsLabel")}{" "}
                  <span className="font-normal text-muted-foreground">
                    {t("pluginDetail:detailsOptional")}
                  </span>
                </label>
                <Textarea
                  id="report-details"
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  placeholder={t("pluginDetail:detailsPlaceholder")}
                  rows={3}
                  maxLength={2000}
                />
              </div>

              {error ? <p className="text-destructive text-sm">{error}</p> : null}
            </div>

            <AlertDialogFooter className="items-center sm:justify-between">
              <span className="text-muted-foreground text-xs">
                {t("pluginDetail:falseReportsWarning")}
              </span>
              <div className="flex gap-2">
                <AlertDialogCancel disabled={submitting}>
                  {t("pluginDetail:cancel")}
                </AlertDialogCancel>
                <Button
                  onClick={onSubmit}
                  disabled={reason === null || submitting}
                  className="bg-destructive text-white hover:bg-destructive/90"
                >
                  <Flag className="size-4" />
                  {submitting ? t("pluginDetail:submitting") : t("pluginDetail:submitReport")}
                </Button>
              </div>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}
