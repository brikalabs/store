import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  Button,
  Input,
} from "@brika/clay";
import { Loader2 } from "lucide-react";
import { type ReactNode, type SyntheticEvent, useState } from "react";
import { useT } from "@/i18n";

/**
 * Modal that collects a takedown reason (recorded in the audit log) before a destructive moderation
 * action: a deliberate two-step so moderation is never one click. Shared by the per-row and bulk
 * operator controls. While `busy` the action shows a spinner and the modal stays open; the caller
 * unmounts the control on success (the row flips to "restore", the bulk bar clears), dismissing it.
 */
export function TakedownDialog({
  trigger,
  title,
  description,
  confirmLabel,
  busy,
  onConfirm,
}: Readonly<{
  trigger: ReactNode;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  busy: boolean;
  onConfirm: (reason: string) => void;
}>) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const armed = reason.trim().length > 0;

  // A plain submit Button (not AlertDialogAction) keeps the modal open while the takedown is in
  // flight; the caller dismisses it by unmounting the control on success.
  function submit(event: SyntheticEvent) {
    event.preventDefault();
    if (armed && !busy) onConfirm(reason.trim());
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (busy) return; // don't dismiss mid-flight
        if (!next) setReason("");
        setOpen(next);
      }}
    >
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <form onSubmit={submit} className="contents">
          <AlertDialogHeader>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            <AlertDialogDescription>{description}</AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            autoFocus
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t("operator:reasonPlaceholder")}
            aria-label={t("operator:reasonPlaceholder")}
          />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>{t("operator:cancel")}</AlertDialogCancel>
            <Button type="submit" variant="destructive" disabled={!armed || busy}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              {confirmLabel}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
