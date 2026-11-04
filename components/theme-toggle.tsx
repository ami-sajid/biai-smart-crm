"use client";
import { useEffect, useRef, useState } from "react";
import { Sun, Moon } from "lucide-react";
export default function ThemeToggle() {
  const [dark, setDark] = useState(false);
  const transitionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    setDark(document.documentElement.dataset.theme === "dark");
    const sync = (event: StorageEvent) => {
      if (event.key !== "biai-theme" && event.key !== null) return;
      const value = event.newValue === "dark";
      document.documentElement.dataset.theme = value ? "dark" : "light";
      setDark(value);
    };
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("storage", sync);
      if (transitionTimer.current) clearTimeout(transitionTimer.current);
      document.documentElement.classList.remove("theme-transitioning");
    };
  }, []);
  return (
    <button
      type="button"
      className="theme-toggle"
      role="switch"
      aria-checked={dark}
      aria-label="Dark mode"
      onClick={() => {
        const next = !dark;
        if (transitionTimer.current) clearTimeout(transitionTimer.current);
        document.documentElement.classList.remove("theme-transitioning");
        const reducedMotion = typeof window.matchMedia === "function" &&
          window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (!reducedMotion) {
          document.documentElement.classList.add("theme-transitioning");
          transitionTimer.current = setTimeout(() => {
            document.documentElement.classList.remove("theme-transitioning");
            transitionTimer.current = null;
          }, 240);
        }
        document.documentElement.dataset.theme = next ? "dark" : "light";
        setDark(next);
        try {
          localStorage.setItem("biai-theme", next ? "dark" : "light");
        } catch {
          /* Theme still works when browser storage is unavailable. */
        }
      }}
    >
      {dark ? <Moon size={16} /> : <Sun size={16} />}
      <span>{dark ? "Dark Mode" : "Light Mode"}</span>
      <span className="theme-track" aria-hidden="true">
        <span />
      </span>
    </button>
  );
}
