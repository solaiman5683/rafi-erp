import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, ArrowUpDown, Boxes, ChevronRight, ClipboardCheck, Layers, PackageSearch, Pencil, Plus, Search, Shapes, ShoppingCart, Trash2, TriangleAlert, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmAction, EmptyState, Field, PageHeader, StatCard, StockBadge } from "@/components/common";
import { Highlight } from "@/components/Highlight";
import { IconTile, NamedIcon } from "@/components/Icon";
import { IconPicker } from "@/components/IconPicker";
import { StockDialog, type StockTarget } from "@/components/StockDialog";
import { useAuth } from "@/lib/auth";
import { CATEGORY_COLORS, UNITS } from "@/lib/constants";
import { useCatalog, useCategories, type CatalogItem } from "@/lib/hooks";
import { searchCatalog } from "@/lib/search";
import { useI18n } from "@/lib/i18n";
import { Pager, usePaged } from "@/components/Pager";
import { deleteCategory, saveCategory } from "@/lib/ops";
import type { Category } from "@/lib/types";
import { cn } from "@/lib/utils";

type SortKey = "name" | "category" | "variants" | "price" | "stock";

const SORT_VALUE: Record<SortKey, (i: CatalogItem) => string | number> = {
  name: (i) => i.product.name.toLowerCase(),
  category: (i) => i.category?.name ?? "",
  variants: (i) => i.variants.length,
  price: (i) => i.minPrice,
  stock: (i) => i.totalStock,
};

