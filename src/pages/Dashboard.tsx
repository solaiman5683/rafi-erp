import { useState } from "react";
import { useNavigate } from "react-router";
import { useLiveQuery } from "dexie-react-hooks";
import {
  BanknoteArrowDown,
  Boxes,
  ChevronRight,
  HandCoins,
  PackagePlus,
  PackageX,
  ReceiptText,
  ShoppingCart,
  TrendingUp,
  TriangleAlert,
  Truck,
  Vault,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard, StockBadge } from "@/components/common";
import { PaymentDialog } from "@/components/PaymentDialog";
import { DailyBarChart } from "@/components/SalesChart";
import { StockDialog, type StockTarget } from "@/components/StockDialog";
import { useAuth } from "@/lib/auth";
import { UNITS, WALK_IN } from "@/lib/constants";
import { db } from "@/lib/db";
import { addDays, todayISO, weekdayName } from "@/lib/format";
import { useCatalog, useSettings } from "@/lib/hooks";
import { useI18n } from "@/lib/i18n";
import { cashBalances, receivablesPayables, summaryFor } from "@/lib/reports";

function ActionTile({ icon: Icon, label, hint, color, onClick }: { icon: LucideIcon; label: string; hint: string; color: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col items-start gap-2 rounded-2xl p-3 text-left text-white shadow-md transition hover:-translate-y-1 hover:shadow-xl active:scale-[0.98] sm:gap-3 sm:rounded-3xl sm:p-5"
      style={{ background: `linear-gradient(135deg, ${color}, ${color}cc)` }}
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/20 sm:size-14 sm:rounded-2xl">
        <Icon className="size-6 sm:size-8" strokeWidth={2.2} />
      </span>
      <span className="min-w-0">
        <span className="block text-base leading-tight font-bold sm:text-xl">{label}</span>
        <span className="block text-xs leading-tight opacity-90 sm:text-sm">{hint}</span>
      </span>
    </button>
  );
}

