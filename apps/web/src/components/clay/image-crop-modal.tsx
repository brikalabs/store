"use client";

import {
  Cropper,
  CropperApply,
  CropperCancel,
  CropperFlip,
  CropperReset,
  CropperRotate,
  CropperViewport,
  CropperZoom,
} from "@brika/clay/components/cropper";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@brika/clay/components/dialog";
import {
  FlipHorizontal2,
  FlipVertical2,
  RotateCcw,
  RotateCcwSquare,
  RotateCw,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useT } from "@/i18n";

/**
 * A reposition/zoom/rotate/flip cropper for avatars and logos, composed from Clay's
 * Cropper parts. Opens when `file` is set; exports a square WebP blob via `onApply`
 * (the existing image endpoints accept it unchanged), or dismisses via `onCancel`.
 */
export function ImageCropModal({
  file,
  title,
  shape = "circle",
  onCancel,
  onApply,
}: Readonly<{
  file: File | null;
  title: string;
  shape?: "circle" | "rounded";
  onCancel: () => void;
  onApply: (blob: Blob) => void;
}>) {
  const t = useT();
  return (
    <Cropper image={file} shape={shape}>
      <Dialog
        open={file !== null}
        onOpenChange={(open) => {
          if (!open) onCancel();
        }}
      >
        <DialogContent className="w-[380px] max-w-[calc(100vw-2rem)] gap-4">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{t("clay:cropHint")}</DialogDescription>
          </DialogHeader>

          <div className="flex justify-center">
            <CropperViewport />
          </div>

          <div className="flex items-center gap-3">
            <ZoomOut className="size-4 shrink-0 text-muted-foreground" />
            <CropperZoom className="flex-1" />
            <ZoomIn className="size-4 shrink-0 text-muted-foreground" />
          </div>

          <div className="flex items-center gap-2">
            <CropperRotate
              direction="left"
              aria-label={t("clay:cropRotateLeft")}
              className="flex-1"
            >
              <RotateCcw className="size-4" />
            </CropperRotate>
            <CropperRotate
              direction="right"
              aria-label={t("clay:cropRotateRight")}
              className="flex-1"
            >
              <RotateCw className="size-4" />
            </CropperRotate>
            <CropperFlip axis="h" aria-label={t("clay:cropFlipHorizontal")} className="flex-1">
              <FlipHorizontal2 className="size-4" />
            </CropperFlip>
            <CropperFlip axis="v" aria-label={t("clay:cropFlipVertical")} className="flex-1">
              <FlipVertical2 className="size-4" />
            </CropperFlip>
            <CropperReset aria-label={t("clay:cropReset")} className="flex-1">
              <RotateCcwSquare className="size-4" />
            </CropperReset>
          </div>

          <DialogFooter>
            <CropperCancel onCancel={onCancel} className="flex-1">
              {t("clay:cropCancel")}
            </CropperCancel>
            <CropperApply onCrop={onApply} className="flex-1">
              {t("clay:cropApply")}
            </CropperApply>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Cropper>
  );
}
