import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { useT } from "@/i18n";

/** Copy a value to the clipboard with brief "Copied" feedback. */
export function CopyButton({
  value,
  label,
  className,
}: Readonly<{ value: string; label?: string; className?: string }>) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const buttonLabel = label ?? t("plugin:copy");

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked (insecure context / permissions); leave state unchanged.
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={t("plugin:copyLabel", { label: buttonLabel })}
      className={
        className ??
        "inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 font-medium text-foreground text-xs hover:bg-muted"
      }
    >
      {copied ? (
        <Check className="size-3.5 text-emerald-500" />
      ) : (
        <Copy className="size-3.5 text-muted-foreground" />
      )}
      {copied ? t("plugin:copied") : buttonLabel}
    </button>
  );
}