export default function Products() {
  const { L, B, money, num } = useI18n();
  const { isOwner } = useAuth();
  const nav = useNavigate();
  const catalog = useCatalog();
  const categories = useCategories();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string | null>(null);
  const [lowOnly, setLowOnly] = useState(false);
  const [adjust, setAdjust] = useState<StockTarget | null>(null);
  const [catOpen, setCatOpen] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 } | null>(null);
  const [pageSize, setPageSize] = useState(20);
  const [variantsOf, setVariantsOf] = useState<string | null>(null);

  const { list, fuzzy, matched } = useMemo(() => {
    const base = (catalog ?? []).filter((i) => (!cat || i.product.category_id === cat) && (!lowOnly || i.lowStock));
    const matched = new Map<string, string[]>();
    if (!q.trim()) return { list: base, fuzzy: false, matched };
    const hits = searchCatalog(base, q, 500);
    for (const h of hits) matched.set(h.item.product.id, h.variants.map((v) => v.id));
    return { list: hits.map((h) => h.item), fuzzy: hits.length > 0 && hits[0].fuzzy, matched };
  }, [catalog, cat, q, lowOnly]);

  // কলামে চাপ দিলে সাজানো; না চাপলে নাম / খোঁজার মিল অনুযায়ী
  const sorted = useMemo(() => {
    if (!sort) return list;
    const val = SORT_VALUE[sort.key];
    return [...list].sort((a, b) => {
      const x = val(a);
      const y = val(b);
      return (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y))) * sort.dir;
    });
  }, [list, sort]);

  const paged = usePaged(sorted, [q, cat, lowOnly, sort, pageSize], pageSize);
  const openItem = (catalog ?? []).find((i) => i.product.id === variantsOf) ?? null;

  const head = (key: SortKey, label: string, className?: string) => {
    const on = sort?.key === key;
    const Icon = !on ? ArrowUpDown : sort.dir === 1 ? ArrowUp : ArrowDown;
    return (
      <TableHead className={className} aria-sort={on ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
        <button
          type="button"
          onClick={() => setSort(!on ? { key, dir: 1 } : sort.dir === 1 ? { key, dir: -1 } : null)}
          className={cn("inline-flex items-center gap-1 font-semibold whitespace-nowrap hover:text-primary", on && "text-primary")}
        >
          {label} <Icon className={cn("size-3.5", !on && "opacity-40")} />
        </button>
      </TableHead>
    );
  };
  const priceText = (i: CatalogItem) => (i.minPrice === i.maxPrice ? money(i.minPrice) : `${money(i.minPrice)} – ${money(i.maxPrice)}`);
  const stats = useMemo(() => {
    let value = 0;
    let saleValue = 0;
    let low = 0;
    for (const i of catalog ?? []) {
      if (i.lowStock) low++;
      for (const v of i.variants) {
        if (v.stock > 0) {
          value += v.stock * v.buy_price;
          saleValue += v.stock * v.sell_price;
        }
      }
    }
    return { count: catalog?.length ?? 0, value, saleValue, low };
  }, [catalog]);

  return (
    <div>
      <PageHeader
        icon={Boxes}
        color="#ea580c"
        title={L("পণ্য ও স্টক", "Products & stock")}
        subtitle={L("সব মালের তালিকা, দাম ও কত আছে", "All items, prices and stock")}
        actions={
          isOwner && (
            <>
              <Button variant="outline" onClick={() => setCatOpen(true)}>
                <Shapes /> {L("ক্যাটাগরি", "Categories")}
              </Button>
              <Button onClick={() => nav("/products/new")} className="bg-orange-600 hover:bg-orange-700">
                <Plus /> {L("নতুন পণ্য", "New product")}
              </Button>
            </>
          )
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={Boxes} color="#ea580c" label={L("মোট পণ্য", "Products")} value={num(stats.count)} />
        <StatCard
          icon={TriangleAlert}
          color="#dc2626"
          label={L("স্টক কম", "Low stock")}
          value={num(stats.low)}
          onClick={() => setLowOnly((v) => !v)}
          hint={L("চাপ দিলে শুধু এগুলো দেখাবে", "Tap to filter")}
        />
        {/* মোবাইলে টাকার অঙ্ক কাটা না যেতে পুরো চওড়া */}
        {isOwner && (
          <div className="col-span-2 grid lg:col-span-1">
            <StatCard icon={PackageSearch} color="#2563eb" label={L("স্টকের দাম (কেনা)", "Stock value (cost)")} value={money(stats.value)} />
          </div>
        )}
        {isOwner && (
          <div className="col-span-2 grid lg:col-span-1">
            <StatCard icon={PackageSearch} color="#16a34a" label={L("স্টকের দাম (বিক্রি)", "Stock value (sale)")} value={money(stats.saleValue)} />
          </div>
        )}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-60 flex-1">
          <Search className="absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-10" placeholder={L("পণ্য খুঁজুন…", "Search products…")} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {lowOnly && (
          <Button variant="secondary" onClick={() => setLowOnly(false)}>
            <X /> {L("শুধু কম স্টক", "Low stock only")}
          </Button>
        )}
      </div>
      <div className="scrollbar-thin -mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-1">
        <button type="button" onClick={() => setCat(null)} className={cn("h-10 shrink-0 rounded-full border-2 px-4 font-semibold", !cat ? "border-primary bg-primary text-white" : "bg-white")}>
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
          icon={Boxes}
          title={L("এখনো কোনো পণ্য নেই", "No products yet")}
          hint={L("'নতুন পণ্য' বাটনে চাপ দিয়ে প্রথম পণ্য যোগ করুন", "Tap 'New product' to add your first item")}
          action={isOwner && <Button onClick={() => nav("/products/new")}><Plus /> {L("নতুন পণ্য", "New product")}</Button>}
        />
      ) : (
        <>
          {fuzzy && (
            <p className="mb-3 flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
              <Search className="size-4 shrink-0" /> {L("হুবহু মিলেনি — আপনি কি এগুলো খুঁজছেন?", "No exact match — did you mean these?")}
            </p>
          )}
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm text-muted-foreground">{L(`মোট ${num(sorted.length)}টি পণ্য`, `${num(sorted.length)} products`)}</span>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              {L("প্রতি পাতায়", "Per page")}
              <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
                <SelectTrigger className="h-9! w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[10, 20, 50, 100].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {num(n)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
          </div>
          <div className="rounded-2xl border bg-white shadow-xs">
            <Table>
              <TableHeader>
                <TableRow>
                  {head("name", L("পণ্য", "Product"), "pl-3")}
                  {head("category", L("ক্যাটাগরি", "Category"), "hidden lg:table-cell")}
                  {head("variants", L("সাইজ", "Sizes"))}
                  {head("price", L("দাম", "Price"), "hidden md:table-cell")}
                  {head("stock", L("স্টক", "Stock"), "text-right")}
                  {isOwner && <TableHead className="hidden pr-3 sm:table-cell" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.rows.map((item) => {
                  const hitIds = matched.get(item.product.id) ?? [];
                  const low = item.totalStock <= 0 || item.lowStock;
                  return (
                    <TableRow key={item.product.id} className={cn(item.totalStock <= 0 && "bg-red-50/50")}>
                      <TableCell className="max-w-0 min-w-44 pl-3 whitespace-normal sm:min-w-56">
                        <div className="flex items-center gap-2.5">
                          <span className="hidden sm:block">
                            <IconTile name={item.category?.icon} color={item.category?.color} size="sm" />
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-bold">
                              <Highlight text={item.product.name} q={q} />
                            </p>
                            {item.product.brand && (
                              <p className="truncate text-sm font-semibold text-foreground/70">
                                <Highlight text={item.product.brand} q={q} />
                              </p>
                            )}
                            <p className="tabular truncate text-xs font-semibold text-emerald-700 md:hidden">{priceText(item)}</p>
                            {hitIds.length > 0 && (
                              <p className="mt-0.5 flex flex-wrap gap-1">
                                {item.variants
                                  .filter((v) => hitIds.includes(v.id))
                                  .slice(0, 4)
                                  .map((v) => (
                                    <span key={v.id} className="rounded bg-muted px-1.5 text-xs">
                                      <Highlight text={v.name || v.sku || ""} q={q} />
                                    </span>
                                  ))}
                              </p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden text-sm lg:table-cell">
                        {item.category ? <Highlight text={B([item.category.name, item.category.name_en || item.category.name])} q={q} /> : "—"}
                      </TableCell>
                      <TableCell>
                        <button
                          type="button"
                          onClick={() => setVariantsOf(item.product.id)}
                          className="inline-flex h-9 items-center gap-1 rounded-full border-2 border-orange-200 bg-orange-50 px-2.5 text-sm font-bold whitespace-nowrap text-orange-800 transition hover:border-orange-400"
                        >
                          <Layers className="size-4" /> {num(item.variants.length)}
                          <span className="hidden sm:inline">{L("সাইজ", item.variants.length === 1 ? "size" : "sizes")}</span>
                          <ChevronRight className="size-4" />
                        </button>
                      </TableCell>
                      <TableCell className="tabular hidden font-semibold whitespace-nowrap text-emerald-700 md:table-cell">{priceText(item)}</TableCell>
                      <TableCell className="text-right">
                        <StockBadge qty={item.totalStock} low={low && item.totalStock > 0 ? item.totalStock : 0} unit={B(UNITS[item.product.unit])} />
                      </TableCell>
                      {isOwner && (
                        <TableCell className="hidden pr-3 text-right sm:table-cell">
                          <Button variant="outline" size="icon-sm" onClick={() => nav(`/products/${item.product.id}`)} aria-label="edit" title={L("এডিট", "Edit")}>
                            <Pencil />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            {sorted.length === 0 && <p className="py-10 text-center text-muted-foreground">{L("কিছু পাওয়া যায়নি", "Nothing found")}</p>}
          </div>
          <Pager {...paged} size={pageSize} />
        </>
      )}

      <VariantsDialog
        item={openItem}
        q={q}
        matched={variantsOf ? (matched.get(variantsOf) ?? []) : []}
        onClose={() => setVariantsOf(null)}
        onStock={(t) => {
          setVariantsOf(null);
          setAdjust(t);
        }}
      />
      <StockDialog target={adjust} onClose={() => setAdjust(null)} />
      <CategoryManager open={catOpen} onOpenChange={setCatOpen} categories={categories} />
    </div>
  );
}

/** এক পণ্যের সব সাইজ; "বিক্রি" চাপলে কার্টে যোগ হয়ে বিক্রির পাতায় চলে যায় */
function VariantsDialog({ item, q, matched, onClose, onStock }: { item: CatalogItem | null; q: string; matched: string[]; onClose: () => void; onStock: (t: StockTarget) => void }) {
  const { L, B, money } = useI18n();
  const { isOwner } = useAuth();
  const nav = useNavigate();
  const unit = item ? B(UNITS[item.product.unit]) : "";
  const rows = [...(item?.variants ?? [])].sort((a, b) => Number(matched.includes(b.id)) - Number(matched.includes(a.id)));
  return (
    <Dialog open={!!item} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl">{item?.product.name}</DialogTitle>
          {item?.product.brand && <p className="font-semibold text-foreground/70">{item.product.brand}</p>}
        </DialogHeader>
        <div className="grid gap-2">
          {item &&
            rows.map((v) => (
              <div key={v.id} className={cn("flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border-2 bg-white p-3", matched.includes(v.id) && "border-amber-300")}>
                <div className="min-w-28 flex-1">
                  <p className="text-lg font-bold">{v.name ? <Highlight text={v.name} q={q} /> : L("সাধারণ", "Standard")}</p>
                  <StockBadge qty={v.stock} low={v.low_stock} unit={unit} />
                </div>
                <div className="tabular text-right">
                  <p className="text-lg font-bold text-emerald-700">{money(v.sell_price)}</p>
                  {isOwner && (
                    <p className="text-xs text-muted-foreground">
                      {L("কেনা", "Buy")} {money(v.buy_price)}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {isOwner && (
                    <Button variant="outline" size="icon" onClick={() => onStock({ item, v })} aria-label={L("স্টক", "Stock")} title={L("স্টক বদলান ও ইতিহাস", "Change stock & history")}>
                      <ClipboardCheck className="text-orange-600" />
                    </Button>
                  )}
                  <Button className="bg-emerald-600 hover:bg-emerald-700" disabled={v.stock <= 0} onClick={() => nav(`/sell?add=${v.id}`)}>
                    <ShoppingCart /> {L("বিক্রি", "Sell")}
                  </Button>
                </div>
              </div>
            ))}
        </div>
        {isOwner && item && (
          <Button variant="outline" size="lg" className="w-full" onClick={() => nav(`/products/${item.product.id}`)}>
            <Pencil /> {L("পণ্য এডিট / নতুন সাইজ", "Edit product / add size")}
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}

function CategoryManager({ open, onOpenChange, categories }: { open: boolean; onOpenChange: (v: boolean) => void; categories: Category[] }) {
  const { L } = useI18n();
  const [edit, setEdit] = useState<Partial<Category> | null>(null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">{L("ক্যাটাগরি", "Categories")}</DialogTitle>
        </DialogHeader>
        {edit ? (
          <div className="grid gap-4">
            <Field label={L("নাম (বাংলা)", "Name (Bangla)")}>
              <Input autoFocus value={edit.name ?? ""} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
            </Field>
            <Field label={L("নাম (ইংরেজি)", "Name (English)")}>
              <Input value={edit.name_en ?? ""} onChange={(e) => setEdit({ ...edit, name_en: e.target.value })} />
            </Field>
            <Field label={L("আইকন", "Icon")}>
              <IconPicker value={edit.icon} color={edit.color} onChange={(icon) => setEdit({ ...edit, icon })} />
            </Field>
            <Field label={L("রং", "Color")}>
              <div className="flex flex-wrap gap-2">
                {CATEGORY_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setEdit({ ...edit, color: c })}
                    className={cn("size-9 rounded-full ring-offset-2", edit.color === c && "ring-2 ring-foreground")}
                    style={{ backgroundColor: c }}
                    aria-label={c}
                  />
                ))}
              </div>
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="lg" onClick={() => setEdit(null)}>
                {L("বাতিল", "Cancel")}
              </Button>
              <Button
                size="lg"
                onClick={async () => {
                  if (!edit.name?.trim()) return toast.error(L("নাম লিখুন", "Enter a name"));
                  await saveCategory({ ...edit, name: edit.name.trim() } as Category);
                  setEdit(null);
                }}
              >
                {L("সেভ", "Save")}
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid gap-2">
            {categories.map((c) => (
              <div key={c.id} className="flex items-center gap-3 rounded-xl border bg-white p-2">
                <IconTile name={c.icon} color={c.color} size="sm" />
                <span className="flex-1 font-semibold">
                  {c.name}
                  {c.name_en && <span className="ml-1 text-sm font-normal text-muted-foreground">({c.name_en})</span>}
                </span>
                <Button variant="ghost" size="icon-sm" onClick={() => setEdit(c)} aria-label="edit">
                  <Pencil />
                </Button>
                <ConfirmAction
                  destructive
                  title={L("ক্যাটাগরি মুছবেন?", "Delete category?")}
                  description={L("এই ক্যাটাগরির পণ্যগুলো থেকে যাবে।", "Products in it will stay.")}
                  onConfirm={() => deleteCategory(c.id)}
                  trigger={
                    <Button variant="ghost" size="icon-sm" className="text-red-600" aria-label="delete">
                      <Trash2 />
                    </Button>
                  }
                />
              </div>
            ))}
            <Button size="lg" variant="secondary" className="border-2 border-dashed" onClick={() => setEdit({ icon: "Package", color: CATEGORY_COLORS[0] })}>
              <Plus /> {L("নতুন ক্যাটাগরি", "New category")}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
