import { useEffect, useState } from "react";

// Versioned so preferences accidentally persisted by the old system-theme
// initialization do not override the intended light-mode default.
const STORAGE_KEY = "church-checkin-dark-mode-v2";

function getDarkModePreference() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored !== null) return stored === "true";
  return false;
}

function applyDarkMode(isDark: boolean) {
  document.documentElement.classList.toggle("dark", isDark);
}

export function initializeDarkMode() {
  applyDarkMode(getDarkModePreference());
}

export function useDarkMode() {
  const [isDark, setDarkModeState] = useState(getDarkModePreference);

  useEffect(() => {
    applyDarkMode(isDark);
  }, [isDark]);

  const setIsDark = (nextIsDark: boolean) => {
    localStorage.setItem(STORAGE_KEY, String(nextIsDark));
    applyDarkMode(nextIsDark);
    setDarkModeState(nextIsDark);
  };

  return { isDark, setIsDark };
}
