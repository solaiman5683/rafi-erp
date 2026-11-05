import { useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { toast } from "sonner";
import { Banknote, ChartColumn, MinusCircle, PlusCircle, TrendingUp, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Field, PageHeader, StatCard } from "@/components/common";
import { DateRangeBar, useDateRange, type DateRangeValue } from "@/components/DateRange";
import { ExportButtons } from "@/components/ExportButtons";
import { NumInput } from "@/components/NumInput";
import { Pager, usePaged } from "@/components/Pager";
import { PayMethodPicker } from "@/components/PayMethodPicker";
import { DailyBarChart } from "@/components/SalesChart";
import { PAY_METHODS, UNITS } from "@/lib/constants";
import { useCatalog, useCustomers, useExpenseCategories, useSuppliers } from "@/lib/hooks";
import { useI18n } from "@/lib/i18n";
import { cashLabel } from "@/lib/labels";
import { cashAdjust } from "@/lib/ops";
import { cashBalances, cashBook, summaryFor } from "@/lib/reports";
import { buildReport, type ReportTab } from "@/lib/tables";
import type { PayMethod } from "@/lib/types";
import { cn } from "@/lib/utils";

function Line({ label, value, strong, minus, tone }: { label: string; value: string; strong?: boolean; minus?: boolean; tone?: string }) {
  return (
    <div className={cn("flex items-center justify-between gap-4 border-b py-2.5 last:border-0", strong && "text-lg font-bold")}>
      <span className={cn(minus && "pl-4 text-muted-foreground")}>
        {minus && "− "}
        {label}
      </span>
      <span className={cn("tabular", tone)}>{value}</span>
    </div>
  );
}

const DATED: ReportTab[] = ["summary", "products", "cash"];

export default function Reports() {
  const i18n = useI18n();
  const { L } = i18n;
  const [params, setParams] = useSearchParams();
  const tab = (params.get("tab") ?? "summary") as ReportTab;
  const [range, setRange] = useDateRange("month");
  const dated = DATED.includes(tab);

  return (
    <div>
      <PageHeader
        icon={ChartColumn}
        color="#4f46e5"
        title={L("হিসাব ও রিপোর্ট", "Reports")}
        subtitle={L("লাভ-ক্ষতি, স্টক, বাকি ও ক্যাশের হিসাব", "Profit, stock, dues and cash")}
        actions={
          <ExportButtons
            build={() => buildReport(tab, range.from, range.to, i18n)}
            printUrl={`/print/table?kind=report&tab=${tab}&from=${range.from}&to=${range.to}`}
            fileName={`report-${tab}${dated ? `-${range.from}_${range.to}` : ""}.csv`}
          />
        }
      />
      <Tabs value={tab} onValueChange={(v) => setParams({ tab: v }, { replace: true })}>
        <div className="scrollbar-thin -mx-1 mb-4 overflow-x-auto px-1">
          <TabsList className="h-12!">
            <TabsTrigger value="summary">{L("লাভ-ক্ষতি", "Profit & loss")}</TabsTrigger>
            <TabsTrigger value="products">{L("কোন মাল বেশি চলে", "Top items")}</TabsTrigger>
            <TabsTrigger value="stock">{L("স্টক", "Stock")}</TabsTrigger>
            <TabsTrigger value="dues">{L("বাকি ও দেনা", "Dues")}</TabsTrigger>
            <TabsTrigger value="cash">{L("ক্যাশ বই", "Cash book")}</TabsTrigger>
          </TabsList>
        </div>
        {dated && (
          <div className="mb-4">
            <DateRangeBar value={range} onChange={setRange} keys={["today", "yesterday", "7d", "month", "lastMonth", "year", "all", "custom"]} />
          </div>
        )}
        <TabsContent value="summary">
          <SummaryTab range={range} />
        </TabsContent>
        <TabsContent value="products">
          <TopTab range={range} />
        </TabsContent>
        <TabsContent value="stock">
          <StockTab />
        </TabsContent>
        <TabsContent value="dues">
          <DuesTab />
        </TabsContent>
        <TabsContent value="cash">
          <CashTab range={range} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SummaryTab({ range }: { range: DateRangeValue }) {
  const { L, B, money } = useI18n();
  const expCats = useExpenseCategories();
  const s = useLiveQuery(() => summaryFor(range.from, range.to), [range.from, range.to]);
  if (!s) return null;
  const monthly = s.seriesBy === "month";
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={ChartColumn} color="#16a34a" label={L("মোট বিক্রি", "Net sales")} value={money(s.netSales)} />
        <StatCard icon={TrendingUp} color="#059669" label={L("মালে লাভ", "Gross profit")} value={money(s.grossProfit)} />
        <StatCard icon={Wallet} color="#e11d48" label={L("খরচ", "Expenses")} value={money(s.expenses)} />
        <StatCard icon={Banknote} color={s.netProfit >= 0 ? "#047857" : "#dc2626"} label={s.netProfit >= 0 ? L("আসল লাভ", "Net profit") : L("লোকসান", "Net loss")} value={money(s.netProfit)} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{L("লাভ-ক্ষতির হিসাব", "Profit & loss")}</CardTitle>
          </CardHeader>
          <CardContent>
            <Line label={L("মোট বিক্রি", "Sales")} value={money(s.sales)} />
            <Line minus label={L("ফেরত মাল", "Returns")} value={money(s.returns)} />
            <Line strong label={L("আসল বিক্রি", "Net sales")} value={money(s.netSales)} />
            <Line minus label={L("মালের কেনা দাম", "Cost of goods")} value={money(s.cost - s.returnCost)} />
            <Line strong label={L("মালে লাভ", "Gross profit")} value={money(s.grossProfit)} tone="text-emerald-700" />
            <Line minus label={L("দোকানের খরচ", "Expenses")} value={money(s.expenses)} />
            <Line strong label={L("আসল লাভ", "Net profit")} value={money(s.netProfit)} tone={s.netProfit >= 0 ? "text-emerald-700" : "text-red-600"} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{L("টাকার চলাচল", "Money flow")}</CardTitle>
          </CardHeader>
          <CardContent>
            <Line label={L("ছাড় দেওয়া হয়েছে", "Discounts given")} value={money(s.discount)} />
            <Line label={L("বিক্রিতে নগদ পেয়েছি", "Received on sales")} value={money(s.received)} />
            <Line label={L("বাকিতে বিক্রি", "Credit sales")} value={money(s.creditGiven)} tone="text-red-600" />
            <Line label={L("পুরনো বাকি আদায়", "Dues collected")} value={money(s.collections)} tone="text-emerald-700" />
            <Line label={L("মাল কেনা", "Purchases")} value={money(s.purchases)} />
            <Line label={L("সাপ্লায়ারকে দিয়েছি", "Paid to suppliers")} value={money(s.purchasePaid + s.supplierPayments)} />
            <Line strong label={L("মোট টাকা এসেছে", "Total in")} value={money(s.cashIn)} tone="text-emerald-700" />
            <Line strong label={L("মোট টাকা গেছে", "Total out")} value={money(s.cashOut)} tone="text-red-600" />
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{monthly ? L("মাসে মাসে বিক্রি", "Monthly sales") : L("দিনে দিনে বিক্রি", "Daily sales")}</CardTitle>
          </CardHeader>
          <CardContent>
            <DailyBarChart data={s.series as never} dataKey="sales" label={L("বিক্রি", "Sales")} color="#059669" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{monthly ? L("মাসে মাসে মালে লাভ", "Monthly gross profit") : L("দিনে দিনে মালে লাভ", "Daily gross profit")}</CardTitle>
          </CardHeader>
          <CardContent>
            <DailyBarChart data={s.series as never} dataKey="profit" label={L("লাভ", "Profit")} color="#4f46e5" />
          </CardContent>
        </Card>
      </div>
      {Object.keys(s.expenseByCat).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{L("কোন খাতে কত খরচ", "Expenses by category")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {Object.entries(s.expenseByCat)
              .sort((a, b) => b[1] - a[1])
              .map(([id, amt]) => {
                const c = expCats.find((x) => x.id === id);
                const pct = s.expenses > 0 ? (amt / s.expenses) * 100 : 0;
                return (
                  <div key={id} className="grid gap-1">
                    <div className="flex justify-between text-sm">
                      <span className="font-semibold">{c ? B(c.label) : id}</span>
                      <span className="tabular">{money(amt)}</span>
                    </div>
                    <div className="h-3 rounded-full bg-muted">
                      <div className="h-3 rounded-full bg-rose-500" style={{ width: `${Math.max(pct, 1)}%` }} />
                    </div>
                  </div>
                );
              })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function TopTab({ range }: { range: DateRangeValue }) {
  const { L, B, money, num } = useI18n();
  const s = useLiveQuery(() => summaryFor(range.from, range.to), [range.from, range.to]);
  const paged = usePaged(s?.top, [range.from, range.to]);
  return (
    <Card>
      <CardHeader>
        <CardTitle>{L("সবচেয়ে বেশি বিক্রি হওয়া মাল", "Best selling items")}</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto px-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">#</TableHead>
              <TableHead>{L("মাল", "Item")}</TableHead>
              <TableHead className="text-right">{L("পরিমাণ", "Qty")}</TableHead>
              <TableHead className="text-right">{L("বিক্রি", "Revenue")}</TableHead>
              <TableHead className="pr-4 text-right">{L("লাভ", "Profit")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.rows.map((t, i) => (
              <TableRow key={t.key}>
                <TableCell className="pl-4 text-muted-foreground">{num(paged.offset + i + 1)}</TableCell>
                <TableCell>
                  <span className="font-semibold">{t.name}</span> {t.variant && <span className="text-muted-foreground">· {t.variant}</span>}
                </TableCell>
                <TableCell className="tabular text-right">
                  {num(t.qty)} {B(UNITS[t.unit])}
                </TableCell>
                <TableCell className="tabular text-right">{money(t.revenue)}</TableCell>
                <TableCell className={cn("tabular pr-4 text-right font-semibold", t.profit >= 0 ? "text-emerald-700" : "text-red-600")}>{money(t.profit)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {s && s.top.length === 0 && <p className="py-8 text-center text-muted-foreground">{L("এই সময়ে কোনো বিক্রি নেই", "No sales in this period")}</p>}
        <div className="px-4">
          <Pager {...paged} />
        </div>
      </CardContent>
    </Card>
  );
}

function StockTab() {
  const { L, B, money, num } = useI18n();
  const catalog = useCatalog();
  const [q, setQ] = useState("");
  const rows = useMemo(
    () =>
      (catalog ?? [])
        .flatMap((i) =>
          i.variants.map((v) => ({
            id: v.id,
            name: i.product.name,
            brand: i.product.brand,
            variant: v.name,
            unit: i.product.unit,
            stock: v.stock,
            cost: v.buy_price,
            price: v.sell_price,
            low: v.stock <= (v.low_stock ?? 0),
          })),
        )
        .filter((r) => !q || `${r.name} ${r.brand ?? ""} ${r.variant}`.toLowerCase().includes(q.toLowerCase())),
    [catalog, q],
  );
  const paged = usePaged(rows, q);
  const value = rows.reduce((s, r) => s + Math.max(r.stock, 0) * r.cost, 0);
  const saleValue = rows.reduce((s, r) => s + Math.max(r.stock, 0) * r.price, 0);
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard icon={Banknote} color="#2563eb" label={L("স্টকের দাম (কেনা দামে)", "Stock value at cost")} value={money(value)} />
        <StatCard icon={TrendingUp} color="#16a34a" label={L("বিক্রি করলে পাবেন", "Value at sale price")} value={money(saleValue)} hint={L(`সম্ভাব্য লাভ ${money(saleValue - value)}`, `Potential profit ${money(saleValue - value)}`)} />
      </div>
      <Input placeholder={L("মাল খুঁজুন…", "Search items…")} value={q} onChange={(e) => setQ(e.target.value)} />
      <Card>
        <CardHeader>
          <CardTitle>{L("সব মালের স্টক", "Stock of all items")}</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">{L("মাল", "Item")}</TableHead>
                <TableHead className="text-right">{L("স্টক", "Stock")}</TableHead>
                <TableHead className="text-right">{L("কেনা দাম", "Cost")}</TableHead>
                <TableHead className="text-right">{L("বিক্রি দাম", "Price")}</TableHead>
                <TableHead className="pr-4 text-right">{L("মোট দাম", "Value")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.rows.map((r) => (
                <TableRow key={r.id} className={r.low ? "bg-red-50/60" : undefined}>
                  <TableCell className="pl-4">
                    <span className="font-semibold">{r.name}</span> {r.variant && <span className="text-muted-foreground">· {r.variant}</span>}
                    {r.brand && <span className="block text-xs text-muted-foreground">{r.brand}</span>}
                  </TableCell>
                  <TableCell className={cn("tabular text-right font-semibold", r.low && "text-red-600")}>
                    {num(r.stock)} {B(UNITS[r.unit])}
                  </TableCell>
                  <TableCell className="tabular text-right">{money(r.cost)}</TableCell>
                  <TableCell className="tabular text-right">{money(r.price)}</TableCell>
                  <TableCell className="tabular pr-4 text-right">{money(Math.max(r.stock, 0) * r.cost)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="px-4">
            <Pager {...paged} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function DueSection({ title, list, tone }: { title: string; list: { party: { id: string; name: string; phone?: string }; balance: number }[]; tone: string }) {
  const { L, money } = useI18n();
  const paged = usePaged(list, list.length, 15);
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {title}: <span className={cn("tabular", tone)}>{money(list.reduce((s, x) => s + x.balance, 0))}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-1.5">
        {list.length === 0 && <p className="py-6 text-center text-muted-foreground">{L("কিছু নেই", "None")}</p>}
        {paged.rows.map((x) => (
          <div key={x.party.id} className="flex items-center justify-between gap-3 rounded-xl border p-2.5">
            <span className="min-w-0">
              <span className="block truncate font-semibold">{x.party.name}</span>
              {x.party.phone && <span className="text-xs text-muted-foreground">{x.party.phone}</span>}
            </span>
            <span className={cn("tabular font-bold", tone)}>{money(x.balance)}</span>
          </div>
        ))}
        <Pager {...paged} size={15} />
      </CardContent>
    </Card>
  );
}

function DuesTab() {
  const { L } = useI18n();
  const customers = useCustomers();
  const suppliers = useSuppliers();
  const owe = useMemo(() => (customers ?? []).filter((c) => c.balance > 0.009).sort((a, b) => b.balance - a.balance), [customers]);
  const pay = useMemo(() => (suppliers ?? []).filter((c) => c.balance > 0.009).sort((a, b) => b.balance - a.balance), [suppliers]);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <DueSection title={L("কাস্টমারের কাছে পাওনা", "Receivable from customers")} list={owe} tone="text-red-600" />
      <DueSection title={L("সাপ্লায়ারকে দেনা", "Payable to suppliers")} list={pay} tone="text-amber-700" />
    </div>
  );
}

function CashTab({ range }: { range: DateRangeValue }) {
  const { L, B, money, date } = useI18n();
  const bal = useLiveQuery(() => cashBalances(), []);
  const book = useLiveQuery(() => cashBook(range.from, range.to), [range.from, range.to]);
  const paged = usePaged(book?.rows, [range.from, range.to]);
  const [adj, setAdj] = useState<"owner_in" | "owner_out" | "opening" | null>(null);
  const [amount, setAmount] = useState(0);
  const [method, setMethod] = useState<PayMethod>("cash");
  const [note, setNote] = useState("");

  async function saveAdj() {
    if (!adj || !amount) return toast.error(L("টাকার পরিমাণ লিখুন", "Enter amount"));
    await cashAdjust(adj, amount, method, note || undefined);
    toast.success(L("সেভ হয়েছে", "Saved"));
    setAdj(null);
  }

  const openAdj = (t: "owner_in" | "owner_out" | "opening") => {
    setAdj(t);
    setAmount(0);
    setNote("");
    setMethod("cash");
  };

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {PAY_METHODS.map((m) => (
          <div key={m.id} className="rounded-2xl border bg-white p-3">
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <span className={cn("size-2.5 rounded-full", m.color)} /> {B(m.label)}
            </p>
            <p className="tabular text-lg font-bold">{money(bal?.[m.id] ?? 0)}</p>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => openAdj("owner_in")}>
          <PlusCircle className="text-emerald-600" /> {L("ক্যাশে টাকা রাখলাম", "Add cash")}
        </Button>
        <Button variant="outline" onClick={() => openAdj("owner_out")}>
          <MinusCircle className="text-red-600" /> {L("মালিক টাকা নিলেন", "Owner withdrawal")}
        </Button>
        <Button variant="outline" onClick={() => openAdj("opening")}>
          <Banknote /> {L("শুরুর ক্যাশ বসান", "Set opening cash")}
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{L("ক্যাশ বই (শুধু নগদ)", "Cash book (cash only)")}</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">{L("তারিখ", "Date")}</TableHead>
                <TableHead>{L("বিবরণ", "Details")}</TableHead>
                <TableHead className="text-right">{L("এলো", "In")}</TableHead>
                <TableHead className="text-right">{L("গেলো", "Out")}</TableHead>
                <TableHead className="pr-4 text-right">{L("ব্যালেন্স", "Balance")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.page === 1 && (
                <TableRow className="bg-muted/50 font-semibold">
                  <TableCell className="pl-4" colSpan={4}>
                    {L("আগের জের", "Opening balance")}
                  </TableCell>
                  <TableCell className="tabular pr-4 text-right">{money(book?.opening ?? 0)}</TableCell>
                </TableRow>
              )}
              {paged.rows.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="pl-4 whitespace-nowrap">{date(c.date)}</TableCell>
                  <TableCell>
                    {cashLabel(c, L)}
                    {c.note && <span className="text-muted-foreground"> · {c.note}</span>}
                  </TableCell>
                  <TableCell className="tabular text-right text-emerald-700">{c.amount > 0 ? money(c.amount) : ""}</TableCell>
                  <TableCell className="tabular text-right text-red-600">{c.amount < 0 ? money(-c.amount) : ""}</TableCell>
                  <TableCell className="tabular pr-4 text-right font-semibold">{money(c.balance)}</TableCell>
                </TableRow>
              ))}
              {paged.page === paged.pages && (
                <TableRow className="bg-muted/50 font-bold">
                  <TableCell className="pl-4" colSpan={4}>
                    {L("এখন ক্যাশে", "Closing balance")}
                  </TableCell>
                  <TableCell className="tabular pr-4 text-right">{money(book?.rows.at(-1)?.balance ?? book?.opening ?? 0)}</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <div className="px-4">
            <Pager {...paged} />
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!adj} onOpenChange={(v) => !v && setAdj(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-xl">
              {adj === "owner_in" ? L("ক্যাশে টাকা রাখলাম", "Add cash") : adj === "owner_out" ? L("মালিক টাকা নিলেন", "Owner withdrawal") : L("শুরুর ক্যাশ", "Opening cash")}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <Field label={L("কত টাকা?", "Amount")}>
              <NumInput autoFocus value={amount} onValueChange={setAmount} prefix="৳" className="[&_input]:h-14 [&_input]:text-2xl" />
            </Field>
            <PayMethodPicker value={method} onChange={setMethod} compact />
            <Input placeholder={L("নোট", "Note")} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <DialogFooter>
            <Button size="lg" className="w-full" onClick={() => void saveAdj()}>
              {L("সেভ করুন", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
