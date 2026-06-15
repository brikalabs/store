import { cn } from "@brika/clay";
import { ImageOff } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";

type Status = "loading" | "loaded" | "error";

/**
 * Image with a muted skeleton while loading and a graceful fallback when the
 * source fails or stalls. Lazy-loads by default. The wrapper carries the box
 * sizing/rounding; the <img> fills it with `object-cover`. A load that neither
 * succeeds nor errors within `timeoutMs` is treated as failed so the fallback
 * still shows (e.g. an image host that hangs).
 */
export function Image({
  src,
  alt = "",
  className,
  imgClassName,
  fallback,
  loading = "lazy",
  timeoutMs = 5000,
}: Readonly<{
  src: string;
  alt?: string;
  className?: string;
  imgClassName?: string;
  fallback?: ReactNode;
  loading?: "lazy" | "eager";
  timeoutMs?: number;
}>) {
  const [status, setStatus] = useState<Status>("loading");

  // `src` is a dependency on purpose: switching the source resets the loader.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset on src change
  useEffect(() => {
    setStatus("loading");
    const timer = setTimeout(() => {
      setStatus((current) => (current === "loading" ? "error" : current));
    }, timeoutMs);
    return () => clearTimeout(timer);
  }, [src, timeoutMs]);

  return (
    <div data-slot="image" className={cn("relative overflow-hidden bg-muted", className)}>
      {status === "loading" ? (
        <div className="absolute inset-0 animate-pulse bg-muted" aria-hidden="true" />
      ) : null}

      {status === "error"
        ? (fallback ?? (
            <div className="flex size-full items-center justify-center text-muted-foreground">
              <ImageOff className="size-6" />
            </div>
          ))
        : null}

      {status !== "error" ? (
        <img
          src={src}
          alt={alt}
          loading={loading}
          decoding="async"
          onLoad={() => setStatus("loaded")}
          onError={() => setStatus("error")}
          className={cn(
            "size-full object-cover transition-opacity duration-300",
            status === "loaded" ? "opacity-100" : "opacity-0",
            imgClassName,
          )}
        />
      ) : null}
    </div>
  );
}
