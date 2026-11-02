import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { toast } from "sonner";
import { CircleCheckBig, Factory, ListOrdered, PackagePlus, Plus, Search, Trash2, Truck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DueText, Field, PageHeader } from "@/components/common";
import { DiscountFields } from "@/components/DiscountFields";
import { Highlight } from "@/components/Highlight";
import { IconTile } from "@/components/Icon";
import { NumInput } from "@/components/NumInput";
import { SupplierPicker } from "@/components/PartyPicker";
import { PayMethodPicker } from "@/components/PayMethodPicker";
import { UNITS } from "@/lib/constants";
import { db } from "@/lib/db";
import { resolveDiscount } from "@/lib/discount";
import { round2 } from "@/lib/format";
import { useCatalog } from "@/lib/hooks";
import { searchCatalog } from "@/lib/search";
import { useI18n } from "@/lib/i18n";
import { createPurchase, newId, type PurchaseLine } from "@/lib/ops";
import type { DiscMode, PayMethod, Supplier } from "@/lib/types";

interface Draft {
  supplierId: string | null;
  lines: PurchaseLine[];
  disc_mode: DiscMode;
  disc_value: number;
  paid: number | null;
  method: PayMethod;
  bill_no: string;
  note: string;
}

const KEY = "erp.purchase.v1";
const empty = (): Draft => ({ supplierId: null, lines: [], disc_mode: "none", disc_value: 0, paid: 0, method: "cash", bill_no: "", note: "" });

function load(): Draft {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...empty(), ...JSON.parse(raw) } : empty();
  } catch {
    return empty();
  }
}

