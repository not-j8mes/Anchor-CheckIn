import { format } from "date-fns";
import type { LabelData } from "@workspace/api-client-react";

// ---------------------------------------------------------------------------
// Name-sizing helpers
// ---------------------------------------------------------------------------

export function firstNameFontSize(name: string): string {
  const n = name.length;
  if (n <= 5)  return "54pt";
  if (n <= 7)  return "44pt";
  if (n <= 9)  return "36pt";
  if (n <= 12) return "28pt";
  return "22pt";
}

export function lastNameFontSize(name: string): string {
  if (name.length <= 14) return "17pt";
  if (name.length <= 20) return "14pt";
  return "11pt";
}

// ---------------------------------------------------------------------------
// SVG icons
// ---------------------------------------------------------------------------

const PERSON_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;flex-shrink:0;"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;

const USERS_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#374151" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;flex-shrink:0;"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`;

// ---------------------------------------------------------------------------
// Label renderer
// ---------------------------------------------------------------------------

/**
 * Renders a single 90mm × 62mm landscape label.
 * Pure black & white — no colour fills on badges or backgrounds.
 *
 * Layout:
 *   Header  — org name (bold, uppercase) + date
 *   Body    — left col: first name (large), last name, room pill + alert badges
 *             right col: Pickup Code box, centered vertically
 *   Footer  — person icon + Parent/Guardian
 */
export function renderLabelHtml(label: LabelData, index: number, total: number): string {
  const dateStr = format(new Date(label.checkinDate), "MMM d, h:mm a");
  const counter = total > 1 ? ` · ${index + 1}/${total}` : "";

  const nameParts = label.childName.trim().split(/\s+/);
  const firstName = nameParts[0] ?? label.childName;
  const lastName = nameParts.slice(1).join(" ");

  const fnSize = firstNameFontSize(firstName);
  const lnSize = lastNameFontSize(lastName);

  // B&W pill: white bg, black border, dark text
  const roomPill = label.room
    ? `<span style="display:inline-flex;align-items:center;gap:1.5mm;font-size:7.5pt;font-weight:600;color:#111827;background:#fff;border-radius:9999px;padding:1mm 3mm;border:1px solid #9ca3af;white-space:nowrap;">${USERS_ICON}&nbsp;${escHtml(label.room)}</span>`
    : "";

  // B&W alert badges: white bg, black border, bold text
  const allergyBadge = label.allergies
    ? `<span style="display:inline-block;font-size:6.5pt;font-weight:700;color:#111827;background:#fff;border:1px solid #374151;border-radius:9999px;padding:0.6mm 2.5mm;white-space:nowrap;">&#9888; ALLERGY</span>`
    : "";
  const medicalBadge = label.specialNeeds
    ? `<span style="display:inline-block;font-size:6.5pt;font-weight:700;color:#111827;background:#fff;border:1px solid #374151;border-radius:9999px;padding:0.6mm 2.5mm;white-space:nowrap;">&#x2139; MEDICAL</span>`
    : "";

  const badgesRow =
    roomPill || allergyBadge || medicalBadge
      ? `<div style="display:flex;align-items:center;gap:2mm;margin-top:3mm;flex-wrap:nowrap;overflow:hidden;">${roomPill}${allergyBadge}${medicalBadge}</div>`
      : "";

  const guardianDisplay = label.guardianName ? escHtml(label.guardianName) : "—";

  return `
<div style="width:90mm;height:62mm;box-sizing:border-box;font-family:Arial,Helvetica,sans-serif;background:#fff;border:1px solid #d1d5db;border-radius:3px;color:#111827;overflow:hidden;display:flex;flex-direction:column;">

  <!-- Header -->
  <div style="padding:2mm 4mm;display:flex;justify-content:space-between;align-items:center;border-bottom:0.5px solid #d1d5db;flex-shrink:0;">
    <span style="font-size:6.5pt;font-weight:800;color:#111827;text-transform:uppercase;letter-spacing:0.1em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:56mm;">${escHtml(label.organizationName || "Church Check-In")}</span>
    <span style="font-size:6pt;color:#6b7280;white-space:nowrap;flex-shrink:0;">${escHtml(dateStr + counter)}</span>
  </div>

  <!-- Body: names left | code right -->
  <div style="flex:1;display:flex;padding:3mm 4mm 2.5mm 4mm;gap:3mm;min-height:0;overflow:hidden;">

    <!-- Left: names + badges, vertically centered -->
    <div style="flex:1;display:flex;flex-direction:column;justify-content:center;min-width:0;overflow:hidden;">
      <div style="font-size:${fnSize};font-weight:900;line-height:0.92;color:#111827;letter-spacing:-0.02em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escHtml(firstName)}</div>
      ${lastName ? `<div style="font-size:${lnSize};font-weight:700;color:#111827;line-height:1.2;margin-top:1.5mm;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escHtml(lastName)}</div>` : ""}
      ${badgesRow}
    </div>

    <!-- Right: pickup code, centered -->
    <div style="flex-shrink:0;width:24mm;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1.5mm;">
      <span style="font-size:5.5pt;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.1em;white-space:nowrap;">Pickup Code</span>
      <div style="border:2px solid #111827;border-radius:3px;padding:2mm 2mm;text-align:center;width:100%;box-sizing:border-box;">
        <span style="font-family:'Courier New',Courier,monospace;font-size:13pt;font-weight:800;letter-spacing:0.1em;color:#111827;display:block;line-height:1;">${escHtml(label.labelCode)}</span>
      </div>
    </div>
  </div>

  <!-- Footer -->
  <div style="border-top:0.5px solid #d1d5db;padding:1.8mm 4mm;display:flex;align-items:center;gap:1.5mm;flex-shrink:0;">
    ${PERSON_ICON}
    <span style="font-size:7pt;color:#374151;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"><strong style="font-weight:700;color:#111827;">Parent/Guardian:</strong>&nbsp;${guardianDisplay}</span>
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
