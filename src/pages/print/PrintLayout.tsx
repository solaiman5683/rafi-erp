import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSettings } from "@/lib/hooks";
import { useI18n } from "@/lib/i18n";
import type { Settings } from "@/lib/types";
import { cn } from "@/lib/utils";

/** A4 / A5 কাগজে প্রিন্টের ফ্রেম */
export function PrintLayout({
  ready,
  children,
  title,
  defaultPaper,
}: {
  ready: boolean;
  children: (s: Settings | undefined) => ReactNode;
  title: string;
  /** দিলে সেটিংসের কাগজের বদলে এটা দিয়ে শুরু (যেমন রিপোর্ট A4) */
  defaultPaper?: "A4" | "A5";
}) {
  const { L } = useI18n();
  const settings = useSettings();
  const [paper, setPaper] = useState<"A4" | "A5">(defaultPaper ?? "A5");
  const printed = useRef(false);

  useEffect(() => {
    if (!defaultPaper && settings?.paper) setPaper(settings.paper);
  }, [settings?.paper, defaultPaper]);

  useEffect(() => {
    document.title = title;
  }, [title]);

  // প্রিন্ট বাটন থেকে (?auto=1) খুললে ডেস্কটপে সাথে সাথে প্রিন্ট ডায়ালগ
  useEffect(() => {
    if (!ready || settings === undefined || printed.current) return;
    printed.current = true;
    const auto = new URLSearchParams(window.location.search).has("auto");
    if (auto && window.matchMedia("(min-width: 900px)").matches) setTimeout(() => window.print(), 400);
  }, [ready, settings]);

  return (
    <div className="min-h-dvh bg-slate-200 py-4 print:bg-white print:py-0">
      <style>{`@page { size: ${paper} portrait; margin: ${paper === "A5" ? "7mm" : "10mm"}; }`}</style>
      <div className="no-print mx-auto mb-4 flex max-w-[210mm] flex-wrap items-center gap-2 px-3">
        <Button variant="outline" onClick={() => (window.history.length > 1 ? window.history.back() : window.close())}>
          <ArrowLeft /> {L("ফিরে যান", "Back")}
        </Button>
        <div className="ml-auto flex gap-1 rounded-xl bg-white p-1">
          {(["A5", "A4"] as const).map((p) => (
            <button key={p} type="button" onClick={() => setPaper(p)} className={cn("h-9 rounded-lg px-4 font-bold", paper === p ? "bg-primary text-white" : "")}>
              {p}
            </button>
          ))}
        </div>
        <Button size="lg" onClick={() => window.print()}>
          <Printer /> {L("প্রিন্ট করুন", "Print")}
        </Button>
      </div>
      <div
        className={cn(
          "mx-auto max-w-[calc(100vw-1rem)] bg-white text-black shadow-xl print:w-auto print:max-w-none print:shadow-none",
          paper === "A5" ? "w-[148mm] p-[7mm] text-[12px]" : "w-[210mm] p-[10mm] text-[14px]",
          "print:p-0",
        )}
      >
        {ready ? children(settings) : <p className="p-10 text-center">…</p>}
      </div>
    </div>
  );
}

export function ShopHeader({ s, title }: { s: Settings | undefined; title: string }) {
  return (
    <div className="mb-3 border-b-2 border-black pb-2 text-center">
      <p className="text-[1.9em] leading-tight font-bold">{s?.shop_name}</p>
      {s?.tagline && <p className="text-[0.95em]">{s.tagline}</p>}
      {s?.address && <p className="text-[0.95em]">{s.address}</p>}
      {(s?.phone || s?.phone2) && <p className="text-[0.95em]">☎ {[s?.phone, s?.phone2].filter(Boolean).join(", ")}</p>}
      <span className="mt-1.5 inline-block rounded-full border-2 border-black px-4 py-0.5 text-[1.05em] font-bold">{title}</span>
    </div>
  );
}

export function Signatures({ left, right }: { left: string; right: string }) {
  return (
    <div className="mt-12 flex justify-between gap-8 text-center text-[0.95em]">
      <span className="w-40 border-t border-black pt-1">{left}</span>
      <span className="w-40 border-t border-black pt-1">{right}</span>
    </div>
  );
}
