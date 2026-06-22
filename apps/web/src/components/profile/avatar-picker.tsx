import { Trash2, Upload } from "lucide-react";
import { type ChangeEvent, useState } from "react";
import { GradientAvatar } from "@/components/clay/plugin-icon";
import { toResizedWebp } from "@/lib/icon-resize";

/**
 * Upload / clear the signed-in account's avatar (resized + WebP-encoded in the browser, stored
 * in R2). Clearing falls back to the provider avatar; `onChange` reports the new resolved URL.
 */
export function AvatarPicker({
  id,
  displayName,
  avatarUrl,
  onChange,
}: Readonly<{
  id: string;
  displayName: string;
  avatarUrl?: string;
  onChange: (avatarUrl: string | undefined) => void;
}>) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file === undefined) return;
    setBusy(true);
    setError(null);
    try {
      const webp = await toResizedWebp(file);
      const res = await fetch("/api/account/avatar", {
        method: "POST",
        headers: { "content-type": "image/webp" },
        body: webp,
      });
      if (!res.ok) {
        setError("Upload failed. Try a different image.");
        return;
      }
      const data: { avatarUrl?: string } = await res.json();
      onChange(data.avatarUrl);
    } catch {
      setError("That image could not be processed.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/account/avatar", { method: "DELETE" });
    setBusy(false);
    if (res.ok) {
      const data: { avatarUrl?: string } = await res.json();
      onChange(data.avatarUrl);
    } else {
      setError("Could not remove the avatar.");
    }
  }

  return (
    <div className="flex items-center gap-4">
      <GradientAvatar
        seed={id}
        label={displayName}
        imageUrl={avatarUrl}
        size={64}
        className="rounded-[18px]"
      />
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-border bg-background px-3 font-medium text-sm transition-colors hover:bg-muted">
            <Upload className="size-4" />
            {busy ? "Uploading…" : "Upload"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={upload}
              disabled={busy}
            />
          </label>
          <button
            type="button"
            onClick={remove}
            disabled={busy}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-border px-3 font-medium text-muted-foreground text-sm transition-colors hover:border-destructive/40 hover:text-destructive"
          >
            <Trash2 className="size-4" />
            Remove
          </button>
        </div>
        <span className="text-muted-foreground text-xs">
          {error ?? "Any image; resized in your browser. Remove it to use your GitHub avatar."}
        </span>
      </div>
    </div>
  );
}
