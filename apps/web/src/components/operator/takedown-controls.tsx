import { Button, Input } from "@brika/clay";
import { type SyntheticEvent, useState } from "react";

/**
 * The takedown/restore control shared by the org and package operator views. When active it
 * shows a single "Restore" button; when not, a "Take down" button that reveals an inline
 * reason form (a deliberate two-step, so a destructive moderation action is never one click).
 * The parent owns the async call + busy state; this only collects the reason.
 */
export function TakedownControls({
  takenDown,
  busy,
  onTakedown,
  onRestore,
}: Readonly<{
  takenDown: boolean;
  busy: boolean;
  onTakedown: (reason: string) => void;
  onRestore: () => void;
}>) {
  const [prompting, setPrompting] = useState(false);
  const [reason, setReason] = useState("");

  if (takenDown) {
    return (
      <Button variant="secondary" disabled={busy} onClick={onRestore}>
        Restore
      </Button>
    );
  }

  if (!prompting) {
    return (
      <Button variant="destructive" disabled={busy} onClick={() => setPrompting(true)}>
        Take down
      </Button>
    );
  }

  function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = reason.trim();
    if (trimmed.length === 0) return;
    onTakedown(trimmed);
  }

  return (
    <form className="flex items-center gap-2" onSubmit={submit}>
      <Input
        autoFocus
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason (recorded in the audit log)"
        className="w-64"
      />
      <Button type="submit" variant="destructive" disabled={busy || reason.trim().length === 0}>
        Confirm
      </Button>
      <Button
        type="button"
        variant="ghost"
        disabled={busy}
        onClick={() => {
          setPrompting(false);
          setReason("");
        }}
      >
        Cancel
      </Button>
    </form>
  );
}
