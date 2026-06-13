// QZ Tray integration — silent label printing via local desktop app.
// QZ Tray runs on the kiosk machine and exposes a WebSocket API that this module connects to.
// All QZ code runs browser-side only — never call from server/SSR context.

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — qz-tray has no official TS type declarations
import qz from "qz-tray";

let _connected = false;
let _lastError: string | undefined;

export function getQZLastError(): string | undefined {
  return _lastError;
}

// localhost.qz.io resolves to 127.0.0.1 and QZ Tray's certificate covers it,
// making it work from HTTPS pages without requiring the user to trust a self-signed cert.
// Try it before bare localhost for that reason.
export const QZ_CONNECT_OPTIONS = {
  host: ["localhost.qz.io", "localhost"],
  port: { secure: [8181, 8282, 8383, 8484], insecure: [8182, 8283, 8384, 8485] },
  usingSecure: true,
  retries: 0,
  delay: 0,
};

function setupSecurity() {
  qz.security.setCertificatePromise((_resolve: (v: string) => void) => {
    _resolve("");
  });
  qz.security.setSignaturePromise((toSign: string) => {
    void toSign;
    return (_resolve: (v: string) => void) => {
      _resolve("");
    };
  });
}

/** Connect to the local QZ Tray WebSocket. Returns true on success. Never throws. */
export async function connectQZ(): Promise<boolean> {
  try {
    if (qz.websocket.isActive()) {
      _lastError = undefined;
      _connected = true;
      return true;
    }
    setupSecurity();
    await qz.websocket.connect(QZ_CONNECT_OPTIONS);
    _lastError = undefined;
    _connected = true;
    return true;
  } catch (err) {
    _lastError = err instanceof Error ? err.message : String(err);
    console.error("[QZ Tray] Connection failed:", _lastError, "\nOptions:", QZ_CONNECT_OPTIONS);
    _connected = false;
    return false;
  }
}

/** Disconnect from QZ Tray if connected. */
export function disconnectQZ(): void {
  try {
    if (qz.websocket.isActive()) {
      qz.websocket.disconnect();
    }
  } catch {
    // ignore
  }
  _connected = false;
}

/** Returns true if currently connected to QZ Tray. */
export function isQZConnected(): boolean {
  try {
    return _connected && qz.websocket.isActive();
  } catch {
    return false;
  }
}

/** Returns true if the qz-tray library is loaded. */
export function isQZLoaded(): boolean {
  try {
    return typeof qz !== "undefined" && typeof qz.websocket !== "undefined";
  } catch {
    return false;
  }
}

/** Returns all printer names available on the OS. Requires active connection. */
export async function listPrinters(): Promise<string[]> {
  try {
    // No argument → query is undefined → QZ Tray returns all printers.
    // Passing null sends {"query":null} which QZ Tray treats as a filter and returns nothing.
    const result = await qz.printers.find();
    return Array.isArray(result) ? result : [result].filter(Boolean);
  } catch (err) {
    console.error("[QZ Tray] listPrinters failed:", err);
    return [];
  }
}

/** Returns true if the named printer is found in the OS printer list. */
export async function findPrinter(printerName: string): Promise<boolean> {
  try {
    const result = await qz.printers.find(printerName);
    return Boolean(result);
  } catch {
    return false;
  }
}

/** Prints a sample label to verify the printer is working. */
export async function printTestLabel(printerName: string): Promise<void> {
  const { renderLabelsDocument } = await import("./label-renderer");
  const html = renderLabelsDocument([
    {
      childName: "Test Child",
      guardianName: "Test Guardian",
      labelCode: "TEST",
      checkinDate: new Date().toISOString(),
      room: "Room 101",
      allergies: "None",
      specialNeeds: null,
      organizationName: "Church Check-In",
    },
  ]);
  await printLabel(printerName, html);
}

/**
 * Print a label HTML string to the named printer via QZ Tray.
 * The HTML should be a complete self-contained document (use renderLabelsDocument).
 * Throws a descriptive error on failure.
 */
export async function printLabel(printerName: string, labelHtml: string): Promise<void> {
  if (!isQZConnected()) {
    const ok = await connectQZ();
    if (!ok) throw new Error("QZ Tray is not running");
  }
  const found = await findPrinter(printerName);
  if (!found) throw new Error(`Printer "${printerName}" not found`);

  // Brother QL-810W: 62mm tape (2.44") × 90mm cut length (3.54").
  // HTML content is 90mm wide × 62mm tall (landscape). QZ Tray orientation:landscape
  // rotates the content 90° so it prints correctly on the portrait tape feed.
  const config = qz.configs.create(printerName, {
    size: { width: 2.44, height: 3.54 },
    units: "in",
    density: 300,
    orientation: "landscape",
    scaleContent: false,
    interpolation: "bicubic",
  });

  await qz.print(config, [
    {
      type: "html",
      format: "plain",
      data: labelHtml,
    },
  ]);
}
