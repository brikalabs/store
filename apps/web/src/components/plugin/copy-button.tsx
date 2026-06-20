import { Check, Copy } from "lucide-react";
import { useState } from "react";

/**
 * Copy a value to the clipboard with brief "Copied" feedback. Client-only: the
 * click handler runs after hydration (`navigator.clipboard` is unavailable
 * during SSR), while the button still renders server-side.
 */
export function CopyButton({
  value,
  label = "Copy",
  className,
}: Readonly<{ value: string; label?: string; className?: string }>) {
  const [copied, setCopied] = useState(false);

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
      aria-label={`Copy ${label}`}
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
      {copied ? "Copied" : label}
    </button>
  );
}
