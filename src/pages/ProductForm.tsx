import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { toast } from "sonner";
import { Boxes, ClipboardList, GitMerge, Info, Layers, Pencil, Plus, Save, Trash2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmAction, Field, PageHeader } from "@/components/common";
import { Highlight } from "@/components/Highlight";
import { IconTile, NamedIcon } from "@/components/Icon";
import { NumInput } from "@/components/NumInput";
import { StockDialog, type StockTarget } from "@/components/StockDialog";
import { CATEGORY_COLORS, CATEGORY_ICONS, COMMON_SIZES, UNITS } from "@/lib/constants";
import { db } from "@/lib/db";
import { useCatalog, useCategories } from "@/lib/hooks";
import { matchesText, normalize, prettySize, sameText, searchCatalog } from "@/lib/search";
import { useI18n } from "@/lib/i18n";
import { deleteProduct, newId, saveCategory, saveProduct, type VariantDraft } from "@/lib/ops";
import type { Category, Product } from "@/lib/types";
import { cn } from "@/lib/utils";

type Row = VariantDraft & { key: string; isNew: boolean };

const blankRow = (name = ""): Row => ({ key: newId(), name, buy_price: 0, sell_price: 0, wholesale_price: 0, opening: 0, isNew: true });

const QUICK_UNITS = ["pcs", "kg", "feet", "meter", "gauge", "box", "coil", "set", "liter"];

/** সাইজের মান (সাজানোর জন্য): ¾" → 0.75, 1¼" → 1.25; সংখ্যা না থাকলে শেষে */
function sizeValue(s: string): number {
  const t = normalize(s);
  let m = t.match(/^(\d+)\s+(\d+)\/(\d+)/);
  if (m) return Number(m[1]) + Number(m[2]) / Number(m[3]);
  m = t.match(/^(\d+)\/(\d+)/);
  if (m) return Number(m[1]) / Number(m[2]);
  m = t.match(/^\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : Infinity;
}

/** সাইজের ঘরে চাপ দিলে আগে দেওয়া সাইজগুলো দেখায়; চাপ দিলে ঘরে চলে যায়, অন্য সারিতে নেওয়া সাইজ বন্ধ থাকে */
function SizeChips({ sizes, onPick, isOn, isUsed }: { sizes: string[]; onPick: (s: string) => void; isOn: (s: string) => boolean; isUsed?: (s: string) => boolean }) {
  return (
    <div className="mt-1 flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
      {sizes.map((s) => (
        <button
          key={s}
          type="button"
          disabled={isUsed?.(s)}
          // ঘর থেকে ফোকাস না সরিয়ে বাছাই
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onPick(s)}
          className={cn(
            "h-9 min-w-11 rounded-lg border-2 px-2 text-base font-semibold disabled:opacity-35",
            isOn(s) ? "border-primary bg-primary text-white" : "bg-white hover:border-primary hover:bg-primary/5",
          )}
        >
          {s}
        </button>
      ))}
    </div>
  );
}

