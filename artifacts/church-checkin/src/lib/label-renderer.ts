import { format } from "date-fns";
import type { LabelData } from "@workspace/api-client-react";

const DEFAULT_ORGANIZATION_NAME = "Anchor Events - Check In and Registration";

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
// SVG icons — pure black stroke, no gray
// ---------------------------------------------------------------------------

const PERSON_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#000000" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;flex-shrink:0;"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;

const USERS_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#000000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;flex-shrink:0;"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`;

// ---------------------------------------------------------------------------
// Label renderer
// ---------------------------------------------------------------------------

/**
 * Renders a single 90mm × 62mm landscape label.
 * All colors are pure black (#000000) on white (#ffffff) so that Brother
 * Black/Red media does not interpret grays as red or produce dithered output.
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
    ? `<div style="display:inline-flex;align-items:center;gap:1.2mm;font-size:6.5pt;font-weight:700;color:#000000;background:#ffffff;border-radius:9999px;padding:0.7mm 2.5mm;border:1.5px solid #000000;white-space:nowrap;margin-bottom:1.5mm;align-self:flex-start;">${USERS_ICON}&nbsp;${escHtml(label.room)}</div>`
    : "";

  const allergyLine = label.allergies
    ? `<div style="font-size:7pt;color:#000000;margin-top:2mm;line-height:1.3;"><strong style="font-weight:800;color:#000000;">Allergies:</strong>&nbsp;${escHtml(label.allergies)}</div>`
    : "";

  const guardianDisplay = label.guardianName ? escHtml(label.guardianName) : "—";

  const codeColumn = label.labelCode
    ? (() => {
        const codeChars = label.labelCode
          .split("")
          .map(
            (ch) =>
              `<span style="font-family:'Courier New',Courier,monospace;font-size:18pt;font-weight:900;color:#000000;line-height:1;letter-spacing:0.05em;">${escHtml(ch)}</span>`
          )
          .join("");
        return `<div style="flex-shrink:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:2.5mm 3mm 2.5mm 1mm;gap:1mm;">
      <span style="font-size:5pt;font-weight:700;color:#000000;text-transform:uppercase;letter-spacing:0.12em;white-space:nowrap;">Pickup</span>
      <div style="background:#ffffff;color:#000000;border:2px solid #000000;border-radius:4px;padding:1.5mm 2.5mm;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0.5mm;">${codeChars}</div>
    </div>`;
      })()
    : "";

  return `
<div style="-webkit-print-color-adjust:exact;print-color-adjust:exact;width:90mm;height:62mm;box-sizing:border-box;font-family:Arial,Helvetica,sans-serif;background:#ffffff;border:1px solid #000000;border-radius:3px;color:#000000;overflow:hidden;display:flex;flex-direction:column;">

  <!-- Header (full width) -->
  <div style="padding:2mm 3.5mm;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #000000;flex-shrink:0;">
    <span style="font-size:6.5pt;font-weight:800;color:#000000;text-transform:uppercase;letter-spacing:0.1em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:50mm;">${escHtml(label.organizationName || DEFAULT_ORGANIZATION_NAME)}</span>
    <span style="font-size:6pt;font-weight:600;color:#000000;white-space:nowrap;flex-shrink:0;">${escHtml(dateStr + counter)}</span>
  </div>

  <!-- Middle: names left, code right (omitted for simple name labels) -->
  <div style="flex:1;display:flex;flex-direction:row;min-height:0;overflow:hidden;">

    <!-- Left: names + badges -->
    <div style="flex:1;display:flex;flex-direction:column;justify-content:center;padding:2mm 2mm 2mm 3.5mm;min-width:0;overflow:hidden;">
      ${roomPill}
      <div style="font-size:${fnSize};font-weight:900;line-height:0.93;color:#000000;letter-spacing:-0.02em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escHtml(firstName)}</div>
      ${lastName ? `<div style="font-size:${lnSize};font-weight:700;color:#000000;line-height:1.2;margin-top:1mm;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escHtml(lastName)}</div>` : ""}
      ${allergyLine}
    </div>

    ${codeColumn}

  </div>

  ${label.guardianName ? `<!-- Footer (full width) -->
  <div style="border-top:1px solid #000000;padding:1.8mm 3.5mm;display:flex;align-items:center;gap:1.5mm;flex-shrink:0;">
    ${PERSON_ICON}
    <span style="font-size:7pt;color:#000000;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"><strong style="font-weight:700;color:#000000;">Parent/Guardian:</strong>&nbsp;${guardianDisplay}</span>
  </div>` : ""}

</div>`.trim();
}

/**
 * Renders the parent/guardian pickup stub — 90mm × 62mm, page 2 of the
 * child security label pair. The pickup code is the dominant element so
 * the volunteer can match it quickly at checkout.
 */
