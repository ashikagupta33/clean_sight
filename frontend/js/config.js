/**
 * CleanSight frontend configuration. This is the ONLY file that holds environment settings.
 * Backend/ML team: edit this file and the RESPONSE_MAP block in api.js. Nothing else.
 */
export const CONFIG = {
  API_BASE_URL: "http://localhost:8000", // FastAPI base URL, no trailing slash
  REQUEST_TIMEOUT_MS: 60000,
  MAX_FILE_MB: 10,
  ALLOWED_TYPES: ["image/jpeg", "image/png", "image/webp"],
  // Layout testing only. When true, detection is generated locally (js/mock/) and every
  // result is labelled as demo data and is NOT saved to history. Keep false in real use.
  USE_MOCK_API: false,
};

/** Display categories, in chart order. Colours come from the CleanSight palette. */
export const CATEGORIES = [
  { name: "Plastic", color: "#1F3D2B", text: "#FBF9F4" },
  { name: "Paper", color: "#6F8F5E", text: "#FBF9F4" },
  { name: "Metal", color: "#5A625C", text: "#FBF9F4" },
  { name: "Other", color: "#A9BBA3", text: "#232824" },
];

/**
 * Maps a model class label to a display category.
 * The trained model (backend/models/best.onnx) has four classes, mapped like this:
 *   bottle -> Plastic, plastic_wrapper -> Plastic, paper_cardboard -> Paper, can -> Metal.
 * The rules also accept other common names, so a retrained model with more classes still works.
 * A label equal to a category name (case-insensitive) always wins; anything unmatched is "Other".
 */
const CATEGORY_RULES = [
  ["Plastic", /plastic|bottle|bag|cup|wrapper|straw/i],
  ["Paper", /paper|cardboard|carton|tissue|newspaper/i],
  ["Metal", /metal|\bcan\b|\btin\b|foil|alumin/i],
];

export function categoryFor(label) {
  const text = String(label).trim();
  const direct = CATEGORIES.find((c) => c.name.toLowerCase() === text.toLowerCase());
  if (direct) return direct.name;
  const rule = CATEGORY_RULES.find(([, re]) => re.test(text));
  return rule ? rule[0] : "Other";
}

export function emptyCounts() {
  return Object.fromEntries(CATEGORIES.map((c) => [c.name, 0]));
}
