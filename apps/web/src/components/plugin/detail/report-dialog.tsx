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
import { REPORT_REASON_KEYS, REPORT_REASONS, type ReportReason } from "@/lib/reports";

/** The "Report plugin" trigger (subtle ghost button) plus its dialog. */
export function ReportPluginButton({ name, version }: Readonly<{ name: string; version: string }>) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-medium text-muted-foreground text-xs transition-colors hover:bg-destructive/10 hover:text-destructive"
      >
        <Flag className="size-3.5" />
        Report plugin
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
          {REPORT_REASONS[reasonKey].label}
        </span>
        <span className="block text-muted-foreground text-xs">
          {REPORT_REASONS[reasonKey].description}
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
              <AlertDialogTitle>Report submitted</AlertDialogTitle>
              <AlertDialogDescription>
                Thanks. A registry moderator will review{" "}
                <span className="font-mono text-foreground">{name}</span>
                {" for "}
                <span className="text-foreground">
                  {REPORT_REASONS[reason ?? "other"].label.toLowerCase()}
                </span>
                {". It's now in the moderation queue."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <Button onClick={() => change(false)}>Done</Button>
          </div>
        ) : (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <Flag className="size-4 text-destructive" />
                Report this plugin
              </AlertDialogTitle>
              <AlertDialogDescription className="font-mono">
                {name} · v{version}
              </AlertDialogDescription>
            </AlertDialogHeader>

            <div className="flex flex-col gap-3">
              <div className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
                What's wrong?
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
                  Details <span className="font-normal text-muted-foreground">(optional)</span>
                </label>
                <Textarea
                  id="report-details"
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  placeholder="Links, version numbers, or anything that helps our moderators investigate."
                  rows={3}
                  maxLength={2000}
                />
              </div>

              {error ? <p className="text-destructive text-sm">{error}</p> : null}
            </div>

            <AlertDialogFooter className="items-center sm:justify-between">
              <span className="text-muted-foreground text-xs">
                False reports may affect your account standing.
              </span>
              <div className="flex gap-2">
                <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
                <Button
                  onClick={onSubmit}
                  disabled={reason === null || submitting}
                  className="bg-destructive text-white hover:bg-destructive/90"
                >
                  <Flag className="size-4" />
                  {submitting ? "Submitting…" : "Submit report"}
                </Button>
              </div>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}