export default function Dashboard() {
  const { L, B, money, num, date, time, lang } = useI18n();
  const { user, isOwner } = useAuth();
  const nav = useNavigate();
  const settings = useSettings();
  const catalog = useCatalog();
  const [paying, setPaying] = useState(false);
  const [adjust, setAdjust] = useState<StockTarget | null>(null);
  const today = todayISO();

  const data = useLiveQuery(async () => {
    const [todaySum, last14, rp, cash, recent] = await Promise.all([
      summaryFor(today, today),
      summaryFor(addDays(today, -13), today),
      receivablesPayables(),
      cashBalances(),
      db.sales.orderBy("created_at").reverse().filter((s) => !s.deleted).limit(6).toArray(),
    ]);
    return { todaySum, series: last14.series, rp, cash, recent };
  }, [today]);

  const low = (catalog ?? [])
    .flatMap((i) => i.variants.filter((v) => v.stock <= (v.low_stock ?? 0)).map((v) => ({ item: i, v })))
    .sort((a, b) => a.v.stock - b.v.stock);

  const hour = new Date().getHours();
  const greet = hour < 12 ? L("শুভ সকাল", "Good morning") : hour < 17 ? L("শুভ দুপুর", "Good afternoon") : L("শুভ সন্ধ্যা", "Good evening");
  const t = data?.todaySum;

  return (
    <div className="grid gap-6">
      <div>
        <p className="text-muted-foreground">
          {weekdayName(today, lang)}, {date(today)}
        </p>
        <h1 className="text-2xl font-bold sm:text-3xl">
          {greet}, {user?.name}!
        </h1>
        {settings?.shop_name && <p className="text-muted-foreground">{settings.shop_name}</p>}
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
        <ActionTile icon={ShoppingCart} color="#16a34a" label={L("বিক্রি করুন", "Sell")} hint={L("নতুন মেমো বানান", "Make a new memo")} onClick={() => nav("/sell")} />
        <ActionTile icon={HandCoins} color="#7c3aed" label={L("টাকা জমা নিন", "Receive due")} hint={L("কাস্টমারের বাকি আদায়", "Collect customer due")} onClick={() => setPaying(true)} />
        {isOwner ? (
          <ActionTile icon={Truck} color="#2563eb" label={L("মাল কিনুন", "Purchase")} hint={L("সাপ্লায়ার থেকে মাল এল", "Stock from supplier")} onClick={() => nav("/purchase")} />
        ) : (
          <ActionTile icon={Boxes} color="#ea580c" label={L("স্টক দেখুন", "Check stock")} hint={L("কোন মাল কত আছে", "What's in stock")} onClick={() => nav("/products")} />
        )}
        <ActionTile icon={Wallet} color="#e11d48" label={L("খরচ লিখুন", "Add expense")} hint={L("ভাড়া, বিল, চা-নাস্তা", "Rent, bills, tea")} onClick={() => nav("/expenses")} />
      </div>

      <div>
        <h2 className="mb-3 text-lg font-bold">{L("আজকের হিসাব", "Today")}</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard icon={ReceiptText} color="#16a34a" label={L("আজকের বিক্রি", "Sales today")} value={money(t ? t.netSales : 0)} hint={`${num(t?.salesCount ?? 0)} ${L("টি মেমো", "memos")}`} onClick={() => nav("/sales")} />
          <StatCard icon={BanknoteArrowDown} color="#0d9488" label={L("আজ টাকা এসেছে", "Cash in today")} value={money(t?.cashIn ?? 0)} hint={L(`বাকি আদায় ${money(t?.collections ?? 0)}`, `Collected ${money(t?.collections ?? 0)}`)} />
          {isOwner && <StatCard icon={TrendingUp} color="#059669" label={L("আজকের লাভ", "Profit today")} value={money(t?.netProfit ?? 0)} hint={L("খরচ বাদ দিয়ে", "after expenses")} />}
          <StatCard icon={Wallet} color="#e11d48" label={L("আজকের খরচ", "Expenses today")} value={money(t?.expenses ?? 0)} onClick={() => nav("/expenses")} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={HandCoins} color="#7c3aed" label={L("কাস্টমারের কাছে পাওনা", "Receivable")} value={money(data?.rp.receivable ?? 0)} onClick={() => nav("/customers")} />
        {isOwner && <StatCard icon={Truck} color="#0891b2" label={L("সাপ্লায়ারকে দেনা", "Payable")} value={money(data?.rp.payable ?? 0)} onClick={() => nav("/suppliers")} />}
        {isOwner && <StatCard icon={Vault} color="#16a34a" label={L("ক্যাশ বাক্সে আছে", "Cash in box")} value={money(data?.cash.cash ?? 0)} onClick={() => nav("/reports?tab=cash")} />}
        <StatCard icon={PackageX} color="#dc2626" label={L("স্টক কম / শেষ", "Low / out of stock")} value={num(low.length)} onClick={() => nav("/products")} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <Card>
          <CardHeader>
            <CardTitle>{L("গত 14 দিনের বিক্রি", "Sales — last 14 days")}</CardTitle>
          </CardHeader>
          <CardContent>{data && <DailyBarChart data={data.series as never} dataKey="sales" label={L("বিক্রি", "Sales")} color="#059669" />}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TriangleAlert className="size-5 text-red-600" /> {L("এগুলো শেষ হয়ে আসছে", "Running low")}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            {low.length === 0 && <p className="py-6 text-center text-muted-foreground">{L("সব মাল যথেষ্ট আছে 👍", "Everything is well stocked")}</p>}
            {low.slice(0, 7).map(({ item, v }) => (
              <div key={v.id} className="flex items-center gap-1.5 rounded-xl border bg-white">
                {/* সারিতে চাপ দিলে স্টক ঠিক করার উইন্ডো */}
                <button
                  type="button"
                  onClick={() => setAdjust({ item, v })}
                  className="flex min-w-0 flex-1 items-center gap-2 rounded-xl p-2.5 text-left hover:bg-muted/60"
                  title={L("স্টক ঠিক করুন", "Adjust stock")}
                >
                  <span className="min-w-0 flex-1 truncate font-semibold">
                    {item.product.name} {v.name && <span className="text-muted-foreground">· {v.name}</span>}
                  </span>
                  <StockBadge qty={v.stock} low={v.low_stock} unit={B(UNITS[item.product.unit])} />
                </button>
                {isOwner && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mr-2 shrink-0 text-blue-700"
                    onClick={() => nav(`/purchase?add=${v.id}`)}
                    title={L("এই মাল কিনুন", "Buy this item")}
                  >
                    <PackagePlus /> {L("কিনুন", "Buy")}
                  </Button>
                )}
              </div>
            ))}
            {isOwner && low.length > 0 && (
              <button type="button" onClick={() => nav("/purchase")} className="flex items-center justify-center gap-1 pt-1 text-sm font-semibold text-blue-700">
                <PackagePlus className="size-4" /> {L("মাল কিনুন", "Buy stock")}
              </button>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ReceiptText className="size-5 text-teal-600" /> {L("সাম্প্রতিক বিক্রি", "Recent sales")}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2">
          {(data?.recent.length ?? 0) === 0 && <p className="py-6 text-center text-muted-foreground">{L("এখনো কোনো বিক্রি হয়নি", "No sales yet")}</p>}
          {data?.recent.map((s) => (
            <button key={s.id} type="button" onClick={() => nav(`/sales/${s.id}`)} className="flex items-center gap-3 rounded-xl border p-3 text-left hover:border-primary">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">
                  {s.invoice_no} · {s.customer_name || B(WALK_IN)}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {date(s.date)} · {time(s.created_at)}
                </span>
              </span>
              <span className="text-right">
                <span className="tabular block font-bold">{money(s.total)}</span>
                {s.due > 0 && <span className="tabular block text-xs font-semibold text-red-600">{L("বাকি", "Due")} {money(s.due)}</span>}
              </span>
              <ChevronRight className="size-5 text-muted-foreground" />
            </button>
          ))}
        </CardContent>
      </Card>

      <PaymentDialog open={paying} onOpenChange={setPaying} partyType="customer" />
      <StockDialog target={adjust} onClose={() => setAdjust(null)} />
    </div>
  );
}
