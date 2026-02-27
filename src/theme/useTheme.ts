import { useState, useEffect } from "react";

const STORAGE_KEY = "socialbot:theme";

function initialIsDark(): boolean {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === "dark") return true;
  if (saved === "light") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function useTheme(): { isDark: boolean; toggle: () => void } {
  const [isDark, setIsDark] = useState<boolean>(initialIsDark);

  // Apply the .dark class to <html> and persist to localStorage whenever isDark changes
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem(STORAGE_KEY, isDark ? "dark" : "light");
  }, [isDark]);

  // Listen for OS preference changes — only when the user hasn't set an explicit preference
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");

    function handleChange(e: MediaQueryListEvent) {
      if (localStorage.getItem(STORAGE_KEY) !== null) return;
      setIsDark(e.matches);
    }

    mq.addEventListener("change", handleChange);
    return () => {
      mq.removeEventListener("change", handleChange);
    };
  }, []);

  function toggle() {
    setIsDark((prev) => !prev);
  }

  return { isDark, toggle };
}
