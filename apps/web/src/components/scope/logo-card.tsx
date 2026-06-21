import { Trash2, Upload } from "lucide-react";
import { type ChangeEvent, useState } from "react";
import { GradientAvatar } from "@/components/clay/plugin-icon";
import { toResizedWebp } from "@/lib/icon-resize";
import { readError, type ScopeCardProps, scopePath } from "@/lib/scope-api";

/** Upload / clear the scope's logo (raster image stored in R2, shown on the public page). */
export function LogoCard({ scope, onError }: Readonly<ScopeCardProps>) {
  const [bust, setBust] = useState(0);
  const [busy, setBusy] = useState(false);

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file === undefined) return;
    setBusy(true);
    try {
      // Downscale + WebP-encode in the browser so a big source photo uploads as a small logo.
      const webp = await toResizedWebp(file);
      const res = await fetch(scopePath(scope, "/icon"), {
        method: "POST",
        headers: { "content-type": "image/webp" },
        body: webp,
      });
      if (res.ok) setBust((n) => n + 1);
      else onError(await readError(res));
    } catch {
      onError("That image could not be processed. Try a PNG, JPEG, or WebP.");
    } finally {
      setBusy(false);
    }
  }

  async function clear() {
    setBusy(true);
    const res = await fetch(scopePath(scope, "/icon"), { method: "DELETE" });
    setBusy(false);
    if (res.ok) setBust((n) => n + 1);
    else onError(await readError(res));
  }

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-6">
      <h2 className="font-bold font-heading text-lg tracking-tight">Logo</h2>
      <p className="text-muted-foreground text-sm">
        Any image, shown on your public scope page. It is resized and converted to WebP in your
        browser before upload, so pick whatever you like. Without one, a generated avatar is used.
      </p>
      <div className="flex items-center gap-4">
        <GradientAvatar
          // The cache-buster reloads the image after upload/clear; with no logo (404) the clay
          // Avatar shows the generated gradient avatar - the same fallback the public page uses.
          seed={scope}
          label={scope}
          imageUrl={`${scopePath(scope, "/icon")}?v=${bust}`}
          size={64}
          className="border border-border"
        />
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
          onClick={clear}
          disabled={busy}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-border px-3 font-medium text-muted-foreground text-sm transition-colors hover:border-destructive/40 hover:text-destructive"
        >
          <Trash2 className="size-4" />
          Remove
        </button>
      </div>
    </section>
  );
}
