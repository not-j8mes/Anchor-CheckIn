import { useEffect, useState } from "react";

export const HIGH_CONTRAST_STORAGE_KEY = "church-checkin-high-contrast-v1";

function getHighContrastPreference() {
  return localStorage.getItem(HIGH_CONTRAST_STORAGE_KEY) === "true";
}

function applyHighContrast(isHighContrast: boolean) {
  if (isHighContrast) {
    document.documentElement.dataset.contrast = "high";
  } else {
    delete document.documentElement.dataset.contrast;
  }
}

export function initializeHighContrast() {
  applyHighContrast(getHighContrastPreference());
}

export function useHighContrast() {
  const [isHighContrast, setHighContrastState] = useState(
    getHighContrastPreference,
  );

  useEffect(() => {
    applyHighContrast(isHighContrast);
  }, [isHighContrast]);

  const setIsHighContrast = (nextIsHighContrast: boolean) => {
    localStorage.setItem(
      HIGH_CONTRAST_STORAGE_KEY,
      String(nextIsHighContrast),
    );
    applyHighContrast(nextIsHighContrast);
    setHighContrastState(nextIsHighContrast);
  };

  return { isHighContrast, setIsHighContrast };
}
