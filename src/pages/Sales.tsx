import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { ChevronRight, ReceiptText, Search, ShoppingCart, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState, PageHeader, StatCard } from "@/components/common";
import { DateRangeBar, useDateRange } from "@/components/DateRange";
import { ExportButtons } from "@/components/ExportButtons";
import { Pager, usePaged } from "@/components/Pager";
import { HandCoins, Wallet } from "lucide-react";
import { WALK_IN } from "@/lib/constants";
import { db } from "@/lib/db";
import { matchSearch } from "@/lib/hooks";
import { useI18n } from "@/lib/i18n";
import { buildSales } from "@/lib/tables";

export default function Sales() {
  const i18n = useI18n();
  const { L, B, money, num, date, time } = i18n;
  const nav = useNavigate();
  const [range, setRange] = useDateRange("today");
  const [q, setQ] = useState("");

  const data = useLiveQuery(async () => {
    const sales = (await db.sales.where("date").between(range.from, range.to, true, true).toArray()).filter((s) => !s.deleted);
    sales.sort((a, b) => b.created_at - a.created_at);
    const returns = await db.sale_returns.where("sale_id").anyOf(sales.map((s) => s.id)).toArray();
    const returned = new Map<string, number>();
    for (const r of returns) if (!r.deleted) returned.set(r.sale_id, (returned.get(r.sale_id) ?? 0) + r.total);
    return { sales, returned };
  }, [range.from, range.to]);

  const list = useMemo(
    () => (data?.sales ?? []).filter((s) => !q || matchSearch(`${s.invoice_no} ${s.customer_name} ${s.customer_phone ?? ""}`, q)),
    [data, q],
  );
  const paged = usePaged(list, [range.from, range.to, q]);
  const totals = useMemo(() => {
    const t = { total: 0, paid: 0, due: 0 };
    for (const s of list) {
      t.total += s.total;
      t.paid += s.paid;
      t.due += s.due;
    }
    return t;
  }, [list]);

  return (
    <div>
      <PageHeader
        icon={ReceiptText}
        color="#0d9488"
        title={L("বিক্রির খাতা", "Sales")}
        subtitle={L("সব মেমো — চাপ দিলে বিস্তারিত, প্রিন্ট ও ফেরত", "All memos — tap for details, print & returns")}
        actions={
          <>
            <ExportButtons
              build={() => buildSales(range.from, range.to, q, i18n)}
              printUrl={`/print/table?kind=sales&from=${range.from}&to=${range.to}&q=${encodeURIComponent(q)}`}
              fileName={`sales-${range.from}_${range.to}.csv`}
            />
            <Button onClick={() => nav("/sell")} className="bg-emerald-600 hover:bg-emerald-700">
              <ShoppingCart /> {L("নতুন বিক্রি", "New sale")}
            </Button>
          </>
        }
      />
      <div className="mb-4 grid gap-3">
        <DateRangeBar value={range} onChange={setRange} />
        <div className="relative">
          <Search className="absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-10" placeholder={L("মেমো নং বা কাস্টমারের নাম…", "Memo no or customer…")} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={ReceiptText} color="#0d9488" label={L("মেমো", "Memos")} value={num(list.length)} />
        <StatCard icon={ShoppingCart} color="#16a34a" label={L("মোট বিক্রি", "Total sales")} value={money(totals.total)} />
        <StatCard icon={HandCoins} color="#2563eb" label={L("নগদ পেয়েছি", "Received")} value={money(totals.paid)} />
        <StatCard icon={Wallet} color="#dc2626" label={L("বাকিতে গেছে", "On credit")} value={money(totals.due)} />
      </div>

      {list.length === 0 ? (
        <EmptyState icon={ReceiptText} title={L("এই সময়ে কোনো বিক্রি নেই", "No sales in this period")} />
      ) : (
        <div className="grid gap-2">
          {paged.rows.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => nav(`/sales/${s.id}`)}
              className="flex items-center gap-3 rounded-2xl border bg-white p-3 text-left shadow-xs transition hover:border-primary"
            >
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-teal-50 text-teal-700">
                <ReceiptText className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-x-2">
                  <span className="font-bold">{s.invoice_no}</span>
                  <span className="truncate text-muted-foreground">{s.customer_name || B(WALK_IN)}</span>
                </span>
                <span className="block text-xs text-muted-foreground">
                  {date(s.date)} · {time(s.created_at)} · {num(s.items.length)} {L("আইটেম", "items")}
                  {s.by_name && ` · ${s.by_name}`}
                </span>
              </span>
              <span className="text-right">
                <span className="tabular block font-bold">{money(s.total)}</span>
                {s.due > 0 && <span className="tabular block text-xs font-semibold text-red-600">{L("বাকি", "Due")} {money(s.due)}</span>}
                {data?.returned.get(s.id) && (
                  <span className="flex items-center justify-end gap-0.5 text-xs font-semibold text-amber-700">
                    <Undo2 className="size-3" /> {L("ফেরত", "Returned")} {money(data.returned.get(s.id)!)}
                  </span>
                )}
              </span>
              <ChevronRight className="size-5 text-muted-foreground" />
            </button>
          ))}
        </div>
      )}
      <Pager {...paged} />
    </div>
  );
}
