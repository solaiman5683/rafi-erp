import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { BiText } from "./constants";
import { fmtDate, fmtMoney, fmtNum, fmtShortDate, fmtTime, type Lang } from "./format";

interface I18n {
  lang: Lang;
  setLang: (l: Lang) => void;
  /** L("বাংলা", "English") — বর্তমান ভাষা অনুযায়ী লেখা দেয় */
  L: (bn: string, en: string) => string;
  /** BiText থেকে লেখা */
  B: (t: BiText | undefined) => string;
  money: (n: number) => string;
  num: (n: number, maxFrac?: number) => string;
  date: (iso: string) => string;
  shortDate: (iso: string) => string;
  time: (ts: number) => string;
}

const Ctx = createContext<I18n | null>(null);

function readPref<T extends string>(key: string, fallback: T): T {
  try {
    return (localStorage.getItem(key) as T | null) ?? fallback;
  } catch {
    return fallback;
  }
}

function writePref(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* প্রাইভেট মোডে localStorage না-ও থাকতে পারে */
  }
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => readPref<Lang>("erp.lang", "bn"));
  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    writePref("erp.lang", l);
    document.documentElement.lang = l;
  }, []);

  const value = useMemo<I18n>(
    () => ({
      lang,
      setLang,
      L: (bn, en) => (lang === "bn" ? bn : en),
      B: (t) => (t ? (lang === "bn" ? t[0] : t[1]) : ""),
      money: (n) => fmtMoney(n),
      num: (n, maxFrac = 2) => fmtNum(n, maxFrac),
      date: (iso) => fmtDate(iso, lang),
      shortDate: (iso) => fmtShortDate(iso, lang),
      time: (ts) => fmtTime(ts),
    }),
    [lang, setLang],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18n {
  const v = useContext(Ctx);
  if (!v) throw new Error("useI18n must be used inside I18nProvider");
  return v;
}
