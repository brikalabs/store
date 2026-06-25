import type { PluginFile } from "@brika/registry-contract";
import { useEffect, useState } from "react";
import { fileKind, filesFromIndex } from "@/components/plugin/file-tree";
import { assetUrl, pluginVersionUrl } from "@/lib/registry/registry-paths";

// Cap inline previews so a large file never streams megabytes into the page.
const MAX_PREVIEW_BYTES = 256 * 1024;

/**
 * The published tarball's file list, fetched lazily on mount from the version's `/index` endpoint
 * (so the detail page never ships it). `files` is null while loading and `failed` flips on a
 * network/parse error; the section shows the matching placeholder. A re-run cancels its predecessor.
 */
export function usePluginFiles(
  name: string,
  version: string,
): { files: PluginFile[] | null; failed: boolean } {
  const [files, setFiles] = useState<PluginFile[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    setFiles(null);
    setFailed(false);
    fetch(`${pluginVersionUrl(name, version)}/index`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("load failed"))))
      .then((json: unknown) => {
        if (active) setFiles(filesFromIndex(json));
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [name, version]);

  return { files, failed };
}

/**
 * A previewable text file's bytes, fetched lazily from the (immutable, R2-cached) asset endpoint.
 * Returns `text` (null until loaded) and a `status` the viewer branches on. Only text files within
 * the preview cap are fetched; anything else stays idle so the viewer renders its fallback. A new
 * selection cancels the in-flight read.
 */
export function usePluginFileContent(
  name: string,
  version: string,
  file: PluginFile | undefined,
): {
  src: string;
  kind: "image" | "text" | "binary";
  previewable: boolean;
  text: string | null;
  status: "idle" | "loading" | "error";
} {
  const src = file ? assetUrl(name, version, file.path) : "";
  const kind = file ? fileKind(file) : "binary";
  const previewable = file !== undefined && file.size <= MAX_PREVIEW_BYTES;
  const [text, setText] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");

  useEffect(() => {
    if (file === undefined || kind !== "text" || !previewable) {
      setText(null);
      return;
    }
    let active = true;
    setStatus("loading");
    setText(null);
    fetch(src)
      .then((res) => (res.ok ? res.text() : Promise.reject(new Error("load failed"))))
      .then((body) => {
        if (active) {
          setText(body);
          setStatus("idle");
        }
      })
      .catch(() => {
        if (active) setStatus("error");
      });
    return () => {
      active = false;
    };
  }, [src, kind, previewable, file]);

  return { src, kind, previewable, text, status };
}
