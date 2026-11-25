import { CATEGORIES } from "./config.js";

export function loadImage(src, crossOrigin = false) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (crossOrigin) img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Image failed to load"));
    img.src = src;
  });
}

/** Draws img (downscaled to maxSide) with detection boxes + labels burned in. Returns a JPEG data URL. */
export function renderToDataUrl(img, maxSide, detections = []) {
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const W = Math.round(img.naturalWidth * scale);
  const H = Math.round(img.naturalHeight * scale);
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, W, H);

  const line = Math.max(2, W / 320);
  const fontPx = Math.max(12, Math.round(W / 55));
  ctx.font = `600 ${fontPx}px "DM Sans", system-ui, sans-serif`;
  ctx.textBaseline = "middle";

  for (const d of detections) {
    if (!d.box) continue;
    const cat = CATEGORIES.find((c) => c.name === d.category) || CATEGORIES[3];
    const x = d.box.x * W, y = d.box.y * H, w = d.box.w * W, h = d.box.h * H;
    ctx.lineWidth = line;
    ctx.strokeStyle = cat.color;
    ctx.strokeRect(x, y, w, h);
    // light outer stroke keeps dark boxes visible on dark photos
    ctx.strokeStyle = "rgba(251,249,244,.7)";
    ctx.lineWidth = 1;
    ctx.strokeRect(x - line / 2, y - line / 2, w + line, h + line);

    const text = d.confidence != null ? `${d.label} ${Math.round(d.confidence * 100)}%` : d.label;
    const padX = fontPx * 0.5, labelH = fontPx * 1.6;
    const labelW = ctx.measureText(text).width + padX * 2;
    const ly = y - labelH >= 0 ? y - labelH : y;
    const lx = Math.min(x, Math.max(0, W - labelW));
    ctx.fillStyle = cat.color;
    ctx.fillRect(lx, ly, labelW, labelH);
    ctx.fillStyle = cat.text;
    ctx.fillText(text, lx + padX, ly + labelH / 2);
  }
  return canvas.toDataURL("image/jpeg", 0.82);
}