export default function Purchase() {
  const { L, B, money, num } = useI18n();
  const nav = useNavigate();
  const catalog = useCatalog();
  const [d, setD] = useState<Draft>(load);
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [picking, setPicking] = useState(false);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(d));
    } catch {
      /* ignore */
    }
  }, [d]);

  useEffect(() => {
    if (d.supplierId) void db.suppliers.get(d.supplierId).then((s) => s && setSupplier(s));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const balance = useLiveQuery(async () => (supplier ? ((await db.balances.get(supplier.id))?.amount ?? 0) : 0), [supplier?.id]) ?? 0;

  const results = useMemo(() => {
    if (!q.trim()) return [];
    const out: { key: string; label: string; sub: string; line: Omit<PurchaseLine, "key" | "qty"> ; icon?: string; color?: string; stock: number }[] = [];
    for (const { item, variants } of searchCatalog(catalog ?? [], q)) {
      for (const v of variants.length ? variants : item.variants) {
        out.push({
          key: v.id,
          label: `${item.product.name}${item.product.brand ? ` (${item.product.brand})` : ""}${v.name ? ` · ${v.name}` : ""}`,
          sub: `${L("শেষ কেনা দাম", "Last cost")} ${money(v.buy_price)} · ${L("বিক্রি", "Sell")} ${money(v.sell_price)}`,
          icon: item.category?.icon,
          color: item.category?.color,
          stock: v.stock,
          line: { variant_id: v.id, product_id: item.product.id, name: item.product.name, variant_name: v.name, unit: item.product.unit, price: v.buy_price },
        });
        if (out.length >= 25) return out;
      }
    }
    return out;
  }, [catalog, q, L, money]);

  const subtotal = round2(d.lines.reduce((s, l) => s + l.qty * l.price, 0));
  const disc = resolveDiscount(subtotal, d.disc_mode, d.disc_value);
  const total = disc.final;
  const paid = d.paid ?? total;
  const due = round2(Math.max(total - paid, 0));

  const set = (patch: Partial<Draft>) => setD((x) => ({ ...x, ...patch }));
  const setLine = (key: string, patch: Partial<PurchaseLine>) => setD((x) => ({ ...x, lines: x.lines.map((l) => (l.key === key ? { ...l, ...patch } : l)) }));

  function add(line: Omit<PurchaseLine, "key" | "qty">) {
    setD((x) => {
      const ex = x.lines.find((l) => l.variant_id === line.variant_id);
      if (ex) return { ...x, lines: x.lines.map((l) => (l === ex ? { ...l, qty: l.qty + 1 } : l)) };
      return { ...x, lines: [...x.lines, { ...line, key: newId(), qty: 1 }] };
    });
    setQ("");
  }

  async function save() {
    if (!supplier) {
      setPicking(true);
      return toast.error(L("সাপ্লায়ার বাছাই করুন", "Choose a supplier"));
    }
    if (!d.lines.length) return toast.error(L("অন্তত একটি পণ্য দিন", "Add at least one item"));
    setBusy(true);
    try {
      const p = await createPurchase({
        supplier,
        lines: d.lines,
        disc_mode: d.disc_mode,
        disc_value: d.disc_value,
        paid: Math.min(paid, total),
        method: d.method,
        bill_no: d.bill_no || undefined,
        note: d.note || undefined,
      });
      toast.success(L(`ক্রয় সেভ হয়েছে (${p.purchase_no}) — স্টক বেড়েছে`, `Purchase saved (${p.purchase_no}) — stock updated`));
      setD(empty());
      setSupplier(null);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        icon={Truck}
        color="#2563eb"
        title={L("মাল কেনা", "Purchase")}
        subtitle={L("সাপ্লায়ার থেকে মাল কিনলে এখানে লিখুন — স্টক নিজে থেকে বাড়বে", "Record stock bought from suppliers")}
        actions={
          <Button variant="outline" onClick={() => nav("/purchase/list")}>
            <ListOrdered /> {L("ক্রয়ের তালিকা", "Purchase list")}
          </Button>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
        <div className="grid content-start gap-4">
          <button
            type="button"
            onClick={() => setPicking(true)}
            className="flex items-center gap-3 rounded-2xl border-2 border-blue-200 bg-blue-50/60 p-4 text-left hover:border-blue-400"
          >
            <span className="grid size-12 place-items-center rounded-full bg-blue-600 text-white">
              <Factory className="size-6" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm text-muted-foreground">{L("কার কাছ থেকে কিনলেন?", "Bought from")}</span>
              <span className="block truncate text-lg font-bold">{supplier?.name ?? L("সাপ্লায়ার বাছাই করুন", "Choose supplier")}</span>
              {supplier && <DueText amount={balance} kind="supplier" className="text-sm" />}
            </span>
          </button>

          <Card>
            <CardContent className="grid gap-3">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground" />
                  <Input className="pl-10" placeholder={L("কোন মাল কিনলেন? নাম লিখুন…", "Which item? Type name…")} value={q} onChange={(e) => setQ(e.target.value)} />
                  {q && (
                    <Button variant="ghost" size="icon-sm" className="absolute top-1/2 right-2 -translate-y-1/2" onClick={() => setQ("")} aria-label="clear">
                      <X />
                    </Button>
                  )}
                </div>
                <Button variant="outline" onClick={() => nav("/products/new")}>
                  <PackagePlus /> <span className="hidden sm:inline">{L("নতুন পণ্য", "New product")}</span>
                </Button>
              </div>
              {q && (
                <div className="grid max-h-80 gap-1.5 overflow-y-auto rounded-xl border bg-muted/30 p-1.5">
                  {results.length === 0 && <p className="p-4 text-center text-muted-foreground">{L("পাওয়া যায়নি — 'নতুন পণ্য' দিয়ে যোগ করুন", "Not found — add as new product")}</p>}
                  {results.map((r) => (
                    <button key={r.key} type="button" onClick={() => add(r.line)} className="flex items-center gap-3 rounded-lg bg-white p-2.5 text-left hover:bg-blue-50">
                      <IconTile name={r.icon} color={r.color} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">
                          <Highlight text={r.label} q={q} />
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">{r.sub}</span>
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {L("স্টক", "Stock")} {num(r.stock)}
                      </span>
                      <Plus className="size-5 text-blue-600" />
                    </button>
                  ))}
                </div>
              )}

              {d.lines.length === 0 ? (
                <p className="py-8 text-center text-muted-foreground">{L("উপরে মালের নাম লিখে যোগ করুন", "Search above to add items")}</p>
              ) : (
                <div className="grid gap-2">
                  {d.lines.map((l) => (
                    <div key={l.key} className="grid grid-cols-2 gap-2 rounded-xl border bg-white p-3 sm:grid-cols-[1fr_100px_120px_120px_auto] sm:items-end">
                      <div className="col-span-2 min-w-0 sm:col-span-1">
                        <p className="truncate font-semibold">{l.name}</p>
                        <p className="truncate text-sm text-muted-foreground">
                          {l.variant_name} · {L("মোট", "Total")} <b className="tabular text-foreground">{money(l.qty * l.price)}</b>
                        </p>
                      </div>
                      <Field label={`${L("পরিমাণ", "Qty")} (${B(UNITS[l.unit])})`}>
                        <NumInput value={l.qty} allowEmpty={false} onValueChange={(n) => setLine(l.key, { qty: n })} />
                      </Field>
                      <Field label={L("কেনা দাম/একক", "Cost/unit")}>
                        <NumInput value={l.price} allowEmpty={false} onValueChange={(n) => setLine(l.key, { price: n })} prefix="৳" />
                      </Field>
                      <Field label={L("নতুন বিক্রি দাম", "New sell price")}>
                        <NumInput value={l.new_sell_price ?? 0} onValueChange={(n) => setLine(l.key, { new_sell_price: n || undefined })} prefix="৳" placeholder={L("আগেরটা", "same")} />
                      </Field>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="col-span-2 justify-self-end text-red-600 sm:col-span-1"
                        onClick={() => setD((x) => ({ ...x, lines: x.lines.filter((y) => y.key !== l.key) }))}
                        aria-label="remove"
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="h-fit lg:sticky lg:top-20">
          <CardContent className="grid gap-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{L("মোট", "Subtotal")}</span>
              <span className="tabular font-semibold">{money(subtotal)}</span>
            </div>
            <div>
              <p className="mb-1 text-sm font-semibold text-foreground/70">{L("সাপ্লায়ার ছাড় দিলে", "Supplier discount")}</p>
              <DiscountFields base={subtotal} mode={d.disc_mode} value={d.disc_value} onChange={(m, v) => set({ disc_mode: m, disc_value: v })} priceLabel={L("মোট বিল ৳", "Bill ৳")} compact />
            </div>
            <div className="flex items-center justify-between rounded-xl bg-blue-600 px-3 py-2 text-white">
              <span className="text-lg font-semibold">{L("সর্বমোট", "Total")}</span>
              <span className="tabular text-2xl font-bold">{money(total)}</span>
            </div>
            <Field label={L("এখন কত টাকা দিলেন?", "Paid now")}>
              <div className="flex gap-2">
                <NumInput value={paid} allowEmpty={false} onValueChange={(n) => set({ paid: n })} prefix="৳" className="flex-1 [&_input]:h-12 [&_input]:text-xl" />
                <Button variant="outline" className="h-12" onClick={() => set({ paid: null })}>
                  {L("পুরো", "Full")}
                </Button>
                <Button variant="outline" className="h-12 text-red-600" onClick={() => set({ paid: 0 })}>
                  {L("বাকি", "Credit")}
                </Button>
              </div>
            </Field>
            {due > 0 && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-center font-bold text-red-700">
                {L("সাপ্লায়ার পাবে (দেনা)", "Payable")}: {money(due)}
              </p>
            )}
            <PayMethodPicker value={d.method} onChange={(m) => set({ method: m })} compact />
            <Field label={L("সাপ্লায়ারের মেমো/চালান নং", "Supplier bill no")}>
              <Input value={d.bill_no} onChange={(e) => set({ bill_no: e.target.value })} />
            </Field>
            <Input placeholder={L("নোট (ইচ্ছা হলে)", "Note (optional)")} value={d.note} onChange={(e) => set({ note: e.target.value })} />
            <Button size="lg" className="h-14 bg-blue-600 text-lg hover:bg-blue-700" disabled={busy} onClick={() => void save()}>
              <CircleCheckBig className="size-6" /> {L("ক্রয় সেভ করুন", "Save purchase")}
            </Button>
          </CardContent>
        </Card>
      </div>

      <SupplierPicker
        open={picking}
        onOpenChange={setPicking}
        onPick={(s) => {
          setSupplier(s);
          set({ supplierId: s.id });
        }}
      />
    </div>
  );
}
