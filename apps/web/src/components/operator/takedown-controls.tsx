import { Button, Input } from "@brika/clay";
import { Ban, Undo2 } from "lucide-react";
import { type SyntheticEvent, useState } from "react";
import { useT } from "@/i18n";

/**
 * The takedown/restore control for the operator views (versions, packages, scopes). "Take down"
 * reveals an inline reason form: a deliberate two-step, so a destructive moderation action is never
 * one click. Outline buttons keep the always-visible row action quiet until the operator commits.
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
  const t = useT();
  const [prompting, setPrompting] = useState(false);
  const [reason, setReason] = useState("");

  if (takenDown) {
    return (
      <Button
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={onRestore}
        className="shrink-0 gap-1.5 text-emerald-700 hover:text-emerald-700 dark:text-emerald-400"
      >
        <Undo2 className="size-4" />
        {t("operator:restore")}
      </Button>
    );
  }

  if (!prompting) {
    return (
      <Button
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={() => setPrompting(true)}
        className="shrink-0 gap-1.5"
      >
        <Ban className="size-4" />
        {t("operator:takeDown")}
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
    <form className="flex shrink-0 items-center gap-2" onSubmit={submit}>
      <Input
        autoFocus
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder={t("operator:reasonPlaceholder")}
        className="h-9 w-56"
      />
      <Button
        type="submit"
        variant="destructive"
        size="sm"
        disabled={busy || reason.trim().length === 0}
      >
        {t("operator:confirm")}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={busy}
        onClick={() => {
          setPrompting(false);
          setReason("");
        }}
      >
        {t("operator:cancel")}
      </Button>
    </form>
  );
}