export function renderParentPickupLabelHtml(label: LabelData): string {
  const dateStr = format(new Date(label.checkinDate), "MMM d, h:mm a");
  const nameParts = label.childName.trim().split(/\s+/);
  const firstName = nameParts[0] ?? label.childName;
  const lastName = nameParts.slice(1).join(" ");

  const codeChars = label.labelCode
    .split("")
    .map(
      (ch) =>
        `<span style="font-family:'Courier New',Courier,monospace;font-size:32pt;font-weight:900;color:#000000;line-height:1;letter-spacing:0.04em;">${escHtml(ch)}</span>`
    )
    .join("");

  return `
<div style="-webkit-print-color-adjust:exact;print-color-adjust:exact;width:90mm;height:62mm;box-sizing:border-box;font-family:Arial,Helvetica,sans-serif;background:#ffffff;border:1px solid #000000;border-radius:3px;color:#000000;overflow:hidden;display:flex;flex-direction:column;">

  <!-- Header -->
  <div style="padding:2mm 3.5mm;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #000000;flex-shrink:0;">
    <span style="font-size:6.5pt;font-weight:800;color:#000000;text-transform:uppercase;letter-spacing:0.1em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:50mm;">${escHtml(label.organizationName || DEFAULT_ORGANIZATION_NAME)}</span>
    <span style="font-size:6pt;font-weight:600;color:#000000;white-space:nowrap;flex-shrink:0;">${escHtml(dateStr)}</span>
  </div>

  <!-- Body -->
  <div style="flex:1;display:flex;flex-direction:column;justify-content:space-between;padding:2mm 3.5mm 2.5mm;min-height:0;overflow:hidden;">

    <!-- Top: pill + child name -->
    <div>
      <div style="display:inline-flex;align-items:center;gap:1.2mm;font-size:5.5pt;font-weight:800;color:#000000;border:1.5px solid #000000;border-radius:9999px;padding:0.6mm 2.2mm;white-space:nowrap;margin-bottom:1.8mm;">${PERSON_ICON}&nbsp;PARENT PICKUP LABEL</div>
      <div style="font-size:10pt;font-weight:700;color:#000000;line-height:1.25;">${escHtml(firstName)}${lastName ? ` ${escHtml(lastName)}` : ""}</div>
    </div>

    <!-- Center: large pickup code -->
    <div style="display:flex;justify-content:center;align-items:center;">
      <div style="display:flex;gap:1mm;">${codeChars}</div>
    </div>

    <!-- Footer: instruction -->
    <div style="font-size:6pt;font-weight:700;color:#000000;text-transform:uppercase;letter-spacing:0.1em;">Present this label at pickup</div>

  </div>

</div>`.trim();
}

/**
 * Prints labels from the current app window.
 *
 * Injects a #single-label-print-root div directly onto document.body (outside
 * the React #root). Print CSS hides #root entirely, so the only document content
 * is the label pages — exactly one page per label (two pages per child for
 * security check-out labels: child label + parent pickup label).
 */
export function printLabels(labels: LabelData[], labelType?: string): void {
  if (labels.length === 0) return;

  const isSecurityLabel = labelType === "child_security";

  let container = document.getElementById("single-label-print-root");
  if (!container) {
    container = document.createElement("div");
    container.id = "single-label-print-root";
    document.body.appendChild(container);
  }

  const pages: string[] = [];
  labels.forEach((label, i) => {
    pages.push(`<div style="width:90mm;height:62mm;overflow:hidden;page-break-after:always;break-after:always;">${renderLabelHtml(label, i, labels.length)}</div>`);
    if (isSecurityLabel && label.labelCode) {
      pages.push(`<div style="width:90mm;height:62mm;overflow:hidden;page-break-after:always;break-after:always;">${renderParentPickupLabelHtml(label)}</div>`);
    }
  });

  // Remove trailing page-break from the last page to avoid a blank extra page.
  if (pages.length > 0) {
    pages[pages.length - 1] = pages[pages.length - 1]
      .replace(/page-break-after:always;break-after:always;/, "");
  }

  container.innerHTML = pages.join("");

  // Let the browser finish layout before opening the print dialog.
  setTimeout(() => window.print(), 0);

  window.addEventListener("afterprint", () => { container!.innerHTML = ""; }, { once: true });
}

function escHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
