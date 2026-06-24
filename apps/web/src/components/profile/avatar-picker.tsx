import { Button } from "@brika/clay";
import { Trash2, Upload } from "lucide-react";
import { type ChangeEvent, useRef, useState } from "react";
import { ImageCropModal } from "@/components/clay/image-crop-modal";
import { GradientAvatar } from "@/components/clay/plugin-icon";
import { useAccountAvatar } from "@/hooks/use-account-avatar";
import { useT } from "@/i18n";

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
  const t = useT();
  const inputRef = useRef<HTMLInputElement>(null);
  // The file awaiting crop is view state local to the modal flow; the upload itself lives in the hook.
  const [pending, setPending] = useState<File | null>(null);
  const { busy, error, clearError, upload, remove } = useAccountAvatar(onChange);

  function pick(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";
    clearError();
    setPending(file);
  }

  async function crop(blob: Blob) {
    setPending(null);
    await upload(blob);
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
        {busy ? t("profile:avatarUploading") : t("profile:avatarUpload")}
      </Button>
      <Button
        type="button"
        variant="outline"
        onClick={remove}
        disabled={busy}
        className="inline-flex h-[38px] items-center gap-1.5 rounded-[10px] border border-input bg-card px-3.5 font-semibold text-muted-foreground text-sm transition-colors hover:border-danger-border hover:text-danger disabled:opacity-60"
      >
        <Trash2 className="size-4" />
        {t("profile:avatarRemove")}
      </Button>
      <span className="text-muted-foreground text-xs">{error ?? t("profile:avatarHint")}</span>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={pick} />
      <ImageCropModal
        file={pending}
        title={t("profile:avatarCropTitle")}
        shape="circle"
        onCancel={() => setPending(null)}
        onApply={crop}
      />
    </div>
  );
}
