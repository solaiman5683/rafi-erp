import { Banknote, FileCheck, Landmark, Smartphone } from "lucide-react";
import { PAY_METHODS } from "@/lib/constants";
import { useI18n } from "@/lib/i18n";
import type { PayMethod } from "@/lib/types";
import { cn } from "@/lib/utils";

const ICON = { cash: Banknote, bkash: Smartphone, nagad: Smartphone, rocket: Smartphone, bank: Landmark, cheque: FileCheck };

export function PayMethodPicker({ value, onChange, compact }: { value: PayMethod; onChange: (m: PayMethod) => void; compact?: boolean }) {
  const { B } = useI18n();
  return (
    <div className={cn("grid gap-2", compact ? "grid-cols-3" : "grid-cols-3 sm:grid-cols-6")}>
      {PAY_METHODS.map((m) => {
        const Icon = ICON[m.id];
        const on = value === m.id;
        return (
          <button
            key={m.id}
            type="button"
            onClick={() => onChange(m.id)}
            className={cn(
              "flex h-11 items-center justify-center gap-1.5 rounded-xl border-2 px-2 text-sm font-semibold transition",
              on ? `${m.color} border-transparent text-white shadow-sm` : "border-border bg-white hover:bg-muted",
            )}
          >
            <Icon className="size-4 shrink-0" />
            <span className="truncate">{B(m.label)}</span>
          </button>
        );
      })}
    </div>
  );
}

export function methodLabel(m: PayMethod, B: (t: readonly [string, string]) => string) {
  const found = PAY_METHODS.find((x) => x.id === m);
  return found ? B(found.label) : m;
}
