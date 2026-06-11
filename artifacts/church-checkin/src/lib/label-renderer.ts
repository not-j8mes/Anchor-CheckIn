import { format } from "date-fns";
import type { LabelData } from "@workspace/api-client-react";

/**
 * Renders a single label as a self-contained HTML string with inline styles only.
 * Used by both LabelPrintDialog (preview) and QZ Tray (silent print).
 */
export function renderLabelHtml(label: LabelData, index: number, total: number): string {
  const dateStr = format(new Date(label.checkinDate), "MMM d, h:mm a");
  const counter = total > 1 ? `${index + 1}/${total}` : "";

  const allergyRow = label.allergies
    ? `<div style="font-size:7.5pt;font-weight:700;color:#dc2626;background:#fef2f2;border:0.5px solid #fca5a5;border-radius:2px;padding:0.8mm 1.5mm;margin-bottom:1mm;">&#9888; ALLERGY: ${escHtml(label.allergies)}</div>`
    : "";
  const specialNeedsRow = label.specialNeeds
    ? `<div style="font-size:7.5pt;font-weight:700;color:#b45309;background:#fffbeb;border:0.5px solid #fcd34d;border-radius:2px;padding:0.8mm 1.5mm;margin-bottom:1mm;">&#x2139; ${escHtml(label.specialNeeds)}</div>`
    : "";
  const alertsBlock =
    allergyRow || specialNeedsRow
      ? `<div style="margin-bottom:2mm;">${allergyRow}${specialNeedsRow}</div>`
      : "";

  const roomGuardian = [label.room, label.guardianName].filter(Boolean).join(" · ");
  const stubLine = label.room ? `${escHtml(label.childName)} &middot; ${escHtml(label.room)}` : escHtml(label.childName);

  return `
<div style="width:62mm;box-sizing:border-box;font-family:Arial,sans-serif;border:1px solid #d1d5db;background:#fff;color:#000;overflow:hidden;">
  <div style="padding:3mm 3.5mm 2mm;">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5mm;">
      <span style="font-size:6pt;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;">${escHtml(label.organizationName || "Church Check-In")}</span>
      <span style="font-size:6pt;color:#9ca3af;font-family:monospace;">
        ${dateStr}${counter ? `<span style="margin-left:1.5mm;color:#2563eb;font-weight:700;">${counter}</span>` : ""}
      </span>
    </div>
    <div style="font-size:20pt;font-weight:800;line-height:1.1;letter-spacing:-0.01em;margin-bottom:1mm;">${escHtml(label.childName)}</div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2mm;">
      <span style="font-size:9pt;font-weight:600;color:#374151;">${escHtml(label.room || "No Room Assigned")}</span>
      <span style="font-size:8pt;color:#6b7280;">${escHtml(label.guardianName || "")}</span>
    </div>
    ${alertsBlock}
    <div style="display:flex;justify-content:flex-end;margin-bottom:2mm;">
      <div style="font-family:monospace;font-size:18pt;font-weight:800;letter-spacing:0.12em;background:#f3f4f6;padding:1mm 2.5mm;border-radius:2px;border:0.5px solid #d1d5db;">${escHtml(label.labelCode)}</div>
    </div>
  </div>
  <div style="border-top:1.5px dashed #d1d5db;margin:0 3mm;"></div>
  <div style="background:#f9fafb;padding:2mm 3.5mm;display:flex;justify-content:space-between;align-items:center;">
    <div>
      <div style="font-size:5.5pt;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:0.8mm;">Pickup Security Stub</div>
      <div style="font-size:8pt;font-weight:600;">${escHtml(label.guardianName || "")}</div>
      <div style="font-size:6.5pt;color:#6b7280;">${stubLine}</div>
    </div>
    <div style="font-family:monospace;font-size:15pt;font-weight:800;letter-spacing:0.1em;color:#1f2937;">${escHtml(label.labelCode)}</div>
  </div>
</div>`.trim();
}

/**
 * Wraps multiple labels in a full HTML document ready for printing or QZ Tray.
 */
export function renderLabelsDocument(labels: LabelData[]): string {
  const cards = labels
    .map((label, i) => renderLabelHtml(label, i, labels.length))
    .join("\n");
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    body { margin: 0; padding: 0; }
    @page { size: 62mm auto; margin: 0; }
  </style></head><body>${cards}</body></html>`;
}

function escHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
