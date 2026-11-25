import { CATEGORIES } from "./config.js";
import { loadImage } from "./imaging.js";

const safe = (s) => String(s).replace(/[^\x20-\x7E\u00A0-\u00FF]/g, "?"); // jsPDF core fonts are Latin-1 only
const pct = (c) => (c == null ? "n/a" : `${Math.round(c * 100)}%`);

/** Builds and downloads the inspection report from a scan result (see scan.js for its shape). */
export async function generateReport(scan) {
  const jsPDF = window.jspdf && window.jspdf.jsPDF;
  if (!jsPDF) throw new Error("PDF library not loaded");

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const PAGE_W = 210, PAGE_H = 297, M = 18, W = PAGE_W - M * 2;
  let y = M;
  const ensure = (h) => { if (y + h > PAGE_H - M) { doc.addPage(); y = M; } };
  const text = (str, size, style = "normal", color = [35, 40, 36]) => {
    doc.setFont("helvetica", style); doc.setFontSize(size); doc.setTextColor(...color);
    doc.text(safe(str), M, y);
  };

  text("CleanSight Inspection Report", 20, "bold", [31, 61, 43]);
  y += 8;
  text(`Inspected: ${new Date(scan.timestamp).toLocaleString()}`, 10, "normal", [90, 98, 92]);
  y += 5;
  if (scan.fileName) { text(`Image: ${scan.fileName}`, 10, "normal", [90, 98, 92]); y += 5; }
  if (scan.isMock) { text("DEMO DATA - not a real detection.", 10, "bold", [183, 121, 31]); y += 5; }
  doc.setDrawColor(237, 232, 219); doc.line(M, y, M + W, y); y += 9;

  text(`Total detected objects: ${scan.total}`, 13, "bold"); y += 9;
  text("By category", 11, "bold"); y += 6;
  for (const c of CATEGORIES) {
    text(c.name, 10); doc.text(String(scan.counts[c.name] || 0), M + 60, y, { align: "right" }); y += 5.5;
  }
  y += 5;

  for (const [title, src] of [["Original image", scan.originalImage], ["Annotated image", scan.annotatedImage]]) {
    if (!src) continue;
    const img = await loadImage(src);
    const w = Math.min(W, (img.naturalWidth / img.naturalHeight) * 95);
    const h = w * (img.naturalHeight / img.naturalWidth);
    ensure(h + 10);
    text(title, 11, "bold"); y += 3;
    doc.addImage(src, "JPEG", M, y, w, h);
    y += h + 8;
  }

  if (scan.detections.length) {
    ensure(20);
    text("Detections", 11, "bold"); y += 6;
    doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(90, 98, 92);
    doc.text("Label", M, y); doc.text("Category", M + 70, y); doc.text("Confidence", M + W, y, { align: "right" });
    y += 5;
    scan.detections.forEach((d) => {
      ensure(6);
      doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(35, 40, 36);
      doc.text(safe(d.label), M, y); doc.text(d.category, M + 70, y); doc.text(pct(d.confidence), M + W, y, { align: "right" });
      y += 5.5;
    });
  } else {
    ensure(8);
    text("No waste was detected in this image.", 10);
  }

  const d = new Date(scan.timestamp), p = (n) => String(n).padStart(2, "0");
  doc.save(`cleansight-report-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.pdf`);
}
