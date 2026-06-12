import { format } from "date-fns";
import type { LabelData } from "@workspace/api-client-react";

// ---------------------------------------------------------------------------
// Name-sizing helpers
// ---------------------------------------------------------------------------

export function firstNameFontSize(name: string): string {
  const n = name.length;
  if (n <= 5)  return "52pt";
  if (n <= 7)  return "42pt";
  if (n <= 9)  return "34pt";
  if (n <= 12) return "27pt";
  return "21pt";
}

export function lastNameFontSize(name: string): string {
  if (name.length <= 14) return "16pt";
  if (name.length <= 20) return "13pt";
  return "10pt";
}

// ---------------------------------------------------------------------------
// SVG icons
// ---------------------------------------------------------------------------

const PERSON_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;flex-shrink:0;"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;

const USERS_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;flex-shrink:0;"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`;

// ---------------------------------------------------------------------------
// Label renderer
// ---------------------------------------------------------------------------

/**
 * Renders a single 90mm × 62mm landscape label.
 *
 * Layout (outer column):
 *   Header  — full-width: org name + date
 *   Middle  — flex row (flex:1):
 *               Left: room pill → first name → last name → allergies
 *               Right: dark rounded pill with code chars stacked vertically
 *   Footer  — full-width: person icon + Parent/Guardian
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
    ? `<div style="display:inline-flex;align-items:center;gap:1.2mm;font-size:6.5pt;font-weight:600;color:#374151;background:#fff;border-radius:9999px;padding:0.7mm 2.5mm;border:1px solid #9ca3af;white-space:nowrap;margin-bottom:1.5mm;align-self:flex-start;">${USERS_ICON}&nbsp;${escHtml(label.room)}</div>`
    : "";

  const allergyLine = label.allergies
    ? `<div style="font-size:7pt;color:#374151;margin-top:2mm;line-height:1.3;"><strong style="font-weight:700;color:#111827;">Allergies:</strong>&nbsp;${escHtml(label.allergies)}</div>`
    : "";

  const guardianDisplay = label.guardianName ? escHtml(label.guardianName) : "—";

  const codeChars = label.labelCode
    .split("")
    .map(
      (ch) =>
        `<span style="font-family:'Courier New',Courier,monospace;font-size:20pt;font-weight:900;color:#fff;line-height:1;letter-spacing:0;">${escHtml(ch)}</span>`
    )
    .join("");

  return `
<div style="width:90mm;height:62mm;box-sizing:border-box;font-family:Arial,Helvetica,sans-serif;background:#fff;border:1px solid #d1d5db;border-radius:3px;color:#111827;overflow:hidden;display:flex;flex-direction:column;">

  <!-- Header (full width) -->
  <div style="padding:2mm 3.5mm;display:flex;justify-content:space-between;align-items:center;border-bottom:0.5px solid #d1d5db;flex-shrink:0;">
    <span style="font-size:6.5pt;font-weight:800;color:#111827;text-transform:uppercase;letter-spacing:0.1em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:50mm;">${escHtml(label.organizationName || "Church Check-In")}</span>
    <span style="font-size:6pt;color:#6b7280;white-space:nowrap;flex-shrink:0;">${escHtml(dateStr + counter)}</span>
  </div>

  <!-- Middle: names left + code right -->
  <div style="flex:1;display:flex;flex-direction:row;min-height:0;overflow:hidden;">

    <!-- Left: names + badges -->
    <div style="flex:1;display:flex;flex-direction:column;justify-content:center;padding:2mm 2mm 2mm 3.5mm;min-width:0;overflow:hidden;">
      ${roomPill}
      <div style="font-size:${fnSize};font-weight:900;line-height:0.93;color:#111827;letter-spacing:-0.02em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escHtml(firstName)}</div>
      ${lastName ? `<div style="font-size:${lnSize};font-weight:700;color:#111827;line-height:1.2;margin-top:1mm;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escHtml(lastName)}</div>` : ""}
      ${allergyLine}
    </div>

    <!-- Right: dark rounded code strip, inset within middle section -->
    <div style="flex-shrink:0;display:flex;align-items:center;padding:2.5mm 3mm 2.5mm 0;">
      <div style="width:14mm;height:100%;background:#111827;border-radius:4px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0.5mm;padding:2mm 0;box-sizing:border-box;">
        ${codeChars}
      </div>
    </div>

  </div>

  <!-- Footer (full width) -->
  <div style="border-top:0.5px solid #d1d5db;padding:1.8mm 3.5mm;display:flex;align-items:center;gap:1.5mm;flex-shrink:0;">
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
