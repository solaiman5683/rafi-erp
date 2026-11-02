import { useState, type ComponentProps } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** পিন বা পাসওয়ার্ড — চাইলে চোখে চাপ দিয়ে দেখা যায় */
export const SECRET_MIN = 4;
export const SECRET_MAX = 64;

export function isValidSecret(s: string): boolean {
  return s.length >= SECRET_MIN && s.length <= SECRET_MAX;
}

export function SecretInput({ className, ...props }: Omit<ComponentProps<"input">, "type">) {
  const { L } = useI18n();
  const [show, setShow] = useState(false);
  return (
    <div className={cn("relative", className)}>
      <Input {...props} type={show ? "text" : "password"} maxLength={SECRET_MAX} autoComplete={props.autoComplete ?? "current-password"} className="pr-12" />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        className="absolute top-1/2 right-1.5 grid size-9 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground hover:bg-muted"
        aria-label={show ? L("লুকান", "Hide") : L("দেখুন", "Show")}
        tabIndex={-1}
      >
        {show ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
      </button>
    </div>
  );
}
