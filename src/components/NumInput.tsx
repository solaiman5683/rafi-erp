import { useEffect, useRef, useState, type ComponentProps } from "react";
import { Input } from "@/components/ui/input";
import { normalizeNumberInput, parseNum } from "@/lib/format";
import { cn } from "@/lib/utils";

type Props = Omit<ComponentProps<"input">, "value" | "onChange" | "type"> & {
  value: number | null | undefined;
  onValueChange: (n: number) => void;
  /** ফাঁকা থাকলে কী দেখাবে (০ এর বদলে ফাঁকা) */
  allowEmpty?: boolean;
  prefix?: string;
  suffix?: string;
  selectOnFocus?: boolean;
};

/**
 * সংখ্যা লেখার ঘর — বাংলা কীবোর্ডে (০-৯) লিখলেও নেয়, তবে ঘরে ইংরেজি অঙ্কে দেখায়।
 * মোবাইলে সংখ্যার কীবোর্ড খোলে।
 */
export function NumInput({ value, onValueChange, allowEmpty = true, prefix, suffix, selectOnFocus = true, className, onFocus, onBlur, ...rest }: Props) {
  const show = (v: number | null | undefined) => (v || !allowEmpty ? String(v ?? 0) : "");
  const [text, setText] = useState(() => show(value));
  const focused = useRef(false);

  useEffect(() => {
    // বাইরে থেকে মান বদলালে (ফোকাস না থাকলে) টেক্সট আপডেট
    if (focused.current) return;
    setText(show(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, allowEmpty]);

  return (
    <div className={cn("relative", className)}>
      {prefix && <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground">{prefix}</span>}
      <Input
        {...rest}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        className={cn("tabular text-lg font-medium", prefix && "pl-8", suffix && "pr-14")}
        value={text}
        onFocus={(e) => {
          focused.current = true;
          if (selectOnFocus) e.currentTarget.select();
          onFocus?.(e);
        }}
        onBlur={(e) => {
          focused.current = false;
          setText(show(value));
          onBlur?.(e);
        }}
        onChange={(e) => {
          const raw = normalizeNumberInput(e.target.value);
          if (raw !== "" && !/^-?\d*\.?\d*$/.test(raw)) return;
          setText(raw);
          onValueChange(parseNum(raw));
        }}
      />
      {suffix && <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground">{suffix}</span>}
    </div>
  );
}
