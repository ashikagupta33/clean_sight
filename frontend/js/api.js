/**
 * All backend communication lives here. UI code never calls fetch().
 *
 * The API contract has NOT been confirmed. Everything assumed about the request and
 * response is in RESPONSE_MAP below. When the backend team confirms the real shape,
 * change RESPONSE_MAP only; scan.js and the rest of the UI keep working.
 */
import { CONFIG, categoryFor, emptyCounts } from "./config.js";

export const RESPONSE_MAP = {
  uploadField: "file", // multipart field name for the image in POST /detect
  detectionsKeys: ["detections", "predictions", "results", "objects"], // array of detections (first match)
  labelKeys: ["label", "class_name", "class", "name"],
  confidenceKeys: ["confidence", "score", "conf"], // 0-1 or 0-100, both accepted
  boxKeys: ["bbox", "box", "xyxy"], // array of 4 numbers, or object {x1,y1,x2,y2}
  boxFormat: "xyxy", // "xyxy" = [x1,y1,x2,y2] | "xywh" = [x,y,w,h] (top-left) | "cxcywh" = centre-based
  boxUnits: "pixels", // "pixels" (of the uploaded image) | "normalized" (0-1)
  annotatedKeys: ["annotated_image", "annotated_image_url", "image_url"], // URL, data URL or raw base64 (assumed JPEG)
  countsKeys: ["counts", "category_counts"], // optional {label: n}; only used if no detections array is present
  totalKeys: ["total", "total_count", "count"], // optional; only used if no detections array is present
};

export class ApiError extends Error {
  constructor(code, message, status) {
    super(message);
    this.code = code; // "network" | "timeout" | "http" | "invalid_response"
    this.status = status;
  }
}

const url = (path) => `${CONFIG.API_BASE_URL}${path}`;
const firstKey = (obj, keys) => keys.find((k) => obj && obj[k] !== undefined && obj[k] !== null);

/** POST /detect. Resolves to a normalised result; throws ApiError otherwise. */
export async function detectWaste(file, imageSize) {
  if (CONFIG.USE_MOCK_API) {
    const { mockDetect } = await import("./mock/mock-detect.js");
    return { ...normalizeDetectResponse(await mockDetect(imageSize), imageSize), isMock: true };
  }

  const form = new FormData();
  form.append(RESPONSE_MAP.uploadField, file);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CONFIG.REQUEST_TIMEOUT_MS);
  let res;
  try {
    res = await fetch(url("/detect"), { method: "POST", body: form, signal: controller.signal });
  } catch (err) {
    throw err.name === "AbortError"
      ? new ApiError("timeout", "Request timed out")
      : new ApiError("network", "Backend unreachable");
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) throw new ApiError("http", `HTTP ${res.status}`, res.status);

  let data;
  try {
    data = await res.json();
  } catch {
    throw new ApiError("invalid_response", "Response was not valid JSON");
  }
  return { ...normalizeDetectResponse(data, imageSize), isMock: false };
}

/** GET /health. Resolves to true/false, never throws. */
export async function checkHealth() {
  if (CONFIG.USE_MOCK_API) return true;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(url("/health"), { signal: controller.signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Raw backend JSON -> { detections, counts, total, annotatedSrc }
 * detection = { label, category, confidence (0-1 | null), box ({x,y,w,h} as 0-1 fractions | null) }
 */
export function normalizeDetectResponse(data, imageSize) {
  const M = RESPONSE_MAP;
  const list = Array.isArray(data) ? data : data && data[firstKey(data, M.detectionsKeys)];
  const invalid = (why) => new ApiError("invalid_response", why);

  if (!Array.isArray(list)) {
    // Fallback: backend returned only totals/counts.
    const rawCounts = data && data[firstKey(data, M.countsKeys)];
    if (rawCounts && typeof rawCounts === "object") {
      const counts = emptyCounts();
      let total = 0;
      for (const [label, n] of Object.entries(rawCounts)) {
        if (!Number.isFinite(n)) throw invalid("counts contains a non-number");
        counts[categoryFor(label)] += n;
        total += n;
      }
      return { detections: [], counts, total, annotatedSrc: toImageSrc(data) };
    }
    throw invalid("No detections array found. Check RESPONSE_MAP.detectionsKeys in api.js");
  }

  const detections = list.map((d, i) => {
    const label = d && d[firstKey(d, M.labelKeys)];
    if (label === undefined) throw invalid(`Detection ${i} has no label. Check RESPONSE_MAP.labelKeys`);
    const confKey = firstKey(d, M.confidenceKeys);
    let confidence = confKey ? Number(d[confKey]) : null;
    if (confidence !== null) confidence = Number.isFinite(confidence) ? (confidence > 1 ? confidence / 100 : confidence) : null;
    return { label: String(label), category: categoryFor(label), confidence, box: toBox(d, imageSize) };
  });

  const counts = emptyCounts();
  detections.forEach((d) => (counts[d.category] += 1));
  return { detections, counts, total: detections.length, annotatedSrc: toImageSrc(data) };
}

function toBox(d, size) {
  const M = RESPONSE_MAP;
  const key = firstKey(d, M.boxKeys);
  if (!key) return null;
  let v = d[key];
  if (v && !Array.isArray(v) && typeof v === "object") v = [v.x1, v.y1, v.x2, v.y2];
  if (!Array.isArray(v) || v.length !== 4 || v.some((n) => !Number.isFinite(Number(n)))) return null;
  v = v.map(Number);

  let x, y, w, h;
  if (M.boxFormat === "xyxy") [x, y, w, h] = [v[0], v[1], v[2] - v[0], v[3] - v[1]];
  else if (M.boxFormat === "cxcywh") [x, y, w, h] = [v[0] - v[2] / 2, v[1] - v[3] / 2, v[2], v[3]];
  else [x, y, w, h] = v;

  if (M.boxUnits === "pixels") {
    if (!size || !size.width || !size.height) return null;
    [x, w] = [x / size.width, w / size.width];
    [y, h] = [y / size.height, h / size.height];
  }
  return { x, y, w, h };
}

function toImageSrc(data) {
  const key = firstKey(data, RESPONSE_MAP.annotatedKeys);
  const v = key && data[key];
  if (typeof v !== "string" || !v) return null;
  if (/^(data:|https?:)/.test(v)) return v;
  if (v.startsWith("/")) return CONFIG.API_BASE_URL + v;
  return `data:image/jpeg;base64,${v}`;
}
