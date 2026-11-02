import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { toast } from "sonner";
import { Ban, ChevronDown, Search, Truck, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmAction, EmptyState, PageHeader, StatCard } from "@/components/common";
import { DateRangeBar, useDateRange } from "@/components/DateRange";
import { methodLabel } from "@/components/PayMethodPicker";
import { UNITS } from "@/lib/constants";
import { db } from "@/lib/db";
import { matchSearch } from "@/lib/hooks";
import { useI18n } from "@/lib/i18n";
import { Pager, usePaged } from "@/components/Pager";
import { voidPurchase } from "@/lib/ops";
import { cn } from "@/lib/utils";

export default function Purchases() {
  const { L, B, money, num, date } = useI18n();
  const nav = useNavigate();
  const [range, setRange] = useDateRange("month");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  const purchases = useLiveQuery(async () => {
    const list = await db.purchases.where("date").between(range.from, range.to, true, true).toArray();
    return list.sort((a, b) => b.created_at - a.created_at);
  }, [range.from, range.to]);

  const list = useMemo(
    () => (purchases ?? []).filter((p) => !q || matchSearch(`${p.purchase_no} ${p.bill_no ?? ""} ${p.supplier_name}`, q)),
    [purchases, q],
  );
  const paged = usePaged(list, [range.from, range.to, q]);
  const active = list.filter((p) => p.status !== "void");
  const total = active.reduce((s, p) => s + p.total, 0);
  const due = active.reduce((s, p) => s + p.due, 0);

  return (
    <div>
      <PageHeader back="/purchase" icon={Truck} color="#2563eb" title={L("ক্রয়ের তালিকা", "Purchases")} />
      <div className="mb-4 grid gap-3">
        <DateRangeBar value={range} onChange={setRange} />
        <div className="relative">
          <Search className="absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-10" placeholder={L("নং বা সাপ্লায়ার…", "No or supplier…")} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard icon={Truck} color="#2563eb" label={L("মোট ক্রয়", "Total purchase")} value={money(total)} hint={`${num(active.length)} ${L("টি", "bills")}`} />
        <StatCard icon={Wallet} color="#dc2626" label={L("বাকিতে কেনা", "On credit")} value={money(due)} />
      </div>
      {list.length === 0 ? (
        <EmptyState icon={Truck} title={L("এই সময়ে কোনো ক্রয় নেই", "No purchases in this period")} action={<Button onClick={() => nav("/purchase")}>{L("মাল কেনা", "New purchase")}</Button>} />
      ) : (
        <div className="grid gap-2">
          {paged.rows.map((p) => (
            <div key={p.id} className={cn("rounded-2xl border bg-white shadow-xs", p.status === "void" && "opacity-60")}>
              <button type="button" onClick={() => setOpen(open === p.id ? null : p.id)} className="flex w-full items-center gap-3 p-3 text-left">
                <span className="grid size-11 place-items-center rounded-xl bg-blue-50 text-blue-700">
                  <Truck className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-2">
                    <b>{p.purchase_no}</b>
                    <span className="truncate text-muted-foreground">{p.supplier_name}</span>
                    {p.status === "void" && <span className="rounded bg-red-100 px-1.5 text-xs font-semibold text-red-700">{L("বাতিল", "Void")}</span>}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {date(p.date)} · {num(p.items.length)} {L("আইটেম", "items")}
                    {p.bill_no && ` · ${L("মেমো", "Bill")} ${p.bill_no}`}
                  </span>
                </span>
                <span className="text-right">
                  <span className="tabular block font-bold">{money(p.total)}</span>
                  {p.due > 0 && <span className="tabular block text-xs font-semibold text-red-600">{L("বাকি", "Due")} {money(p.due)}</span>}
                </span>
                <ChevronDown className={cn("size-5 text-muted-foreground transition", open === p.id && "rotate-180")} />
              </button>
              {open === p.id && (
                <div className="border-t p-3">
                  <div className="grid gap-1 text-sm">
                    {p.items.map((it, i) => (
                      <div key={i} className="flex justify-between gap-2">
                        <span>
                          {it.name} {it.variant_name} — {num(it.qty)} {B(UNITS[it.unit])} × {money(it.price)}
                        </span>
                        <span className="tabular font-semibold">{money(it.total)}</span>
                      </div>
                    ))}
                    {p.discount > 0 && (
                      <div className="flex justify-between text-amber-700">
                        <span>{L("ছাড়", "Discount")}</span>
                        <span>-{money(p.discount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span>
                        {L("দিয়েছি", "Paid")} ({methodLabel(p.method, B)})
                      </span>
                      <span>{money(p.paid)}</span>
                    </div>
                  </div>
                  {p.status !== "void" && (
                    <div className="mt-3 flex justify-end">
                      <ConfirmAction
                        destructive
                        title={L("এই ক্রয় বাতিল করবেন?", "Void this purchase?")}
                        description={L("স্টক কমে যাবে, সাপ্লায়ারের দেনা ও ক্যাশ আগের মতো হবে।", "Stock, supplier payable and cash will be reversed.")}
                        confirmText={L("হ্যাঁ, বাতিল", "Void")}
                        onConfirm={async () => {
                          await voidPurchase(p.id);
                          toast.success(L("ক্রয় বাতিল হয়েছে", "Purchase voided"));
                        }}
                        trigger={
                          <Button variant="destructive">
                            <Ban /> {L("বাতিল করুন", "Void")}
                          </Button>
                        }
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <Pager {...paged} />
    </div>
  );
}
