import type { ReactNode } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  subtitle,
  icon: Icon,
  color = "#059669",
  back,
  actions,
}: {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  color?: string;
  back?: boolean | string;
  actions?: ReactNode;
}) {
  const nav = useNavigate();
  return (
    <div className="mb-5 flex flex-wrap items-center gap-3">
      {back && (
        <Button variant="outline" size="icon" onClick={() => (typeof back === "string" ? nav(back) : nav(-1))} aria-label="back">
          <ArrowLeft />
        </Button>
      )}
      {Icon && (
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl text-white shadow-sm" style={{ backgroundColor: color }}>
          <Icon className="size-6" strokeWidth={2.2} />
        </span>
      )}
      <div className="min-w-44 flex-1">
        <h1 className="truncate text-2xl font-bold leading-tight">{title}</h1>
        {subtitle && <p className="truncate text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {/* মোবাইলে বাটনগুলো পুরো চওড়া জুড়ে সমান ভাগে; বড় স্ক্রিনে ডানপাশে */}
      {actions && (
        <div className="flex w-full items-center gap-2 sm:w-auto [&>*:not([data-size^=icon])]:flex-1 sm:[&>*:not([data-size^=icon])]:flex-none">{actions}</div>
      )}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, hint, action }: { icon: LucideIcon; title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed bg-white/60 px-6 py-12 text-center">
      <span className="grid size-16 place-items-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-8" />
      </span>
      <p className="text-lg font-semibold">{title}</p>
      {hint && <p className="max-w-sm text-muted-foreground">{hint}</p>}
      {action}
    </div>
  );
}

export function StatCard({
  label,
  value,
  icon: Icon,
  color,
  hint,
  onClick,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  color: string;
  hint?: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className="relative flex items-center overflow-hidden rounded-2xl border bg-card p-4 text-left shadow-xs transition enabled:hover:-translate-y-0.5 enabled:hover:shadow-md disabled:cursor-default"
    >
      {/* নিচের ডান কোণে হালকা রঙের গোল, তার ওপর আইকন — লেখার পেছনে বসে, আলাদা জায়গা নেয় না */}
      <span aria-hidden className="pointer-events-none absolute -right-6 -bottom-6 size-24 rounded-full" style={{ backgroundColor: `${color}14` }} />
      <Icon aria-hidden className="pointer-events-none absolute right-3 bottom-3 size-7 opacity-60" style={{ color }} strokeWidth={2} />
      <span className="relative min-w-0">
        <span className="line-clamp-2 block text-sm leading-tight text-muted-foreground">{label}</span>
        <span className="tabular block truncate text-xl font-bold">{value}</span>
        {hint && <span className="block truncate text-xs text-muted-foreground">{hint}</span>}
      </span>
    </button>
  );
}

export function Field({ label, children, hint, className }: { label: string; children: ReactNode; hint?: string; className?: string }) {
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label className="text-sm font-semibold text-foreground/80">{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function ConfirmAction({
  trigger,
  title,
  description,
  confirmText,
  destructive,
  onConfirm,
}: {
  trigger: ReactNode;
  title: string;
  description?: string;
  confirmText?: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
}) {
  const { L } = useI18n();
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="text-xl">{title}</AlertDialogTitle>
          {description && <AlertDialogDescription className="text-base">{description}</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="h-11 text-base">{L("না, থাক", "Cancel")}</AlertDialogCancel>
          <AlertDialogAction
            className={cn("h-11 text-base", destructive && "bg-destructive text-white hover:bg-destructive/90")}
            onClick={() => void onConfirm()}
          >
            {confirmText ?? L("হ্যাঁ", "Yes")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function StockBadge({ qty, low, unit }: { qty: number; low?: number; unit?: string }) {
  const { num, L } = useI18n();
  const tone =
    qty <= 0 ? "bg-red-100 text-red-700 ring-red-200" : qty <= (low ?? 0) ? "bg-amber-100 text-amber-800 ring-amber-200" : "bg-emerald-50 text-emerald-700 ring-emerald-200";
  return (
    <span className={cn("tabular inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ring-1", tone)}>
      {qty <= 0 ? L("স্টক নেই", "Out") : `${num(qty)} ${unit ?? ""}`}
    </span>
  );
}

/** বাকি / অগ্রিম দেখানো */
export function DueText({ amount, kind = "customer", className }: { amount: number; kind?: "customer" | "supplier"; className?: string }) {
  const { money, L } = useI18n();
  if (Math.abs(amount) < 0.01) return <span className={cn("text-muted-foreground", className)}>{L("কোনো বাকি নেই", "No due")}</span>;
  if (amount > 0)
    return (
      <span className={cn("tabular font-bold text-red-600", className)}>
        {kind === "customer" ? L("বাকি", "Due") : L("দেনা", "Payable")} {money(amount)}
      </span>
    );
  return (
    <span className={cn("tabular font-bold text-emerald-700", className)}>
      {L("অগ্রিম", "Advance")} {money(-amount)}
    </span>
  );
}
