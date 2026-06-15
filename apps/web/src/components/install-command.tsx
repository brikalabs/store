import { Check, Copy } from "lucide-react";
import { useState } from "react";

type Props = Readonly<{ command: string; id?: string }>;

export function InstallCommand({ command, id }: Props) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div
      id={id}
      className="flex items-center gap-2.5 rounded-xl bg-[#18181B] px-4 py-3.5 font-mono text-[#E9E6E2] text-sm dark:bg-black"
    >
      <span className="select-none text-brand-muted">$</span>
      <span className="truncate">{command}</span>
      <button
        type="button"
        onClick={copy}
        aria-label="Copy install command"
        className="ml-auto inline-flex shrink-0 items-center gap-1.5 text-white/55 text-xs transition-colors hover:text-white"
      >
        {copied ? <Check className="size-4 text-brand-muted" /> : <Copy className="size-4" />}
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
