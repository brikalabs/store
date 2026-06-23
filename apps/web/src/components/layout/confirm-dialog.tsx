import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Input,
} from "@brika/clay";
import { Loader2 } from "lucide-react";
import { type MouseEvent, type ReactNode, useState } from "react";

/**
 * A reusable confirm dialog for destructive actions (delete scope, revoke token, remove member).
 * Controlled via `open`/`onOpenChange`. When `confirmWord` is set, the action stays disabled until
 * the user types that word exactly - the guard the design uses for irreversible scope deletion.
 *
 * `onConfirm` may be async: while its promise is pending the action shows a spinner and the dialog
 * stays open, then closes when it settles. So a caller just passes the async work - no separate
 * busy state or manual close.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  confirmWord,
  destructive = true,
  onConfirm,
}: Readonly<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  confirmWord?: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
}>) {
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const armed = confirmWord === undefined || typed.trim() === confirmWord;

  async function confirm(event: MouseEvent) {
    const result = onConfirm();
    if (!(result instanceof Promise)) return; // sync: let the dialog close as usual
    event.preventDefault(); // keep it open while the async work runs
    setBusy(true);
    try {
      await result;
    } finally {
      setBusy(false);
      onOpenChange(false);
    }
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (busy) return; // don't dismiss mid-flight
        if (!next) setTyped("");
        onOpenChange(next);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {confirmWord !== undefined && (
          <Input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={confirmWord}
            aria-label={`Type ${confirmWord} to confirm`}
            className="font-mono"
            autoComplete="off"
          />
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={!armed || busy}
            onClick={confirm}
            className={
              destructive ? "bg-danger text-white hover:bg-danger/90 focus-visible:ring-danger" : ""
            }
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
