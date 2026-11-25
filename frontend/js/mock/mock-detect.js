/**
 * DEMO DATA ONLY. Used when CONFIG.USE_MOCK_API is true, for layout testing.
 * Output is deliberately in the shape RESPONSE_MAP expects, so the real mapping code is exercised.
 * Results built from this are labelled "Demo" in the UI and never saved to history.
 */
export async function mockDetect({ width, height }) {
  await new Promise((r) => setTimeout(r, 900));
  const box = (fx, fy, fw, fh) => [fx * width, fy * height, (fx + fw) * width, (fy + fh) * height];
  return {
    detections: [
      { label: "plastic_bottle", confidence: 0.91, bbox: box(0.12, 0.55, 0.08, 0.2) },
      { label: "can", confidence: 0.84, bbox: box(0.45, 0.7, 0.07, 0.12) },
      { label: "paper", confidence: 0.77, bbox: box(0.7, 0.62, 0.1, 0.1) },
    ],
  };
}