export default function ProductForm() {
  const { id } = useParams();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const addMode = params.has("add");
  // কোথা থেকে এসেছে: বিক্রির পাতা (সেভ হলে কার্টে যোগ) বা হোম (তথ্য বাকি থাকা পণ্য)
  const from = params.get("from");
  const backTo = from === "sell" ? "/sell" : from === "home" ? "/" : "/products";
  const { L, B, num } = useI18n();
  const categories = useCategories();
  const catalog = useCatalog();
  const [p, setP] = useState<Partial<Product>>({ name: params.get("name") ?? "", unit: "pcs", brand: "", note: "" });
  const [rows, setRows] = useState<Row[]>([blankRow()]);
  // বেশিরভাগ পণ্যের অনেক সাইজ থাকে, তাই নতুন পণ্যে এটাই আগে বাছা থাকে
  const [multi, setMulti] = useState(true);
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const [nameFocus, setNameFocus] = useState(!id);
  const [adjust, setAdjust] = useState<StockTarget | null>(null);
  const [newCat, setNewCat] = useState<Partial<Category> | null>(null);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(!id);

  useEffect(() => {
    if (!id) return;
    void (async () => {
      const prod = await db.products.get(id);
      if (!prod) return nav("/products");
      const vs = (await db.variants.where("product_id").equals(id).toArray()).filter((v) => !v.deleted).sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
      setP(prod);
      const existing: Row[] = vs.map((v) => ({ ...v, key: v.id, isNew: false }));
      // নতুন পণ্যের ঘর থেকে "সাইজ যোগ করুন" চেপে এলে একটা খালি সাইজের ঘর তৈরি থাকে
      setRows(addMode ? [...existing, blankRow()] : existing);
      setMulti(addMode || vs.length > 1 || (vs.length === 1 && !!vs[0].name));
      setLoaded(true);
    })();
  }, [id, nav, addMode]);

  // আগে ব্যবহার করা সব ব্র্যান্ড (বেশি ব্যবহৃতগুলো আগে)
  const brands = useMemo(() => {
    const m = new Map<string, { name: string; n: number }>();
    for (const c of catalog ?? []) {
      const b = c.product.brand?.trim();
      if (!b) continue;
      const k = b.toLowerCase();
      const cur = m.get(k);
      if (cur) cur.n++;
      else m.set(k, { name: b, n: 1 });
    }
    return [...m.values()].sort((a, b) => b.n - a.n || a.name.localeCompare(b.name)).map((x) => x.name);
  }, [catalog]);
  const brandText = p.brand?.trim() ?? "";
  const brandExact = brands.find((b) => sameText(b, brandText));
  const brandChoices = useMemo(() => {
    const list = brandText && !brandExact ? brands.filter((b) => matchesText(b, brandText)) : brands;
    return list.slice(0, 24);
  }, [brands, brandText, brandExact]);

  // নতুন পণ্যের নাম লেখার সময় আগের কাছাকাছি নামের পণ্য
  const nameText = p.name?.trim() ?? "";
  const nameHits = useMemo(() => {
    if (id || nameText.length < 2) return [];
    return searchCatalog(catalog ?? [], nameText, 40)
      .map((h) => h.item)
      .filter((i) => matchesText(i.product.name, nameText))
      .sort((a, b) => Number(sameText(b.product.name, nameText)) - Number(sameText(a.product.name, nameText)))
      .slice(0, 6);
  }, [catalog, id, nameText]);
  const sameName = nameHits.filter((i) => sameText(i.product.name, nameText));
  // নাম, ব্র্যান্ড ও ক্যাটাগরি সব মিললে নতুন পণ্য না হয়ে আগেরটাতেই সাইজ হিসেবে যোগ হবে
  const mergeTarget = id
    ? undefined
    : (catalog ?? []).find((i) => sameText(i.product.name, nameText) && sameText(i.product.brand ?? "", brandText) && (i.product.category_id ?? "") === (p.category_id ?? ""));

  // আগের সব পণ্যে দেওয়া সাইজ (ছোট থেকে বড়); কিছু না থাকলে সাধারণ ইঞ্চি সাইজ
  const knownSizes = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of catalog ?? []) for (const v of c.variants) if (v.name.trim() && !m.has(normalize(v.name))) m.set(normalize(v.name), v.name.trim());
    const list = [...m.values()];
    if (!list.length) return COMMON_SIZES;
    return list.sort((a, b) => sizeValue(a) - sizeValue(b) || a.localeCompare(b));
  }, [catalog]);
  const sizesFor = (typed: string) => {
    const t = typed.trim();
    if (!t) return knownSizes;
    // "3/4" লিখলে ¾", "1 1/4" লিখলে 1¼" — সুন্দর রূপটা সবার আগে
    const pretty = prettySize(t);
    const rest = pretty ? knownSizes.filter((s) => normalize(s) !== normalize(pretty)) : knownSizes;
    // লেখার সাথে মেলে এমনগুলো আগে, বাকিগুলোও থাকে
    const hit = rest.filter((s) => matchesText(s, t));
    return [...(pretty && pretty !== t ? [pretty] : []), ...hit, ...rest.filter((s) => !hit.includes(s))];
  };

  // এডিটের সময় এই পণ্যের সাইজগুলোর এখনকার স্টক (স্টক ঠিক করার জন্য)
  const thisItem = id ? catalog?.find((i) => i.product.id === id) : undefined;

  const setRow = (key: string, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  async function submit() {
    if (!p.name?.trim()) return toast.error(L("পণ্যের নাম লিখুন", "Enter product name"));
    let list = multi ? rows.filter((r) => r.name.trim() || !r.isNew) : rows.slice(0, 1).map((r) => ({ ...r, name: "" }));
    // সাইজ না লিখলেও চলবে: একটা সাধারণ ধরন হিসেবে সেভ হবে
    if (!list.length) list = rows.slice(0, 1).map((r) => ({ ...r, name: "" }));
    if (list.length > 1 && list.some((r) => !r.name.trim())) return toast.error(L("প্রতিটা সাইজের নাম দিন", "Name every variant"));
    // দাম বা স্টক না দিলেও সেভ হয় — হোম পেজের "তথ্য বাকি" তালিকায় পরে দেখাবে
    // পাইকারি দাম ফাঁকা থাকলে বিক্রি দামই পাইকারি দাম
    const drafts: VariantDraft[] = list.map(({ key: _k, isNew, ...r }) => ({
      ...r,
      id: isNew ? undefined : r.id,
      name: r.name.trim(),
      wholesale_price: r.wholesale_price && r.wholesale_price > 0 ? r.wholesale_price : r.sell_price,
      opening: isNew ? r.opening : undefined,
    }));
    setBusy(true);
    try {
      if (mergeTarget) {
        const old = (await db.variants.where("product_id").equals(mergeTarget.product.id).toArray())
          .filter((v) => !v.deleted)
          .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
        const fresh = drafts.filter((d) => !old.some((v) => sameText(v.name, d.name)));
        const skipped = drafts.length - fresh.length;
        if (!fresh.length) {
          toast.error(L("এই সব সাইজ ওই পণ্যে আগেই আছে", "All these sizes already exist on that product"));
          return;
        }
        await saveProduct(mergeTarget.product, [...old.map((v) => ({ ...v })), ...fresh]);
        await done(mergeTarget.product.id, fresh.map((f) => f.name));
        toast.success(
          L(`আগের "${mergeTarget.product.name}" পণ্যে ${num(fresh.length)}টি সাইজ যোগ হয়েছে`, `Added ${fresh.length} size(s) to the existing "${mergeTarget.product.name}"`),
          skipped ? { description: L(`${num(skipped)}টি সাইজ আগেই ছিল, বাদ দেওয়া হয়েছে`, `${skipped} size(s) already existed and were skipped`) } : undefined,
        );
        return;
      }
      const saved = await saveProduct({ ...p, name: p.name.trim(), brand: brandExact ?? brandText, unit: p.unit ?? "pcs" } as Product, drafts);
      toast.success(L("পণ্য সেভ হয়েছে", "Product saved"));
      await done(saved.id, drafts.filter((d) => !d.id).map((d) => d.name));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  /** সেভের পর ফেরা; বিক্রির পাতা থেকে এলে নতুন সাইজটা কার্টে, অনেক সাইজ হলে সাইজ বাছাইয়ের ঘর খোলা অবস্থায় */
  async function done(productId: string, newNames: string[]) {
    if (from !== "sell") return nav(backTo);
    const vs = (await db.variants.where("product_id").equals(productId).toArray()).filter((v) => !v.deleted);
    const fresh = vs.filter((v) => newNames.some((n) => sameText(n, v.name)));
    const one = fresh.length === 1 ? fresh[0] : vs.length === 1 ? vs[0] : null;
    nav(one ? `/sell?add=${one.id}` : `/sell?pick=${productId}`);
  }

  if (!loaded) return null;
  const unitLabel = B(UNITS[p.unit ?? "pcs"]);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        back={backTo}
        icon={Boxes}
        color="#ea580c"
        title={id ? L("পণ্য এডিট", "Edit product") : L("নতুন পণ্য", "New product")}
        actions={
          id && (
            <ConfirmAction
              destructive
              title={L("পণ্যটি মুছে ফেলবেন?", "Delete this product?")}
              description={L("আগের বিক্রির হিসাব ঠিক থাকবে, শুধু তালিকা থেকে সরে যাবে।", "Past sales stay intact; it will be removed from the list.")}
              confirmText={L("হ্যাঁ, মুছুন", "Delete")}
              onConfirm={async () => {
                await deleteProduct(id);
                toast.success(L("মুছে ফেলা হয়েছে", "Deleted"));
                nav(backTo);
              }}
              trigger={
                <Button variant="destructive">
                  <Trash2 /> {L("মুছুন", "Delete")}
                </Button>
              }
            />
          )
        }
      />

      {!id && (
        <p className="mb-4 flex items-start gap-2 rounded-2xl border-2 border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-900">
          <Info className="mt-0.5 size-4 shrink-0" />
          {from === "sell"
            ? L("শুধু নাম দিলেই হবে — সেভ করলে বিক্রির পাতায় ফিরে কার্টে যোগ হবে। দাম, স্টক পরে দিলেও চলবে।", "A name is enough — saving takes you back to the cart with it added. Price and stock can be added later.")
            : L("শুধু নাম দিলেই সেভ হবে। দাম, স্টক পরে দিলেও চলবে — হোম পেজে মনে করিয়ে দেবে।", "A name is enough to save. Price and stock can be added later — the home page will remind you.")}
        </p>
      )}

      <div className="grid gap-5">
        <Card>
          <CardContent className="grid gap-4">
            <Field label={L("পণ্যের নাম *", "Product name *")}>
              <Input autoFocus={!id} value={p.name ?? ""} onFocus={() => setNameFocus(true)} onBlur={() => setNameFocus(false)} onChange={(e) => setP({ ...p, name: e.target.value })} placeholder={L("যেমন: জিআই পাইপ, পিভিসি এলবো, তালা", "e.g. GI Pipe, PVC Elbow")} />
              {nameFocus && nameHits.length > 0 && (
                // ঘর থেকে বের হলে লুকায়; তালিকায় চাপ দিলে ফোকাস ঘরেই থাকে
                <div className="grid gap-2 rounded-2xl border-2 border-amber-300 bg-amber-50/70 p-2.5" onMouseDown={(e) => e.preventDefault()}>
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-amber-900">
                    <TriangleAlert className="size-4 shrink-0" />
                    {sameName.length
                      ? L("এই নামে পণ্য আগেই আছে! নতুন না বানিয়ে ওটাতেই সাইজ যোগ করুন", "A product with this name exists! Add a size to it instead")
                      : L("এই রকম নামের পণ্য আগে থেকে আছে — একই হলে ওটাতেই সাইজ যোগ করুন", "Similar products exist — if it's the same, add a size to it")}
                  </p>
                  <p className="text-xs text-amber-900/80">{L("নামে চাপ দিলে নামটা ঘরে বসবে", "Tap a name to use it")}</p>
                  {nameHits.map((i) => (
                    <div key={i.product.id} className="flex items-center gap-2.5 rounded-xl bg-white p-2">
                      <IconTile name={i.category?.icon} color={i.category?.color} size="sm" />
                      <div className="min-w-0 flex-1">
                        <button
                          type="button"
                          className="block max-w-full truncate text-left font-semibold underline-offset-2 hover:text-primary hover:underline"
                          title={L("এই নামটা নিন", "Use this name")}
                          onClick={() => setP({ ...p, name: i.product.name })}
                        >
                          <Highlight text={i.product.name} q={nameText} />
                        </button>
                        <p className="truncate text-xs text-muted-foreground">
                          {[i.product.brand, i.category && B([i.category.name, i.category.name_en || i.category.name]), `${num(i.variants.length)} ${L("সাইজ", "sizes")}`].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                      <Button type="button" variant="outline" size="sm" onClick={() => nav(`/products/${i.product.id}?add=1`)}>
                        <Pencil /> {L("সাইজ যোগ করুন", "Add size")}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </Field>
            <Field label={L("ক্যাটাগরি", "Category")}>
              <div className="flex flex-wrap gap-2">
                {categories.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setP({ ...p, category_id: c.id })}
                    className={cn("flex h-10 items-center gap-1.5 rounded-full border-2 px-3 text-sm font-semibold", p.category_id === c.id ? "text-white" : "bg-white")}
                    style={p.category_id === c.id ? { backgroundColor: c.color, borderColor: c.color } : undefined}
                  >
                    <NamedIcon name={c.icon} className="size-4" style={p.category_id === c.id ? undefined : { color: c.color }} />
                    {B([c.name, c.name_en || c.name])}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setNewCat({ icon: "Package", color: CATEGORY_COLORS[0] })}
                  className="flex h-10 items-center gap-1.5 rounded-full border-2 border-dashed px-3 text-sm font-semibold text-muted-foreground hover:border-primary hover:text-primary"
                >
                  <Plus className="size-4" /> {L("নতুন ক্যাটাগরি", "New category")}
                </button>
              </div>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={L("ব্র্যান্ড / কোম্পানি", "Brand")}>
                <Input value={p.brand ?? ""} onChange={(e) => setP({ ...p, brand: e.target.value })} placeholder={L("নিচ থেকে বাছুন বা নতুন লিখুন", "Pick below or type a new one")} />
                {brandChoices.length > 0 && (
                  <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto">
                    {brandChoices.map((b) => (
                      <button
                        key={b}
                        type="button"
                        onClick={() => setP({ ...p, brand: b })}
                        className={cn("h-8 rounded-full border-2 px-3 text-sm font-semibold", brandExact === b ? "border-primary bg-primary text-white" : "bg-white hover:bg-muted")}
                      >
                        {b}
                      </button>
                    ))}
                  </div>
                )}
                {brandText && !brandExact && <p className="text-xs text-muted-foreground">{L(`"${brandText}" নতুন ব্র্যান্ড হিসেবে যোগ হবে`, `"${brandText}" will be added as a new brand`)}</p>}
              </Field>
              <Field label={L("কীভাবে বিক্রি হয়? (একক)", "Sold by (unit)")}>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_UNITS.map((u) => (
                    <button
                      key={u}
                      type="button"
                      onClick={() => setP({ ...p, unit: u })}
                      className={cn("h-9 rounded-lg border-2 px-3 text-sm font-semibold", p.unit === u ? "border-primary bg-primary text-white" : "bg-white")}
                    >
                      {B(UNITS[u])}
                    </button>
                  ))}
                  <Select value={QUICK_UNITS.includes(p.unit ?? "") ? "" : p.unit} onValueChange={(u) => setP({ ...p, unit: u })}>
                    <SelectTrigger className="h-9! w-28">
                      <SelectValue placeholder={L("অন্য…", "Other…")} />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(UNITS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>
                          {B(v)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </Field>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Layers className="size-5 text-orange-600" /> {L("দাম ও স্টক", "Price & stock")}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid grid-cols-2 gap-2 rounded-2xl bg-muted p-1.5">
              <button type="button" onClick={() => setMulti(false)} className={cn("h-12 rounded-xl font-semibold", !multi && "bg-white shadow")}>
                {L("একটাই ধরন", "Single")}
              </button>
              <button type="button" onClick={() => setMulti(true)} className={cn("h-12 rounded-xl font-semibold", multi && "bg-white shadow")}>
                {L("অনেক সাইজ / ধরন", "Many sizes / types")}
              </button>
            </div>

            {mergeTarget && (
              <p className="flex items-start gap-2 rounded-2xl border-2 border-sky-300 bg-sky-50 p-3 text-sm font-semibold text-sky-900">
                <GitMerge className="mt-0.5 size-4 shrink-0" />
                {L(
                  `নাম, ব্র্যান্ড ও ক্যাটাগরি মিলে গেছে — সেভ করলে নতুন পণ্য হবে না, আগের "${mergeTarget.product.name}" পণ্যে সাইজ হিসেবে যোগ হবে।`,
                  `Name, brand and category match — saving adds these as sizes to the existing "${mergeTarget.product.name}" instead of a new product.`,
                )}
              </p>
            )}

            <div className="grid gap-3">
              {(multi ? rows : rows.slice(0, 1)).map((r) => (
                <div key={r.key} className="relative grid gap-3 rounded-2xl border bg-white p-3 sm:grid-cols-12">
                  {multi && (
                    <Field label={L("সাইজ / ধরন", "Size / type")} className="sm:col-span-12">
                      <Input
                        autoFocus={addMode && r.isNew}
                        value={r.name}
                        onFocus={() => setFocusKey(r.key)}
                        onBlur={() => setFocusKey((k) => (k === r.key ? null : k))}
                        onChange={(e) => setRow(r.key, { name: e.target.value })}
                        placeholder={`${L("যেমন", "e.g.")} ½"`}
                      />
                      {focusKey === r.key && (
                        <SizeChips
                          sizes={sizesFor(r.name)}
                          isOn={(s) => normalize(r.name) === normalize(s)}
                        isUsed={(s) => rows.some((x) => x.key !== r.key && normalize(x.name) === normalize(s))}
                          onPick={(s) => setRow(r.key, { name: s })}
                        />
                      )}
                    </Field>
                  )}
                  {multi && (
                    // সারির একদম ওপরের ডান কোণে
                    <div className="absolute top-1.5 right-1.5">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-red-600"
                        disabled={rows.length === 1}
                        onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
                        aria-label="remove"
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  )}
                  {r.isNew ? (
                    <Field label={L("এখন স্টকে কত?", "Stock now")} className="sm:col-span-3">
                      <NumInput value={r.opening ?? 0} onValueChange={(n) => setRow(r.key, { opening: n })} suffix={unitLabel} />
                    </Field>
                  ) : (
                    (() => {
                      const v = thisItem?.variants.find((x) => x.id === r.id);
                      return (
                        <Field label={L("এখন স্টকে", "In stock")} className="sm:col-span-3">
                          <Button
                            type="button"
                            variant="outline"
                            className="h-11 justify-between gap-2 px-3"
                            disabled={!v}
                            onClick={() => thisItem && v && setAdjust({ item: thisItem, v })}
                            title={L("স্টক ঠিক করুন", "Adjust stock")}
                          >
                            <span className="tabular text-base font-bold">
                              {num(v?.stock ?? 0)} <span className="text-xs font-normal text-muted-foreground">{unitLabel}</span>
                            </span>
                            <span className="flex items-center gap-1 text-sm text-primary">
                              <ClipboardList className="size-4" /> {L("স্টক ঠিক করুন", "Adjust")}
                            </span>
                          </Button>
                        </Field>
                      );
                    })()
                  )}
                  <Field label={L(`কেনা দাম /${unitLabel}`, `Buy /${unitLabel}`)} className="sm:col-span-3">
                    <NumInput value={r.buy_price} onValueChange={(n) => setRow(r.key, { buy_price: n })} prefix="৳" />
                  </Field>
                  <Field label={L(`বিক্রি দাম /${unitLabel}`, `Sell /${unitLabel}`)} className="sm:col-span-3">
                    <NumInput value={r.sell_price} onValueChange={(n) => setRow(r.key, { sell_price: n })} prefix="৳" />
                  </Field>
                  <Field label={L("পাইকারি দাম", "Wholesale")} className="sm:col-span-3">
                    <NumInput value={r.wholesale_price ?? 0} onValueChange={(n) => setRow(r.key, { wholesale_price: n })} prefix="৳" placeholder={L("ফাঁকা = বিক্রি দাম", "Empty = sell price")} />
                  </Field>
                </div>
              ))}
              {multi && (
                <Button variant="outline" size="lg" className="border-2 border-dashed" onClick={() => setRows((rs) => [...rs, blankRow()])}>
                  <Plus /> {L("আরেকটা সাইজ / ধরন", "Another variant")}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Field label={L("নোট", "Note")}>
              <Textarea value={p.note ?? ""} onChange={(e) => setP({ ...p, note: e.target.value })} rows={2} />
            </Field>
          </CardContent>
        </Card>

        <StockDialog target={adjust} onClose={() => setAdjust(null)} />

        <Dialog open={!!newCat} onOpenChange={(v) => !v && setNewCat(null)}>
          <DialogContent className="max-h-[92dvh] overflow-y-auto">
            {newCat && (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-3 text-xl">
                    <IconTile name={newCat.icon} color={newCat.color} size="sm" />
                    {L("নতুন ক্যাটাগরি", "New category")}
                  </DialogTitle>
                </DialogHeader>
                <div className="grid gap-4">
                  <Field label={L("নাম (বাংলা)", "Name (Bangla)")}>
                    <Input autoFocus value={newCat.name ?? ""} onChange={(e) => setNewCat({ ...newCat, name: e.target.value })} placeholder={L("যেমন: সিএনসি বিট", "e.g. CNC Bit")} />
                  </Field>
                  <Field label={L("নাম (ইংরেজি, ইচ্ছা হলে)", "Name (English, optional)")}>
                    <Input value={newCat.name_en ?? ""} onChange={(e) => setNewCat({ ...newCat, name_en: e.target.value })} />
                  </Field>
                  <Field label={L("আইকন", "Icon")}>
                    <div className="grid grid-cols-8 gap-1.5">
                      {CATEGORY_ICONS.map((ic) => (
                        <button
                          key={ic}
                          type="button"
                          onClick={() => setNewCat({ ...newCat, icon: ic })}
                          className={cn("grid aspect-square place-items-center rounded-lg border-2", newCat.icon === ic ? "border-primary bg-primary/10" : "bg-white")}
                        >
                          <NamedIcon name={ic} className="size-5" style={{ color: newCat.color }} />
                        </button>
                      ))}
                    </div>
                  </Field>
                  <Field label={L("রং", "Color")}>
                    <div className="flex flex-wrap gap-2">
                      {CATEGORY_COLORS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setNewCat({ ...newCat, color: c })}
                          className={cn("size-9 rounded-full ring-offset-2", newCat.color === c && "ring-2 ring-foreground")}
                          style={{ backgroundColor: c }}
                          aria-label={c}
                        />
                      ))}
                    </div>
                  </Field>
                </div>
                <DialogFooter>
                  <Button
                    size="lg"
                    className="w-full"
                    onClick={async () => {
                      const name = newCat.name?.trim();
                      if (!name) return toast.error(L("নাম লিখুন", "Enter a name"));
                      if (categories.some((c) => sameText(c.name, name) || (!!c.name_en && sameText(c.name_en, name))))
                        return toast.error(L("এই নামে ক্যাটাগরি আগেই আছে", "This category already exists"));
                      const saved = await saveCategory({ ...newCat, name, name_en: newCat.name_en?.trim() || undefined } as Category);
                      // নতুন ক্যাটাগরিটাই এই পণ্যের জন্য বাছা হয়ে যায়
                      setP((cur) => ({ ...cur, category_id: saved.id }));
                      setNewCat(null);
                      toast.success(L("ক্যাটাগরি যোগ হয়েছে", "Category added"));
                    }}
                  >
                    <Save /> {L("সেভ করুন", "Save")}
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>

        <Button size="lg" className="h-14 text-lg" disabled={busy} onClick={() => void submit()}>
          <Save /> {L("পণ্য সেভ করুন", "Save product")}
        </Button>
      </div>
    </div>
  );
}
