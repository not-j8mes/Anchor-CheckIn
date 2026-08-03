export const PRINT_MODE_ATTRIBUTE = "data-print-mode";
export const PRINT_ROOT_ATTRIBUTE = "data-print-root";

type IsolatedPrintOptions = {
  mode: string;
  root: HTMLElement;
  onAfterPrint?: () => void;
};

let activePrintRoot: HTMLElement | null = null;

export function isPrintActive(): boolean {
  return activePrintRoot !== null || document.body.hasAttribute(PRINT_MODE_ATTRIBUTE);
}

/**
 * Prints one body-level root while excluding the application and all portal
 * siblings. Only one print flow can be active at a time.
 */
export function printIsolatedRoot({
  mode,
  root,
  onAfterPrint,
}: IsolatedPrintOptions): boolean {
  if (isPrintActive()) {
    root.remove();
    return false;
  }

  activePrintRoot = root;
  root.setAttribute(PRINT_ROOT_ATTRIBUTE, "true");
  document.body.setAttribute(PRINT_MODE_ATTRIBUTE, mode);

  let cleanedUp = false;
  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    window.removeEventListener("afterprint", cleanup);
    root.remove();
    if (activePrintRoot === root) {
      activePrintRoot = null;
      document.body.removeAttribute(PRINT_MODE_ATTRIBUTE);
    }
    onAfterPrint?.();
  };

  window.addEventListener("afterprint", cleanup, { once: true });

  // Two animation frames allow React/Radix to commit a triggering dialog's
  // closed state and allow the newly inserted print root to finish layout.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      try {
        window.print();
      } catch (error) {
        cleanup();
        throw error;
      }
    });
  });

  return true;
}
