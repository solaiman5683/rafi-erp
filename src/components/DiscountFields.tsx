import { useState } from "react";
import { Percent, Tag, BadgeCheck } from "lucide-react";
import { NumInput } from "./NumInput";
import { resolveDiscount } from "@/lib/discount";
import { useI18n } from "@/lib/i18n";
import type { DiscMode } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * ছাড়ের তিনটা ঘর পাশাপাশি: শতাংশ (%), টাকা (৳), আর বিক্রি দাম।
 * যেকোনো একটা লিখলে বাকি দুটো নিজে থেকে হিসাব হয়।
 *
 * base = ছাড়ের আগে মোট। priceLabel = তৃতীয় ঘরের নাম।
 * "price" মোডে value = ছাড়ের পর প্রতি এককের দাম (unitQty = 1 হলে পুরো মোট)।
 */
export function DiscountFields({
  base,
  mode,
  value,
  onChange,
  priceLabel,
  compact,
  unitQty = 1,
}: {
  base: number;
  unitQty?: number;
  mode: DiscMode;
  value: number;
  onChange: (mode: DiscMode, value: number) => void;
  priceLabel?: string;
  compact?: boolean;
}) {
  const { L } = useI18n();
  const r = resolveDiscount(base, mode, mode === "price" ? value * unitQty : value);
  const unitFinal = unitQty > 0 ? Math.round((r.final / unitQty) * 100) / 100 : r.final;
  const [active, setActive] = useState<DiscMode | null>(null);

  const box = (m: DiscMode, label: string, Icon: typeof Percent, val: number, tone: string) => (
    <label
      className={cn(
        "grid gap-1 rounded-xl border-2 p-2 transition",
        (active ?? mode) === m && mode !== "none" ? tone : "border-transparent bg-muted/60",
      )}
    >
      <span className="flex items-center gap-1 text-xs font-semibold text-foreground/70">
        <Icon className="size-3.5" />
        {label}
      </span>
      <NumInput
        value={mode === "none" && m !== "price" ? 0 : val}
        allowEmpty={m !== "price"}
        onFocus={() => setActive(m)}
        onBlur={() => setActive(null)}
        onValueChange={(n) => {
          if (m !== "price" && n === 0) onChange("none", 0);
          else onChange(m, n);
        }}
        className={compact ? "[&_input]:h-10" : undefined}
      />
    </label>
  );

  return (
    <div className="grid grid-cols-3 gap-2">
      {box("percent", L("ছাড় %", "Disc %"), Percent, r.percent, "border-violet-400 bg-violet-50")}
      {box("amount", L("ছাড় ৳", "Disc ৳"), Tag, r.amount, "border-amber-400 bg-amber-50")}
      {box("price", priceLabel ?? L("বিক্রি দাম ৳", "Sold price ৳"), BadgeCheck, unitFinal, "border-emerald-500 bg-emerald-50")}
    </div>
  );
}
