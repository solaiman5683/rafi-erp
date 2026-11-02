import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";
import {
  CircleCheckBig,
  Minus,
  PackageSearch,
  Pencil,
  Plus,
  Printer,
  Search,
  ShoppingCart,
  Tag,
  Trash2,
  TriangleAlert,
  UserRound,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { DueText, EmptyState, Field, StockBadge } from "@/components/common";
import { DiscountFields } from "@/components/DiscountFields";
import { Highlight } from "@/components/Highlight";
import { IconTile, NamedIcon } from "@/components/Icon";
import { NumInput } from "@/components/NumInput";
import { CustomerPicker } from "@/components/PartyPicker";
import { PayMethodPicker } from "@/components/PayMethodPicker";
import { useAuth } from "@/lib/auth";
import { UNITS, WALK_IN } from "@/lib/constants";
import { db } from "@/lib/db";
import { calcLine } from "@/lib/discount";
import { round2 } from "@/lib/format";
import { useCatalog, useCategories, type CatalogItem, type VariantWithStock } from "@/lib/hooks";
import { searchCatalog, type SearchHit } from "@/lib/search";
import { useI18n } from "@/lib/i18n";
import { computeCart, createSale, newId, type CartLine } from "@/lib/ops";
import type { Customer, DiscMode, PayMethod, Sale } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useLiveQuery } from "dexie-react-hooks";

type Line = CartLine & { manual?: boolean };

interface Draft {
  lines: Line[];
  customerId: string | null;
  disc_mode: DiscMode;
  disc_value: number;
  paid: number | null;
  method: PayMethod;
  note: string;
}

const DRAFT_KEY = "erp.cart.v1";
const emptyDraft = (): Draft => ({ lines: [], customerId: null, disc_mode: "none", disc_value: 0, paid: null, method: "cash", note: "" });

function loadDraft(): Draft {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? { ...emptyDraft(), ...JSON.parse(raw) } : emptyDraft();
  } catch {
    return emptyDraft();
  }
}

function priceFor(v: VariantWithStock | { sell_price: number; wholesale_price?: number }, c: Customer | null) {
  return c?.price_tier === "wholesale" && v.wholesale_price ? v.wholesale_price : v.sell_price;
}

