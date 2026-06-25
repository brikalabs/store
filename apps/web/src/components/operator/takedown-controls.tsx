import { Button } from "@brika/clay";
import { Ban, Undo2 } from "lucide-react";
import { useT } from "@/i18n";
import { TakedownDialog } from "./takedown-dialog";

/**
 * The takedown/restore control for the operator views (versions, plugins, scopes). "Take down"
 * opens a modal with the reason form (see {@link TakedownDialog}), so a destructive moderation
 * action is never one click and the row never reflows. Outline button keeps the row action quiet.
 */
export function TakedownControls({
  subject,
  takenDown,
  busy,
  onTakedown,
  onRestore,
}: Readonly<{
  /** What is being taken down (plugin, scope, or version), shown in the modal. */
  subject: string;
  takenDown: boolean;
  busy: boolean;
  onTakedown: (reason: string) => void;
  onRestore: () => void;
}>) {
  const t = useT();

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

  return (
    <TakedownDialog
      trigger={
        <Button variant="outline" size="sm" disabled={busy} className="shrink-0 gap-1.5">
          <Ban className="size-4" />
          {t("operator:takeDown")}
        </Button>
      }
      title={t("operator:takeDown")}
      description={<span className="font-mono text-foreground">{subject}</span>}
      confirmLabel={t("operator:takeDown")}
      busy={busy}
      onConfirm={onTakedown}
    />
  );
}
