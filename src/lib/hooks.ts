import { useLiveQuery } from "dexie-react-hooks";
import { DEFAULT_LOW_STOCK, expenseCategories, type ExpenseCategory } from "./constants";
import { db } from "./db";
import type { Category, Customer, Product, Settings, Supplier, Variant } from "./types";

export function useSettings(): Settings | undefined {
  return useLiveQuery(() => db.settings.get("shop"), []);
}

/** সব খরচের খাত (মুছে ফেলাগুলোও, পুরোনো খরচে নাম দেখানোর জন্য) */
export function useExpenseCategories(): ExpenseCategory[] {
  return expenseCategories(useSettings());
}

export function useCategories(): Category[] {
  return (
    useLiveQuery(async () => {
      const all = await db.categories.toArray();
      return all.filter((c) => !c.deleted).sort((a, b) => (a.sort ?? 99) - (b.sort ?? 99) || a.name.localeCompare(b.name));
    }, []) ?? []
  );
}

export interface VariantWithStock extends Variant {
  stock: number;
}

export interface CatalogItem {
  product: Product;
  category?: Category;
  variants: VariantWithStock[];
  totalStock: number;
  minPrice: number;
  maxPrice: number;
  lowStock: boolean;
  /** খোঁজার জন্য সব নাম একসাথে (ছোট হাতের অক্ষরে) */
  haystack: string;
}

export function useCatalog(): CatalogItem[] | undefined {
  return useLiveQuery(async () => {
    const [products, variants, stock, categories, settings] = await Promise.all([
      db.products.toArray(),
      db.variants.toArray(),
      db.stock.toArray(),
      db.categories.toArray(),
      db.settings.get("shop"),
    ]);
    const low = settings?.low_stock ?? DEFAULT_LOW_STOCK;
    const stockMap = new Map(stock.map((s) => [s.variant_id, s.qty]));
    const catMap = new Map(categories.map((c) => [c.id, c]));
    const byProduct = new Map<string, VariantWithStock[]>();
    for (const v of variants) {
      if (v.deleted) continue;
      const list = byProduct.get(v.product_id) ?? [];
      list.push({ ...v, low_stock: low, stock: stockMap.get(v.id) ?? 0 });
      byProduct.set(v.product_id, list);
    }
    const items: CatalogItem[] = [];
    for (const p of products) {
      if (p.deleted) continue;
      const vs = (byProduct.get(p.id) ?? []).sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
      if (!vs.length) continue;
      const prices = vs.map((v) => v.sell_price);
      items.push({
        product: p,
        category: p.category_id ? catMap.get(p.category_id) : undefined,
        variants: vs,
        totalStock: vs.reduce((s, v) => s + v.stock, 0),
        minPrice: Math.min(...prices),
        maxPrice: Math.max(...prices),
        lowStock: vs.some((v) => v.stock <= low),
        haystack: [p.name, p.brand, ...vs.map((v) => `${v.name} ${v.sku ?? ""}`)].join(" ").toLowerCase(),
      });
    }
    return items.sort((a, b) => a.product.name.localeCompare(b.product.name));
  }, []);
}

export interface PartyWithBalance<T> {
  party: T;
  balance: number;
}

export function useCustomers(): PartyWithBalance<Customer>[] | undefined {
  return useLiveQuery(async () => {
    const [list, bal] = await Promise.all([db.customers.toArray(), db.balances.toArray()]);
    const m = new Map(bal.map((b) => [b.party_id, b.amount]));
    return list
      .filter((c) => !c.deleted)
      .map((c) => ({ party: c, balance: m.get(c.id) ?? 0 }))
      .sort((a, b) => a.party.name.localeCompare(b.party.name));
  }, []);
}

export function useSuppliers(): PartyWithBalance<Supplier>[] | undefined {
  return useLiveQuery(async () => {
    const [list, bal] = await Promise.all([db.suppliers.toArray(), db.balances.toArray()]);
    const m = new Map(bal.map((b) => [b.party_id, b.amount]));
    return list
      .filter((s) => !s.deleted)
      .map((s) => ({ party: s, balance: m.get(s.id) ?? 0 }))
      .sort((a, b) => a.party.name.localeCompare(b.party.name));
  }, []);
}

export function usePendingCount(): number {
  return useLiveQuery(() => db.outbox.count(), []) ?? 0;
}

/** ছোট হাতের অক্ষর ও বাংলা/ইংরেজি সংখ্যা মিলিয়ে খোঁজা */
export function matchSearch(haystack: string, q: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[০-৯]/g, (d) => String("০১২৩৪৫৬৭৮৯".indexOf(d)));
  const h = norm(haystack);
  return norm(q)
    .split(/\s+/)
    .filter(Boolean)
    .every((w) => h.includes(w));
}
