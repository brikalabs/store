import { Button } from "@brika/clay";
import { Trash2, Upload } from "lucide-react";
import { type ChangeEvent, useRef, useState } from "react";
import { ImageCropModal } from "@/components/clay/image-crop-modal";
import { GradientAvatar } from "@/components/clay/plugin-icon";

/**
 * Upload / clear the signed-in account's avatar. The picked image goes through a crop+zoom step
 * ({@link ImageCropModal}), is exported as WebP in the browser, stored in R2, and served from its
 * public URL. Removing it falls back to the provider avatar. `onChange` reports the resolved URL.
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
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function pick(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";
    setError(null);
    setPending(file);
  }

  async function upload(blob: Blob) {
    setPending(null);
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/account/avatar", {
        method: "POST",
        headers: { "content-type": "image/webp" },
        body: blob,
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
    <div className="flex flex-wrap items-center gap-3.5">
      <GradientAvatar
        seed={id}
        label={displayName}
        imageUrl={avatarUrl}
        size={60}
        className="rounded-2xl border border-border"
      />
      <Button
        type="button"
        variant="outline"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="inline-flex h-[38px] items-center gap-1.5 rounded-[10px] border border-input bg-card px-3.5 font-semibold text-sm transition-colors hover:border-brand-border disabled:opacity-60"
      >
        <Upload className="size-4" />
        {busy ? "Uploading…" : "Upload"}
      </Button>
      <Button
        type="button"
        variant="outline"
        onClick={remove}
        disabled={busy}
        className="inline-flex h-[38px] items-center gap-1.5 rounded-[10px] border border-input bg-card px-3.5 font-semibold text-muted-foreground text-sm transition-colors hover:border-danger-border hover:text-danger disabled:opacity-60"
      >
        <Trash2 className="size-4" />
        Remove
      </Button>
      <span className="text-muted-foreground text-xs">
        {error ?? "Remove it to use your provider avatar."}
      </span>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={pick} />
      <ImageCropModal
        file={pending}
        title="Crop your avatar"
        shape="circle"
        onCancel={() => setPending(null)}
        onApply={upload}
      />
    </div>
  );
}
