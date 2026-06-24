import { Button } from "@brika/clay";
import { Trash2, Upload } from "lucide-react";
import { type ChangeEvent, useRef, useState } from "react";
import { ImageCropModal } from "@/components/clay/image-crop-modal";
import { GradientAvatar } from "@/components/clay/plugin-icon";
import { SettingsCard } from "@/components/clay/settings-card";
import { useScopeLogo } from "@/hooks/use-scope-logo";
import type { ScopeCardProps } from "@/lib/scope-api";

/** Upload / clear the scope's logo (raster image stored in R2, shown on the public page). */
export function LogoCard({ scope, onError }: Readonly<ScopeCardProps>) {
  const { iconUrl, busy, upload, clear } = useScopeLogo(scope, onError);
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<File | null>(null);

  function pick(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";
    setPending(file);
  }

  return (
    <SettingsCard className="gap-1.5">
      <h2 className="font-bold text-base text-foreground">Logo</h2>
      <p className="text-[12.5px] text-muted-foreground leading-relaxed">
        Shown on your public scope page. Cropped and converted to WebP in your browser before
        upload.
      </p>
      <div className="mt-2.5 flex items-center gap-3.5">
        <GradientAvatar
          seed={scope}
          label={scope}
          imageUrl={iconUrl}
          size={54}
          className="rounded-[14px] border border-border"
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="inline-flex h-[38px] items-center gap-1.5 rounded-[10px] border border-input bg-card px-3.5 font-semibold text-foreground text-sm shadow-none transition-colors hover:border-brand-border hover:bg-card hover:text-foreground disabled:opacity-60"
        >
          <Upload className="size-4" />
          {busy ? "Uploading…" : "Upload"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={clear}
          disabled={busy}
          className="inline-flex h-[38px] items-center gap-1.5 rounded-[10px] border border-input bg-card px-3.5 font-semibold text-muted-foreground text-sm shadow-none transition-colors hover:border-danger-border hover:bg-card hover:text-danger disabled:opacity-60"
        >
          <Trash2 className="size-4" />
          Remove
        </Button>
      </div>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={pick} />
      <ImageCropModal
        file={pending}
        title="Crop your logo"
        shape="rounded"
        onCancel={() => setPending(null)}
        onApply={(blob) => {
          setPending(null);
          void upload(blob);
        }}
      />
    </SettingsCard>
  );
}
