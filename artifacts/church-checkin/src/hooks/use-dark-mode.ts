import { useEffect, useState } from "react";

const STORAGE_KEY = "church-checkin-dark-mode";

function getDarkModePreference() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored !== null) return stored === "true";
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
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
