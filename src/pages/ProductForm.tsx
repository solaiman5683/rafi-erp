import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { toast } from "sonner";
import { Boxes, Layers, Pencil, Plus, Save, Sparkles, Trash2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmAction, Field, PageHeader } from "@/components/common";
import { Highlight } from "@/components/Highlight";
import { IconTile, NamedIcon } from "@/components/Icon";
import { NumInput } from "@/components/NumInput";
import { COMMON_SIZES, UNITS } from "@/lib/constants";
import { db } from "@/lib/db";
import { useCatalog, useCategories } from "@/lib/hooks";
import { matchesText, normalize, sameText, searchCatalog } from "@/lib/search";
import { useI18n } from "@/lib/i18n";
import { deleteProduct, newId, saveProduct, type VariantDraft } from "@/lib/ops";
import type { Product } from "@/lib/types";
import { cn } from "@/lib/utils";

type Row = VariantDraft & { key: string; isNew: boolean };

const blankRow = (name = ""): Row => ({ key: newId(), name, buy_price: 0, sell_price: 0, wholesale_price: 0, low_stock: 0, opening: 0, sku: "", isNew: true });

const QUICK_UNITS = ["pcs", "kg", "feet", "meter", "gauge", "box", "coil", "set", "liter"];

/** সাধারণ ইঞ্চি সাইজ — সবসময় দেখা যায়, চাপ দিলে সাইজের ঘরে চলে যায়; অন্য সারিতে নেওয়া সাইজ বন্ধ থাকে */
function SizeChips({ onPick, isOn, isUsed }: { onPick: (s: string) => void; isOn: (s: string) => boolean; isUsed?: (s: string) => boolean }) {
  return (
    <div className="mt-1 flex flex-wrap gap-1.5">
      {COMMON_SIZES.map((s) => (
        <button
          key={s}
          type="button"
          disabled={isUsed?.(s)}
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
  const { L, B, num } = useI18n();
  const categories = useCategories();
  const catalog = useCatalog();
  const [p, setP] = useState<Partial<Product>>({ name: "", unit: "pcs", brand: "", note: "" });
  const [rows, setRows] = useState<Row[]>([blankRow()]);
  const [multi, setMulti] = useState(false);
  const [bulk, setBulk] = useState("");
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
  const exactDuplicate = sameName.find((i) => sameText(i.product.brand ?? "", brandText));

  const setRow = (key: string, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  function applyBulk() {
    const names = bulk
      .split(/[,،\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!names.length) return;
    const tpl = rows[rows.length - 1];
    setRows((rs) => [
      ...rs.filter((r) => r.name || !r.isNew),
      ...names.map((n) => ({ ...blankRow(n), buy_price: tpl?.buy_price ?? 0, sell_price: tpl?.sell_price ?? 0, wholesale_price: tpl?.wholesale_price ?? 0 })),
    ]);
    setBulk("");
  }

  async function submit() {
    if (!p.name?.trim()) return toast.error(L("পণ্যের নাম লিখুন", "Enter product name"));
    if (exactDuplicate) return toast.error(L("একই নাম ও ব্র্যান্ডের পণ্য আগেই আছে — ওটায় সাইজ যোগ করুন", "This product already exists — add a size to it"));
    const list = multi ? rows.filter((r) => r.name.trim() || !r.isNew) : rows.slice(0, 1).map((r) => ({ ...r, name: "" }));
    if (!list.length) return toast.error(L("অন্তত একটা সাইজ/ধরন দিন", "Add at least one variant"));
    if (multi && list.some((r) => !r.name.trim())) return toast.error(L("প্রতিটা সাইজের নাম দিন", "Name every variant"));
    if (list.some((r) => r.sell_price <= 0)) return toast.error(L("বিক্রি দাম দিন", "Enter sell price"));
    setBusy(true);
    try {
      await saveProduct(
        { ...p, name: p.name.trim(), brand: brandExact ?? brandText, unit: p.unit ?? "pcs" } as Product,
        list.map(({ key: _k, isNew, ...r }) => ({ ...r, id: isNew ? undefined : r.id, name: r.name.trim(), opening: isNew ? r.opening : undefined })),
      );
      toast.success(L("পণ্য সেভ হয়েছে", "Product saved"));
      nav("/products");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!loaded) return null;
  const unitLabel = B(UNITS[p.unit ?? "pcs"]);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        back="/products"
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
                nav("/products");
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

      <div className="grid gap-5">
        <Card>
          <CardContent className="grid gap-4">
            <Field label={L("পণ্যের নাম *", "Product name *")}>
              <Input autoFocus={!id} value={p.name ?? ""} onChange={(e) => setP({ ...p, name: e.target.value })} placeholder={L("যেমন: জিআই পাইপ, পিভিসি এলবো, তালা", "e.g. GI Pipe, PVC Elbow")} />
              {nameHits.length > 0 && (
                <div className="grid gap-2 rounded-2xl border-2 border-amber-300 bg-amber-50/70 p-2.5">
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-amber-900">
                    <TriangleAlert className="size-4 shrink-0" />
                    {sameName.length
                      ? L("এই নামে পণ্য আগেই আছে! নতুন না বানিয়ে ওটাতেই সাইজ যোগ করুন", "A product with this name exists! Add a size to it instead")
                      : L("এই রকম নামের পণ্য আগে থেকে আছে — একই হলে ওটাতেই সাইজ যোগ করুন", "Similar products exist — if it's the same, add a size to it")}
                  </p>
                  {nameHits.map((i) => (
                    <div key={i.product.id} className="flex items-center gap-2.5 rounded-xl bg-white p-2">
                      <IconTile name={i.category?.icon} color={i.category?.color} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">
                          <Highlight text={i.product.name} q={nameText} />
                        </p>
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

            {multi && (
              <div className="rounded-2xl border-2 border-dashed border-orange-300 bg-orange-50/60 p-3">
                <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-orange-900">
                  <Sparkles className="size-4" />
                  {L("একসাথে অনেক সাইজ লিখুন, কমা দিয়ে আলাদা করে", "Type many sizes at once, separated by commas")}
                </p>
                <div className="flex gap-2">
                  <Input value={bulk} onChange={(e) => setBulk(e.target.value)} placeholder='½", ¾", 1", 1¼", 1½"' onKeyDown={(e) => e.key === "Enter" && applyBulk()} />
                  <Button onClick={applyBulk} variant="secondary">
                    <Plus /> {L("যোগ", "Add")}
                  </Button>
                </div>
                <SizeChips
                  isOn={(s) => bulk.split(",").map(normalize).includes(normalize(s))}
                  onPick={(s) => setBulk((b) => (b.trim() ? `${b.trim().replace(/,$/, "")}, ${s}` : s))}
                />
              </div>
            )}

            <div className="grid gap-3">
              {(multi ? rows : rows.slice(0, 1)).map((r) => (
                <div key={r.key} className="grid gap-3 rounded-2xl border bg-white p-3 sm:grid-cols-12">
                  {multi && (
                    <Field label={L("সাইজ / ধরন", "Size / type")} className="sm:col-span-11">
                      <Input
                        autoFocus={addMode && r.isNew}
                        value={r.name}
                        onChange={(e) => setRow(r.key, { name: e.target.value })}
                        placeholder={`${L("যেমন", "e.g.")} ½"`}
                      />
                      <SizeChips
                        isOn={(s) => normalize(r.name) === normalize(s)}
                        isUsed={(s) => rows.some((x) => x.key !== r.key && normalize(x.name) === normalize(s))}
                        onPick={(s) => setRow(r.key, { name: s })}
                      />
                    </Field>
                  )}
                  {multi && (
                    <div className="flex items-start justify-end sm:col-span-1 sm:pt-6">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-red-600"
                        disabled={rows.length === 1}
                        onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
                        aria-label="remove"
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  )}
                  <Field label={L(`কেনা দাম /${unitLabel}`, `Buy /${unitLabel}`)} className="sm:col-span-3">
                    <NumInput value={r.buy_price} onValueChange={(n) => setRow(r.key, { buy_price: n })} prefix="৳" />
                  </Field>
                  <Field label={L(`বিক্রি দাম /${unitLabel}`, `Sell /${unitLabel}`)} className="sm:col-span-3">
                    <NumInput value={r.sell_price} onValueChange={(n) => setRow(r.key, { sell_price: n })} prefix="৳" />
                  </Field>
                  <Field label={L("পাইকারি দাম", "Wholesale")} className="sm:col-span-3">
                    <NumInput value={r.wholesale_price ?? 0} onValueChange={(n) => setRow(r.key, { wholesale_price: n })} prefix="৳" />
                  </Field>
                  {r.isNew ? (
                    <Field label={L("এখন স্টকে কত?", "Stock now")} className="sm:col-span-3">
                      <NumInput value={r.opening ?? 0} onValueChange={(n) => setRow(r.key, { opening: n })} suffix={unitLabel} />
                    </Field>
                  ) : (
                    <div className={"text-xs text-muted-foreground sm:col-span-3 sm:self-end sm:pb-3"}>
                      {L("স্টক বদলাতে পণ্য তালিকায় 'স্টক ঠিক করুন' চাপুন", "Use 'Adjust stock' on the products list")}
                    </div>
                  )}
                  <Field label={L("কম স্টক সতর্কতা", "Low stock alert")} className={multi ? "sm:col-span-3" : "sm:col-span-6"}>
                    <NumInput value={r.low_stock ?? 0} onValueChange={(n) => setRow(r.key, { low_stock: n })} suffix={unitLabel} />
                  </Field>
                  <Field label={L("কোড / বারকোড (ইচ্ছা হলে)", "Code / barcode (optional)")} className={multi ? "sm:col-span-9" : "sm:col-span-6"}>
                    <Input value={r.sku ?? ""} onChange={(e) => setRow(r.key, { sku: e.target.value })} />
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

        <Button size="lg" className="h-14 text-lg" disabled={busy} onClick={() => void submit()}>
          <Save /> {L("পণ্য সেভ করুন", "Save product")}
        </Button>
      </div>
    </div>
  );
}
