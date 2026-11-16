import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type A11yPrefs = {
  font: "base" | "lg" | "xl" | "xxl";
  contrast: "normal" | "high";
  spacing: "normal" | "wide";
};
export const DEFAULT_PREFS: A11yPrefs = { font: "base", contrast: "normal", spacing: "normal" };
const KEY = "ba-a11y-prefs";
const FONTS: A11yPrefs["font"][] = ["base", "lg", "xl", "xxl"];

type Ctx = {
  prefs: A11yPrefs;
  setPrefs: (p: Partial<A11yPrefs>) => void;
  bigger: () => void;
  smaller: () => void;
};
const PrefsContext = createContext<Ctx | null>(null);

export function sanitizePrefs(v: unknown): A11yPrefs {
  const o = (v && typeof v === "object" ? v : {}) as {
    font?: unknown;
    contrast?: unknown;
    spacing?: unknown;
  };
  return {
    font: FONTS.includes(o.font as A11yPrefs["font"]) ? (o.font as A11yPrefs["font"]) : "base",
    contrast: o.contrast === "high" ? "high" : "normal",
    spacing: o.spacing === "wide" ? "wide" : "normal",
  };
}

export function PrefsProvider({
  children,
  onChange,
}: {
  children: ReactNode;
  onChange?: (p: A11yPrefs) => void;
}) {
  const [prefs, setState] = useState<A11yPrefs>(DEFAULT_PREFS);
  useEffect(() => {
    try {
      setState(sanitizePrefs(JSON.parse(localStorage.getItem(KEY) ?? "{}")));
    } catch {
      /* ignore */
    }
  }, []);
  useEffect(() => {
    const el = document.documentElement;
    el.dataset["font"] = prefs.font;
    el.dataset["contrast"] = prefs.contrast;
    el.dataset["spacing"] = prefs.spacing;
  }, [prefs]);
  const setPrefs = (p: Partial<A11yPrefs>) =>
    setState((cur) => {
      const next = sanitizePrefs({ ...cur, ...p });
      localStorage.setItem(KEY, JSON.stringify(next));
      onChange?.(next);
      return next;
    });
  const step = (d: number) =>
    setPrefs({
      font: FONTS[Math.max(0, Math.min(FONTS.length - 1, FONTS.indexOf(prefs.font) + d))]!,
    });
  return (
    <PrefsContext.Provider
      value={{ prefs, setPrefs, bigger: () => step(1), smaller: () => step(-1) }}
    >
      {children}
    </PrefsContext.Provider>
  );
}

export function usePrefs() {
  const c = useContext(PrefsContext);
  if (!c) throw new Error("usePrefs fora do PrefsProvider");
  return c;
}

export function applyRemotePrefs(v: unknown) {
  const p = sanitizePrefs(v);
  localStorage.setItem(KEY, JSON.stringify(p));
  return p;
}
