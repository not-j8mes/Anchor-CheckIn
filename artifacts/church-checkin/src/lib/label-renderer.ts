import { format } from "date-fns";
import type { LabelData } from "@workspace/api-client-react";

// ---------------------------------------------------------------------------
// Name-sizing helpers
// ---------------------------------------------------------------------------

/**
 * Font size for the first name in the left column (~59mm usable width).
 * Column = 90mm label − 7mm h-padding − 2mm gap − 22mm code column.
 */
export function firstNameFontSize(name: string): string {
  const n = name.length;
  if (n <= 6)  return "44pt";
  if (n <= 8)  return "36pt";
  if (n <= 10) return "30pt";
  if (n <= 13) return "24pt";
  return "20pt";
}

export function lastNameFontSize(name: string): string {
  if (name.length <= 14) return "14pt";
  if (name.length <= 20) return "12pt";
  return "10pt";
}

// ---------------------------------------------------------------------------
// SVG icons (inline, no external deps)
// ---------------------------------------------------------------------------

const PERSON_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;flex-shrink:0;"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;

const USERS_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;flex-shrink:0;"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`;

// ---------------------------------------------------------------------------
// Label renderer
// ---------------------------------------------------------------------------

/**
 * Renders a single 90mm × 62mm landscape label as a self-contained HTML
 * string with inline styles only.
 *
 * Layout:
 *   Header  — org name (bold navy, uppercase) + date/time (gray)
 *   Body    — left col: first name (large navy), last name, room pill + alerts
 *             right col: "Pickup Code" label + bordered code box, centered vertically
 *   Footer  — person icon + "Parent/Guardian: name"  (no dashed stub)
 */
export function renderLabelHtml(label: LabelData, index: number, total: number): string {
  const dateStr = format(new Date(label.checkinDate), "MMM d, h:mm a");
  const counter = total > 1 ? ` · ${index + 1}/${total}` : "";

  const nameParts = label.childName.trim().split(/\s+/);
  const firstName = nameParts[0] ?? label.childName;
  const lastName = nameParts.slice(1).join(" ");

  const fnSize = firstNameFontSize(firstName);
  const lnSize = lastNameFontSize(lastName);

  const roomPill = label.room
    ? `<span style="display:inline-flex;align-items:center;gap:1.5mm;font-size:7pt;font-weight:600;color:#374151;background:#f1f5f9;border-radius:9999px;padding:0.9mm 2.5mm;border:0.5px solid #e2e8f0;white-space:nowrap;">${USERS_ICON}&nbsp;${escHtml(label.room)}</span>`
    : "";

  const allergyBadge = label.allergies
    ? `<span style="display:inline-block;font-size:6pt;font-weight:700;color:#dc2626;background:#fef2f2;border:0.5px solid #fca5a5;border-radius:9999px;padding:0.5mm 2mm;white-space:nowrap;">&#9888; Allergy</span>`
    : "";
  const medicalBadge = label.specialNeeds
    ? `<span style="display:inline-block;font-size:6pt;font-weight:700;color:#b45309;background:#fffbeb;border:0.5px solid #fcd34d;border-radius:9999px;padding:0.5mm 2mm;white-space:nowrap;">&#x2139; Medical</span>`
    : "";

  const badgesRow =
    roomPill || allergyBadge || medicalBadge
      ? `<div style="display:flex;align-items:center;gap:1.5mm;margin-top:2mm;flex-wrap:nowrap;overflow:hidden;">${roomPill}${allergyBadge}${medicalBadge}</div>`
      : "";

  const guardianDisplay = label.guardianName ? escHtml(label.guardianName) : "—";

  return `
<div style="width:90mm;height:62mm;box-sizing:border-box;font-family:Arial,Helvetica,sans-serif;background:#fff;border:1px solid #d1d5db;border-radius:3px;color:#1a2e4a;overflow:hidden;display:flex;flex-direction:column;">

  <!-- Header: org name + date -->
  <div style="padding:1.8mm 3.5mm;display:flex;justify-content:space-between;align-items:center;border-bottom:0.5px solid #e5e7eb;flex-shrink:0;">
    <span style="font-size:6pt;font-weight:800;color:#1a2e4a;text-transform:uppercase;letter-spacing:0.08em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:56mm;">${escHtml(label.organizationName || "Church Check-In")}</span>
    <span style="font-size:5.5pt;color:#9ca3af;white-space:nowrap;flex-shrink:0;">${escHtml(dateStr + counter)}</span>
  </div>

  <!-- Main body: names left, code centered-right -->
  <div style="flex:1;display:flex;padding:2.5mm 3.5mm 2mm 3.5mm;gap:2mm;min-height:0;overflow:hidden;">

    <!-- Left: first name, last name, room + badges -->
    <div style="flex:1;display:flex;flex-direction:column;min-width:0;overflow:hidden;">
      <div style="font-size:${fnSize};font-weight:900;line-height:0.95;color:#1a2e4a;letter-spacing:-0.02em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escHtml(firstName)}</div>
      ${lastName ? `<div style="font-size:${lnSize};font-weight:700;color:#1a2e4a;line-height:1.2;margin-top:1mm;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escHtml(lastName)}</div>` : ""}
      ${badgesRow}
    </div>

    <!-- Right: pickup code, centered vertically -->
    <div style="flex-shrink:0;width:22mm;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1.2mm;">
      <span style="font-size:5.5pt;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.07em;white-space:nowrap;">Pickup Code</span>
      <div style="border:1.5px solid #1a2e4a;border-radius:3px;padding:1.5mm 1.5mm;text-align:center;">
        <span style="font-family:'Courier New',Courier,monospace;font-size:12pt;font-weight:800;letter-spacing:0.1em;color:#1a2e4a;display:block;line-height:1;">${escHtml(label.labelCode)}</span>
      </div>
    </div>
  </div>

  <!-- Footer: guardian (no dashed stub) -->
  <div style="border-top:0.5px solid #e5e7eb;padding:1.8mm 3.5mm;display:flex;align-items:center;gap:1.5mm;flex-shrink:0;">
    ${PERSON_ICON}
    <span style="font-size:6.5pt;color:#374151;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"><strong style="font-weight:700;">Parent/Guardian:</strong>&nbsp;${guardianDisplay}</span>
  </div>

</div>`.trim();
}

/**
 * Wraps labels in a full HTML document for window.print() or QZ Tray.
 */
export function renderLabelsDocument(labels: LabelData[]): string {
  const cards = labels
    .map((label, i) => renderLabelHtml(label, i, labels.length))
    .join("\n");
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; width: 90mm; }
    @page { size: 90mm 62mm; margin: 0; }
  </style></head><body>${cards}</body></html>`;
}

function escHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
