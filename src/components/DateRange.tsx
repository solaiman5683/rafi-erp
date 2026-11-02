import { useMemo, useState } from "react";
import { CalendarDays } from "lucide-react";
import { Input } from "@/components/ui/input";
import { addDays, todayISO } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export type RangeKey = "today" | "yesterday" | "7d" | "month" | "lastMonth" | "year" | "all" | "custom";

/** "সব" বাছলে এই তারিখ থেকে আজ পর্যন্ত */
export const ALL_FROM = "2000-01-01";

export interface DateRangeValue {
  key: RangeKey;
  from: string;
  to: string;
}

export function rangeFor(key: RangeKey, custom?: { from: string; to: string }): DateRangeValue {
  const t = todayISO();
  const now = new Date();
  switch (key) {
    case "today":
      return { key, from: t, to: t };
    case "yesterday": {
      const y = addDays(t, -1);
      return { key, from: y, to: y };
    }
    case "7d":
      return { key, from: addDays(t, -6), to: t };
    case "month":
      return { key, from: todayISO(new Date(now.getFullYear(), now.getMonth(), 1)), to: t };
    case "lastMonth":
      return {
        key,
        from: todayISO(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
        to: todayISO(new Date(now.getFullYear(), now.getMonth(), 0)),
      };
    case "year":
      return { key, from: todayISO(new Date(now.getFullYear(), 0, 1)), to: t };
    case "all":
      return { key, from: ALL_FROM, to: t };
    default:
      return { key, from: custom?.from ?? t, to: custom?.to ?? t };
  }
}

export function useDateRange(initial: RangeKey = "today") {
  const [value, setValue] = useState<DateRangeValue>(() => rangeFor(initial));
  return [value, setValue] as const;
}

export function DateRangeBar({ value, onChange, keys }: { value: DateRangeValue; onChange: (v: DateRangeValue) => void; keys?: RangeKey[] }) {
  const { L } = useI18n();
  const labels: Record<RangeKey, string> = useMemo(
    () => ({
      today: L("আজ", "Today"),
      yesterday: L("গতকাল", "Yesterday"),
      "7d": L("7 দিন", "7 days"),
      month: L("এই মাস", "This month"),
      lastMonth: L("গত মাস", "Last month"),
      year: L("এই বছর", "This year"),
      all: L("সব", "All"),
      custom: L("তারিখ বাছুন", "Pick dates"),
    }),
    [L],
  );
  const list = keys ?? (["today", "yesterday", "7d", "month", "lastMonth", "all", "custom"] as RangeKey[]);
  return (
    <div className="grid gap-2">
      <div className="scrollbar-thin -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {list.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => onChange(rangeFor(k, value))}
            className={cn(
              "flex h-10 shrink-0 items-center gap-1.5 rounded-full border-2 px-4 text-sm font-semibold",
              value.key === k ? "border-primary bg-primary text-white" : "bg-white hover:bg-muted",
            )}
          >
            {k === "custom" && <CalendarDays className="size-4" />}
            {labels[k]}
          </button>
        ))}
      </div>
      {value.key === "custom" && (
        <div className="flex flex-wrap items-center gap-2">
          <Input type="date" className="w-44" value={value.from} max={value.to} onChange={(e) => onChange({ ...value, from: e.target.value })} />
          <span>—</span>
          <Input type="date" className="w-44" value={value.to} min={value.from} onChange={(e) => onChange({ ...value, to: e.target.value })} />
        </div>
      )}
    </div>
  );
}