export default function Sell() {
  const { L, B, money, num } = useI18n();
  const { isOwner } = useAuth();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const catalog = useCatalog();
  const categories = useCategories();

  const [draft, setDraft] = useState<Draft>(loadDraft);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string | null>(null);
  const [variantFor, setVariantFor] = useState<CatalogItem | null>(null);
  const [variantMatched, setVariantMatched] = useState<string[]>([]);
  const [editKey, setEditKey] = useState<string | null>(null);
  const [pickCustomer, setPickCustomer] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [done, setDone] = useState<Sale | null>(null);
  const [busy, setBusy] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // ড্রাফট সবসময় সেভ — বিদ্যুৎ চলে গেলেও কার্ট হারাবে না
  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      /* ignore */
    }
  }, [draft]);

  // কাস্টমার লোড (ড্রাফট বা URL থেকে)
  useEffect(() => {
    const fromUrl = params.get("customer");
    // URL থেকে এলে নতুন করে কাস্টমার বসে (ছাড় সহ); ড্রাফট থেকে এলে আগের ছাড়/টাকা যেমন ছিল থাকে
    if (fromUrl) void db.customers.get(fromUrl).then((c) => c && chooseCustomer(c));
    else if (draft.customerId) void db.customers.get(draft.customerId).then((c) => c && setCustomer(c));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const variantIndex = useMemo(() => {
    const m = new Map<string, { item: CatalogItem; v: VariantWithStock }>();
    for (const item of catalog ?? []) for (const v of item.variants) m.set(v.id, { item, v });
    return m;
  }, [catalog]);

  const prevDue = useLiveQuery(async () => (customer ? ((await db.balances.get(customer.id))?.amount ?? 0) : 0), [customer?.id]) ?? 0;

  const filtered = useMemo(() => {
    const list = (catalog ?? []).filter((i) => !cat || i.product.category_id === cat);
    if (q.trim()) return searchCatalog(list, q);
    return list.slice(0, 120).map((item): SearchHit => ({ item, score: 0, fuzzy: false, variants: [], categoryMatched: false, brandMatched: false }));
  }, [catalog, cat, q]);

  const calc = useMemo(() => computeCart(draft.lines, draft.disc_mode, draft.disc_value), [draft.lines, draft.disc_mode, draft.disc_value]);
  const paid = draft.paid ?? calc.total;
  const change = round2(Math.max(paid - calc.total, 0));
  const due = round2(Math.max(calc.total - paid, 0));
  const count = draft.lines.length;

  const update = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  function chooseCustomer(c: Customer | null) {
    setCustomer(c);
    setDraft((d) => ({
      ...d,
      customerId: c?.id ?? null,
      // কাস্টমারের নিয়মিত ছাড় বিলে বসে যায় (পরে বদলানো যায়)
      disc_mode: c?.disc_mode ?? "none",
      disc_value: c?.disc_value ?? 0,
      paid: null,
      // পাইকারি কাস্টমার হলে দাম বদলে যায় (হাতে বদলানো দাম ছাড়া)
      lines: d.lines.map((l) => {
        if (l.manual) return l;
        const found = variantIndex.get(l.variant_id);
        return found ? { ...l, list_price: priceFor(found.v, c) } : l;
      }),
    }));
  }

  const stockOfVariant = (id: string) => variantIndex.get(id)?.v.stock ?? 0;

  /** স্টকের বেশি দিতে চাইলে সতর্কবার্তা */
  function warnStock(name: string, stock: number, unit: string) {
    const u = B(UNITS[unit]) || unit;
    toast.warning(
      stock > 0
        ? L(`${name}: স্টকে আছে মাত্র ${num(stock)} ${u} — এর বেশি দেওয়া যাবে না`, `${name}: only ${num(stock)} ${u} in stock`)
        : L(`${name}: স্টকে নেই`, `${name}: out of stock`),
    );
  }

  /** স্টক থাকলে এক যোগ করে; না থাকলে সতর্ক করে false দেয় */
  function addVariant(item: CatalogItem, v: VariantWithStock): boolean {
    const have = draft.lines.find((l) => l.variant_id === v.id)?.qty ?? 0;
    if (have + 1 > v.stock) {
      warnStock(`${item.product.name}${v.name ? ` ${v.name}` : ""}`, v.stock, item.product.unit);
      return false;
    }
    setDraft((d) => {
      const existing = d.lines.find((l) => l.variant_id === v.id);
      if (existing) return { ...d, lines: d.lines.map((l) => (l === existing ? { ...l, qty: round2(Math.min(l.qty + 1, v.stock)) } : l)) };
      const line: Line = {
        key: newId(),
        variant_id: v.id,
        product_id: item.product.id,
        name: item.product.name,
        variant_name: v.name,
        unit: item.product.unit,
        qty: 1,
        list_price: priceFor(v, customer),
        disc_mode: "none",
        disc_value: 0,
      };
      return { ...d, lines: [...d.lines, line] };
    });
    return true;
  }

  // পণ্যের পাতা থেকে "বিক্রি" চেপে এলে (?add=সাইজের id) সেই সাইজ কার্টে যোগ
  const addParam = params.get("add");
  const lastAdded = useRef<string | null>(null);
  useEffect(() => {
    if (!addParam || !catalog || lastAdded.current === addParam) return;
    lastAdded.current = addParam;
    const found = variantIndex.get(addParam);
    if (found && addVariant(found.item, found.v)) {
      toast.success(`${found.item.product.name}${found.v.name ? ` ${found.v.name}` : ""} ${L("যোগ হয়েছে", "added")}`, { duration: 1200 });
    }
    setParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addParam, catalog]);

  function onProductClick(item: CatalogItem, matched: VariantWithStock[] = []) {
    // একটাই সাইজ, অথবা খোঁজায় ঠিক একটা সাইজ মিলেছে ("randa 1/2") — সরাসরি যোগ
    const only = item.variants.length === 1 ? item.variants[0] : matched.length === 1 ? matched[0] : null;
    if (only) {
      if (addVariant(item, only)) toast.success(`${item.product.name}${only.name ? ` ${only.name}` : ""} ${L("যোগ হয়েছে", "added")}`, { duration: 900 });
    } else {
      setVariantMatched(matched.map((v) => v.id));
      setVariantFor(item);
    }
  }

  function onSearchEnter() {
    const term = q.trim().toLowerCase();
    if (!term) return;
    // বারকোড / কোড মিললে সরাসরি যোগ
    for (const { item, v } of variantIndex.values()) {
      if (v.sku && v.sku.toLowerCase() === term) {
        addVariant(item, v);
        setQ("");
        return;
      }
    }
    if (filtered.length === 1) {
      onProductClick(filtered[0].item, filtered[0].variants);
      setQ("");
    }
  }

  function setLine(key: string, patch: Partial<Line>) {
    const line = draft.lines.find((l) => l.key === key);
    if (line && patch.qty !== undefined) {
      const stock = stockOfVariant(line.variant_id);
      if (patch.qty > stock) {
        warnStock(`${line.name}${line.variant_name ? ` ${line.variant_name}` : ""}`, stock, line.unit);
        patch = { ...patch, qty: Math.max(stock, 0) };
      }
    }
    setDraft((d) => ({ ...d, lines: d.lines.map((l) => (l.key === key ? { ...l, ...patch } : l)) }));
  }

  function removeLine(key: string) {
    setDraft((d) => ({ ...d, lines: d.lines.filter((l) => l.key !== key) }));
  }

  /** সাইজ বাছাইয়ের ঘর থেকে এক কমানো; শূন্য হলে কার্ট থেকে বাদ */
  function decVariant(variantId: string) {
    setDraft((d) => ({
      ...d,
      lines: d.lines.flatMap((l) => (l.variant_id !== variantId ? [l] : l.qty > 1 ? [{ ...l, qty: round2(l.qty - 1) }] : [])),
    }));
  }

  function clearAll() {
    setDraft(emptyDraft());
    setCustomer(null);
  }

  async function complete() {
    if (!count) return toast.error(L("কার্টে কোনো পণ্য নেই", "Cart is empty"));
    const over = draft.lines.find((l) => l.qty > stockOfVariant(l.variant_id));
    if (over) return warnStock(`${over.name}${over.variant_name ? ` ${over.variant_name}` : ""}`, stockOfVariant(over.variant_id), over.unit);
    if (draft.lines.some((l) => l.qty <= 0)) return toast.error(L("পরিমাণ শূন্য হতে পারবে না", "Quantity can't be zero"));
    if (due > 0 && !customer) {
      toast.error(L("বাকি রাখতে হলে কাস্টমার বাছাই করুন", "Choose a customer for credit sale"));
      setPickCustomer(true);
      return;
    }
    setBusy(true);
    try {
      const sale = await createSale({
        customer,
        lines: draft.lines,
        disc_mode: draft.disc_mode,
        disc_value: draft.disc_value,
        paid: Math.min(paid, calc.total),
        method: draft.method,
        note: draft.note || undefined,
      });
      setDone(sale);
      setCartOpen(false);
      clearAll();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const editing = draft.lines.find((l) => l.key === editKey) ?? null;

  const cartPanel = (
    <div className="flex min-h-full flex-col gap-3">
      {/* কাস্টমার */}
      <button
        type="button"
        onClick={() => setPickCustomer(true)}
        className="flex items-center gap-3 rounded-2xl border-2 border-violet-200 bg-violet-50/60 p-3 text-left transition hover:border-violet-400"
      >
        <span className="grid size-11 place-items-center rounded-full bg-violet-600 text-white">
          <UserRound className="size-6" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs text-muted-foreground">{L("কাস্টমার", "Customer")}</span>
          <span className="block truncate font-bold">{customer?.name ?? B(WALK_IN)}</span>
          {customer && <DueText amount={prevDue} className="text-xs" />}
        </span>
        {customer ? (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={(e) => {
              e.stopPropagation();
              chooseCustomer(null);
            }}
            aria-label="remove customer"
          >
            <X />
          </Button>
        ) : (
          <span className="text-sm font-semibold text-violet-700">{L("বদলান", "Change")}</span>
        )}
      </button>

      {/* লাইন */}
      <div className="min-h-24 space-y-2">
        {!count && (
          <div className="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground">
            <ShoppingCart className="size-10" />
            <p>{L("বাম পাশ থেকে পণ্যে চাপ দিন", "Tap products to add")}</p>
          </div>
        )}
        {draft.lines.map((l) => {
          const c = calcLine(l.qty, l.list_price, l.disc_mode, l.disc_value);
          const stock = variantIndex.get(l.variant_id)?.v.stock ?? 0;
          return (
            <div key={l.key} className="rounded-xl border bg-white p-2.5 shadow-xs">
              <div className="flex items-start gap-2">
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setEditKey(l.key)}>
                  <p className="truncate font-semibold leading-tight">{l.name}</p>
                  {l.variant_name && <p className="truncate text-sm text-muted-foreground">{l.variant_name}</p>}
                </button>
                <Button variant="ghost" size="icon-sm" className="text-red-600" onClick={() => removeLine(l.key)} aria-label="remove">
                  <Trash2 />
                </Button>
              </div>
              <div className="mt-1.5 flex items-center gap-2">
                <div className="flex items-center rounded-lg border">
                  <Button variant="ghost" size="icon-sm" onClick={() => (l.qty > 1 ? setLine(l.key, { qty: round2(l.qty - 1) }) : removeLine(l.key))} aria-label="minus">
                    <Minus />
                  </Button>
                  <NumInput
                    value={l.qty}
                    allowEmpty={false}
                    onValueChange={(n) => setLine(l.key, { qty: n })}
                    className="w-16 [&_input]:h-9 [&_input]:border-0 [&_input]:px-1 [&_input]:text-center [&_input]:text-base"
                  />
                  <Button variant="ghost" size="icon-sm" disabled={l.qty >= stock} onClick={() => setLine(l.key, { qty: round2(l.qty + 1) })} aria-label="plus">
                    <Plus />
                  </Button>
                </div>
                <button type="button" onClick={() => setEditKey(l.key)} className="tabular min-w-0 flex-1 text-left text-sm text-muted-foreground">
                  × {money(c.price)}
                  {l.disc_mode !== "none" && c.disc_amount !== 0 && (
                    <span className="ml-1 inline-flex items-center gap-0.5 rounded bg-amber-100 px-1 text-xs font-semibold text-amber-800">
                      <Tag className="size-3" />
                      {num(c.percent)}%
                    </span>
                  )}
                </button>
                <span className="tabular font-bold">{money(c.total)}</span>
              </div>
              {l.qty > stock ? (
                <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-red-600">
                  <TriangleAlert className="size-3" /> {L(`স্টকে আছে মাত্র ${num(stock)} — পরিমাণ কমান`, `Only ${num(stock)} in stock — reduce quantity`)}
                </p>
              ) : (
                l.qty === stock && (
                  <p className="mt-1 flex items-center gap-1 text-xs font-medium text-amber-700">
                    <TriangleAlert className="size-3" /> {L("স্টকের সব নেওয়া হয়েছে", "All stock taken")}
                  </p>
                )
              )}
            </div>
          );
        })}
      </div>

      {/* হিসাব */}
      {count > 0 && (
        <div className="space-y-3 rounded-2xl border bg-white p-3 shadow-sm">
          <div className="flex justify-between text-base">
            <span className="text-muted-foreground">{L("মোট", "Subtotal")}</span>
            <span className="tabular font-semibold">{money(calc.subtotal)}</span>
          </div>
          <div>
            <p className="mb-1 text-sm font-semibold text-foreground/70">{L("পুরো বিলে ছাড়", "Bill discount")}</p>
            <DiscountFields
              base={calc.subtotal}
              mode={draft.disc_mode}
              value={draft.disc_value}
              onChange={(m, v) => update({ disc_mode: m, disc_value: v, paid: null })}
              priceLabel={L("মোট নিলেন ৳", "Final ৳")}
              compact
            />
          </div>
          <div className="flex items-center justify-between rounded-xl bg-emerald-600 px-3 py-2 text-white">
            <span className="text-lg font-semibold">{L("সর্বমোট", "Total")}</span>
            <span className="tabular text-2xl font-bold">{money(calc.total)}</span>
          </div>
          <Field label={L("কাস্টমার কত টাকা দিলেন?", "Amount received")}>
            <div className="flex gap-2">
              <NumInput value={paid} allowEmpty={false} onValueChange={(n) => update({ paid: n })} prefix="৳" className="flex-1 [&_input]:h-12 [&_input]:text-xl" />
              <Button variant="outline" className="h-12" onClick={() => update({ paid: null })}>
                {L("পুরো", "Full")}
              </Button>
              <Button variant="outline" className="h-12 text-red-600" onClick={() => update({ paid: 0 })}>
                {L("বাকি", "Credit")}
              </Button>
            </div>
          </Field>
          {change > 0 && (
            <p className="rounded-lg bg-sky-50 px-3 py-2 text-center font-bold text-sky-800">
              {L("ফেরত দিন", "Give change")}: {money(change)}
            </p>
          )}
          {due > 0 && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-center font-bold text-red-700">
              {L("বাকি থাকবে", "Due")}: {money(due)}
              {!customer && <span className="block text-xs font-medium">{L("বাকির জন্য কাস্টমার বাছাই করুন", "Choose a customer for credit")}</span>}
            </p>
          )}
          <PayMethodPicker value={draft.method} onChange={(m) => update({ method: m })} compact />
          <Input placeholder={L("নোট (ইচ্ছা হলে)", "Note (optional)")} value={draft.note} onChange={(e) => update({ note: e.target.value })} />
        </div>
      )}
      {/* শেষ বাটন সবসময় নিচে দেখা যাবে */}
      {count > 0 && (
        <div className="sticky bottom-0 z-10 -mx-3 mt-auto -mb-3 flex gap-2 rounded-b-3xl border-t bg-white/95 p-3 backdrop-blur">
          <Button variant="outline" size="lg" className="h-14 text-red-600" onClick={clearAll} aria-label="clear">
            <Trash2 />
          </Button>
          <Button size="lg" className="h-14 flex-1 bg-emerald-600 text-lg hover:bg-emerald-700" disabled={busy} onClick={() => void complete()}>
            <CircleCheckBig className="size-6" /> {L("বিক্রি সম্পন্ন", "Complete sale")} · <span className="tabular">{money(calc.total)}</span>
          </Button>
        </div>
      )}
    </div>
  );

  return (
    <div className="lg:grid lg:grid-cols-[1fr_340px] lg:gap-4 xl:grid-cols-[1fr_420px] xl:gap-5">
      {/* পণ্য */}
      <section className="@container min-w-0">
        <div className="mb-3 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={searchRef}
              autoFocus
              className="h-13 pl-10 text-lg"
              placeholder={L("পণ্যের নাম, সাইজ বা কোড লিখুন…", "Search name, size or code…")}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onSearchEnter()}
            />
            {q && (
              <Button variant="ghost" size="icon-sm" className="absolute top-1/2 right-2 -translate-y-1/2" onClick={() => setQ("")} aria-label="clear">
                <X />
              </Button>
            )}
          </div>
        </div>
        <div className="scrollbar-thin -mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-1">
          <button
            type="button"
            onClick={() => setCat(null)}
            className={cn("h-10 shrink-0 rounded-full border-2 px-4 font-semibold", !cat ? "border-primary bg-primary text-white" : "bg-white")}
          >
            {L("সব", "All")}
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCat(c.id === cat ? null : c.id)}
              className={cn("flex h-10 shrink-0 items-center gap-1.5 rounded-full border-2 px-3 font-semibold", cat === c.id ? "text-white" : "bg-white")}
              style={cat === c.id ? { backgroundColor: c.color, borderColor: c.color } : undefined}
            >
              <NamedIcon name={c.icon} className="size-4" style={cat === c.id ? undefined : { color: c.color }} />
              {B([c.name, c.name_en || c.name])}
            </button>
          ))}
        </div>

        {catalog && catalog.length === 0 ? (
          <EmptyState
            icon={PackageSearch}
            title={L("এখনো কোনো পণ্য নেই", "No products yet")}
            hint={L("আগে পণ্য যোগ করুন, তারপর বিক্রি করুন", "Add products first, then sell")}
            action={isOwner && <Button onClick={() => nav("/products/new")}><Plus /> {L("পণ্য যোগ করুন", "Add product")}</Button>}
          />
        ) : filtered.length === 0 ? (
          <p className="py-10 text-center text-muted-foreground">{L("কিছু পাওয়া যায়নি", "Nothing found")}</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 @lg:grid-cols-3 @3xl:grid-cols-4">
            {filtered.map(({ item, fuzzy, variants: matched, categoryMatched }, idx) => {
              const inCart = draft.lines.filter((l) => l.product_id === item.product.id).reduce((s, l) => s + l.qty, 0);
              const firstFuzzy = fuzzy && !filtered[idx - 1]?.fuzzy;
              return (
                <Fragment key={item.product.id}>
                {firstFuzzy && (
                  <p className="col-span-full flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
                    <Search className="size-4 shrink-0" /> {L("হুবহু মিলেনি — আপনি কি এগুলো খুঁজছেন?", "No exact match — did you mean these?")}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => onProductClick(item, matched)}
                  className={cn(
                    "relative flex flex-col gap-2 rounded-2xl border-2 bg-white p-3 text-left shadow-xs transition hover:-translate-y-0.5 hover:border-primary hover:shadow-md active:scale-[0.98]",
                    inCart > 0 && "border-emerald-500 bg-emerald-50/50",
                  )}
                >
                  {inCart > 0 && (
                    <span className="tabular absolute -top-2 -right-2 grid min-w-7 place-items-center rounded-full bg-emerald-600 px-1.5 py-0.5 text-sm font-bold text-white shadow">
                      {num(inCart)}
                    </span>
                  )}
                  <div className="flex items-center gap-2">
                    <IconTile name={item.category?.icon} color={item.category?.color} size="sm" />
                    {item.variants.length > 1 && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                        {num(item.variants.length)} {L("সাইজ", "sizes")}
                      </span>
                    )}
                  </div>
                  <div className="min-h-11">
                    <p className="line-clamp-2 leading-tight font-semibold">
                      <Highlight text={item.product.name} q={q} />
                    </p>
                    {item.product.brand && (
                      <p className="truncate text-sm font-semibold text-foreground/70">
                        <Highlight text={item.product.brand} q={q} />
                      </p>
                    )}
                    {categoryMatched && item.category && (
                      <p className="truncate text-xs text-muted-foreground">
                        <Highlight text={B([item.category.name, item.category.name_en || item.category.name])} q={q} />
                      </p>
                    )}
                    {matched.length > 0 && (
                      <p className="mt-1 flex flex-wrap gap-1">
                        {matched.slice(0, 4).map((v) => (
                          <span key={v.id} className="rounded bg-muted px-1.5 text-xs">
                            <Highlight text={v.name || v.sku || ""} q={q} />
                          </span>
                        ))}
                        {matched.length > 4 && <span className="text-xs text-muted-foreground">+{num(matched.length - 4)}</span>}
                      </p>
                    )}
                  </div>
                  <div className="flex items-end justify-between gap-1">
                    {matched.length === 1 ? (
                      <>
                        <span className="tabular font-bold text-emerald-700">{money(priceFor(matched[0], customer))}</span>
                        <StockBadge qty={matched[0].stock} low={matched[0].low_stock} unit={B(UNITS[item.product.unit])} />
                      </>
                    ) : (
                      <>
                        <span className="tabular font-bold text-emerald-700">
                          {money(item.minPrice)}
                          {item.maxPrice !== item.minPrice && "+"}
                        </span>
                        <StockBadge qty={item.totalStock} low={item.variants.length === 1 ? item.variants[0].low_stock : 0} unit={B(UNITS[item.product.unit])} />
                      </>
                    )}
                  </div>
                </button>
                </Fragment>
              );
            })}
          </div>
        )}
      </section>

      {/* ডেস্কটপ কার্ট */}
      <aside className="hidden lg:block">
        <div className="scrollbar-thin sticky top-20 h-[calc(100dvh-6.5rem)] overflow-y-auto rounded-3xl border bg-muted/40 p-3">{cartPanel}</div>
      </aside>

      {/* মোবাইল কার্ট বার */}
      {count > 0 && (
        <button
          type="button"
          onClick={() => setCartOpen(true)}
          className="no-print fixed inset-x-3 bottom-20 z-30 flex items-center gap-3 rounded-2xl bg-emerald-600 p-3 text-white shadow-xl lg:hidden"
        >
          <span className="relative grid size-11 place-items-center rounded-xl bg-white/20">
            <ShoppingCart className="size-6" />
            <span className="absolute -top-1.5 -right-1.5 grid size-6 place-items-center rounded-full bg-white text-xs font-bold text-emerald-700">{num(count)}</span>
          </span>
          <span className="flex-1 text-left">
            <span className="block text-sm opacity-90">{L("বিল দেখুন", "View bill")}</span>
            <span className="tabular block text-xl font-bold">{money(calc.total)}</span>
          </span>
          <span className="rounded-xl bg-white px-4 py-2 font-bold text-emerald-700">{L("এগিয়ে যান", "Next")} →</span>
        </button>
      )}
      <Sheet open={cartOpen} onOpenChange={setCartOpen}>
        <SheetContent side="bottom" className="h-[94dvh]! max-h-[94dvh] gap-2 overflow-hidden rounded-t-3xl p-3">
          <SheetHeader className="p-1">
            <SheetTitle className="text-xl">{L("বিল", "Bill")}</SheetTitle>
          </SheetHeader>
          <div className="-mx-3 min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-3">{cartPanel}</div>
        </SheetContent>
      </Sheet>

      <VariantDialog
        item={variantFor}
        q={q}
        matched={variantMatched}
        customer={customer}
        inCart={(id) => draft.lines.find((l) => l.variant_id === id)?.qty ?? 0}
        onAdd={(v) => variantFor && addVariant(variantFor, v)}
        onRemove={(v) => decVariant(v.id)}
        onClose={() => setVariantFor(null)}
      />

      <LineEditor
        line={editing}
        cost={editing ? (variantIndex.get(editing.variant_id)?.v.buy_price ?? 0) : 0}
        showCost={isOwner}
        onClose={() => setEditKey(null)}
        onSave={(patch) => editing && setLine(editing.key, patch)}
        onRemove={() => editing && removeLine(editing.key)}
      />

      <CustomerPicker open={pickCustomer} onOpenChange={setPickCustomer} onPick={chooseCustomer} />

      <Dialog open={!!done} onOpenChange={(v) => !v && setDone(null)}>
        <DialogContent className="text-center">
          <div className="mx-auto grid size-20 place-items-center rounded-full bg-emerald-100 text-emerald-600">
            <CircleCheckBig className="size-12" />
          </div>
          <DialogHeader>
            <DialogTitle className="text-center text-2xl">{L("বিক্রি হয়েছে!", "Sale completed!")}</DialogTitle>
          </DialogHeader>
          {done && (
            <div className="space-y-1 text-lg">
              <p>
                {L("মেমো নং", "Memo no")}: <b>{done.invoice_no}</b>
              </p>
              <p>
                {L("মোট", "Total")}: <b className="tabular">{money(done.total)}</b>
              </p>
              {done.due > 0 && (
                <p className="font-bold text-red-600">
                  {L("বাকি", "Due")}: {money(done.due)}
                </p>
              )}
            </div>
          )}
          <DialogFooter className="grid grid-cols-2 gap-2 sm:grid-cols-2">
            <Button variant="outline" size="lg" onClick={() => done && window.open(`/print/sale/${done.id}?auto=1`, "_blank")}>
              <Printer /> {L("মেমো প্রিন্ট", "Print memo")}
            </Button>
            <Button
              size="lg"
              onClick={() => {
                setDone(null);
                searchRef.current?.focus();
              }}
            >
              <Plus /> {L("নতুন বিক্রি", "New sale")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function VariantDialog({
  item,
  q,
  matched,
  customer,
  inCart,
  onAdd,
  onRemove,
  onClose,
}: {
  item: CatalogItem | null;
  q: string;
  matched: string[];
  customer: Customer | null;
  inCart: (variantId: string) => number;
  onAdd: (v: VariantWithStock) => void;
  onRemove: (v: VariantWithStock) => void;
  onClose: () => void;
}) {
  const { L, B, money, num } = useI18n();
  return (
    <Dialog open={!!item} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-xl">{item?.product.name}</DialogTitle>
          <p className="text-muted-foreground">{L("যেটা লাগবে সেটাতে চাপ দিন, − / + দিয়ে সংখ্যা কমান-বাড়ান", "Tap what you need, use − / + to change quantity")}</p>
        </DialogHeader>
        <div className="grid max-h-[55vh] gap-2 overflow-y-auto">
          {[...(item?.variants ?? [])].sort((a, b) => Number(matched.includes(b.id)) - Number(matched.includes(a.id))).map((v) => {
            const n = inCart(v.id);
            return (
              <div
                key={v.id}
                className={cn("flex items-center gap-2 rounded-xl border-2 bg-white p-2 pl-3 transition", n > 0 && "border-emerald-500 bg-emerald-50")}
              >
                <button type="button" onClick={() => onAdd(v)} className="flex min-w-0 flex-1 items-center gap-2 py-1 text-left active:scale-[0.99]">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-lg font-bold">{v.name ? <Highlight text={v.name} q={q} /> : L("সাধারণ", "Standard")}</span>
                    <StockBadge qty={v.stock} low={v.low_stock} unit={B(UNITS[item!.product.unit])} />
                    {n > 0 && n >= v.stock && (
                      <span className="mt-1 flex items-center gap-1 text-xs font-semibold text-amber-700">
                        <TriangleAlert className="size-3" /> {L(`স্টকের সব (${num(v.stock)}) নেওয়া হয়েছে`, `All ${num(v.stock)} in stock taken`)}
                      </span>
                    )}
                  </span>
                  <span className="tabular text-lg font-bold text-emerald-700">{money(priceFor(v, customer))}</span>
                </button>
                {v.stock <= 0 ? (
                  <span className="rounded-full bg-red-50 px-3 py-2 text-sm font-semibold text-red-600">{L("স্টক নেই", "Out of stock")}</span>
                ) : n > 0 ? (
                  <span className="flex items-center gap-1">
                    <Button variant="outline" size="icon" className="rounded-full" onClick={() => onRemove(v)} aria-label="minus">
                      <Minus />
                    </Button>
                    <span className="tabular w-8 text-center text-lg font-bold">{num(n)}</span>
                    <Button size="icon" className="rounded-full bg-emerald-600 hover:bg-emerald-700" disabled={n >= v.stock} onClick={() => onAdd(v)} aria-label="plus">
                      <Plus />
                    </Button>
                  </span>
                ) : (
                  <Button variant="secondary" size="icon" className="rounded-full" onClick={() => onAdd(v)} aria-label="add">
                    <Plus />
                  </Button>
                )}
              </div>
            );
          })}
        </div>
        <DialogFooter>
          <Button size="lg" className="w-full" onClick={onClose}>
            <CircleCheckBig /> {L("হয়ে গেছে", "Done")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LineEditor({
  line,
  cost,
  showCost,
  onClose,
  onSave,
  onRemove,
}: {
  line: Line | null;
  cost: number;
  showCost: boolean;
  onClose: () => void;
  onSave: (patch: Partial<Line>) => void;
  onRemove: () => void;
}) {
  const { L, B, money } = useI18n();
  const [f, setF] = useState<Line | null>(line);
  useEffect(() => setF(line), [line]);
  if (!f) return <Dialog open={false} />;
  const c = calcLine(f.qty, f.list_price, f.disc_mode, f.disc_value);
  const unit = B(UNITS[f.unit]) || f.unit;
  const belowCost = cost > 0 && c.price < cost;

  return (
    <Dialog open={!!line} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-xl">
            {f.name} {f.variant_name && <span className="text-muted-foreground">· {f.variant_name}</span>}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label={L(`পরিমাণ (${unit})`, `Quantity (${unit})`)}>
              <NumInput value={f.qty} allowEmpty={false} onValueChange={(n) => setF({ ...f, qty: n })} />
            </Field>
            <Field label={L(`দাম (প্রতি ${unit})`, `Price (per ${unit})`)}>
              <NumInput value={f.list_price} allowEmpty={false} onValueChange={(n) => setF({ ...f, list_price: n, manual: true })} prefix="৳" />
            </Field>
          </div>
          <Field label={L("ছাড় — যেকোনো একটা ঘরে লিখুন", "Discount — fill any one box")}>
            <DiscountFields
              base={round2(f.qty * f.list_price)}
              unitQty={f.qty}
              mode={f.disc_mode}
              value={f.disc_value}
              onChange={(m, v) => setF({ ...f, disc_mode: m, disc_value: v })}
              priceLabel={L(`বিক্রি দাম/${unit}`, `Sold/${unit}`)}
            />
          </Field>
          <div className="flex items-center justify-between rounded-xl bg-emerald-50 px-4 py-3">
            <span className="font-semibold">{L("এই লাইনের মোট", "Line total")}</span>
            <span className="tabular text-2xl font-bold text-emerald-700">{money(c.total)}</span>
          </div>
          {showCost && cost > 0 && (
            <p className="text-sm text-muted-foreground">
              {L("কেনা দাম", "Cost")}: {money(cost)} · {L("লাভ", "Profit")}: <b className={belowCost ? "text-red-600" : "text-emerald-700"}>{money((c.price - cost) * f.qty)}</b>
            </p>
          )}
          {belowCost && (
            <p className="flex items-center gap-2 rounded-xl bg-red-50 p-3 font-semibold text-red-700">
              <TriangleAlert className="size-5 shrink-0" /> {L("সাবধান! দাম খুব কম — লোকসান হবে", "Careful! Price is below cost")}
            </p>
          )}
        </div>
        <DialogFooter className="grid grid-cols-[auto_1fr] gap-2 sm:grid-cols-[auto_1fr]">
          <Button
            variant="destructive"
            size="lg"
            onClick={() => {
              onRemove();
              onClose();
            }}
          >
            <Trash2 />
          </Button>
          <Button
            size="lg"
            onClick={() => {
              onSave({ qty: f.qty, list_price: f.list_price, disc_mode: f.disc_mode, disc_value: f.disc_value, manual: f.manual });
              onClose();
            }}
          >
            <Pencil /> {L("ঠিক আছে", "Apply")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
