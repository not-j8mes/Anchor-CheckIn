// QZ Tray integration — silent label printing via local desktop app.
// QZ Tray runs on the kiosk machine and exposes a WebSocket API that this module connects to.
// Falls back gracefully when QZ Tray is not installed/running.

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — qz-tray has no official TS type declarations
import qz from "qz-tray";

let _connected = false;

function setupSecurity() {
  // No-op certificate resolution for unsigned (development) mode.
  // QZ Tray will show a one-time trust prompt the first time.
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
      _connected = true;
      return true;
    }
    setupSecurity();
    await qz.websocket.connect({ retries: 1, delay: 0.5 });
    _connected = true;
    return true;
  } catch {
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

/** Returns true if the named printer is found in the OS printer list. */
export async function findPrinter(printerName: string): Promise<boolean> {
  try {
    const result = await qz.printers.find(printerName);
    return Boolean(result);
  } catch {
    return false;
  }
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

/**
 * Test the QZ Tray connection and printer availability without printing.
 */
export async function testPrinter(printerName: string): Promise<{
  connected: boolean;
  printerFound: boolean;
  error?: string;
}> {
  try {
    const conn = await connectQZ();
    if (!conn) {
      return { connected: false, printerFound: false, error: "QZ Tray not running" };
    }
    const found = await findPrinter(printerName);
    return { connected: true, printerFound: found };
  } catch (err) {
    return {
      connected: false,
      printerFound: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
