const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.85;
/** Downscale to MAX_EDGE on the long side and re-encode as JPEG so uploads stay small on phones. */
export async function downscale(file: File): Promise<string> {
  let source: ImageBitmap | HTMLImageElement;
  let width: number;
  let height: number;
  if (typeof createImageBitmap === "function") {
    // `imageOrientation: "from-image"` applies the EXIF rotation phones write.
    const bmp = await createImageBitmap(file, {
      imageOrientation: "from-image",
    } as ImageBitmapOptions).catch(() => createImageBitmap(file));
    source = bmp;
    width = bmp.width;
    height = bmp.height;
  } else {
    const url = URL.createObjectURL(file);
    try {
      source = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("decode"));
        img.src = url;
      });
    } finally {
      URL.revokeObjectURL(url);
    }
    width = source.naturalWidth;
    height = source.naturalHeight;
  }
  const scale = Math.min(1, MAX_EDGE / Math.max(width, height));
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.drawImage(source, 0, 0, w, h);
  if ("close" in source) source.close();
  return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
}
