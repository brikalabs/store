/** Allowed raster logo types -> file extension. SVG is excluded (script-in-SVG surface). */
export const ICON_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export const MAX_ICON_BYTES = 512 * 1024; // 512 KiB
