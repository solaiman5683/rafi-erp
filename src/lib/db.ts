import Dexie, { type EntityTable } from "dexie";
import type {
  BalanceRow,
  CashMove,
  CashRow,
  Category,
  Customer,
  Expense,
  LedgerEntry,
  LocalUser,
  Meta,
  Outbox,
  Payment,
  Product,
  Purchase,
  Sale,
  SaleReturn,
  Settings,
  StockMove,
  StockRow,
  Supplier,
  Variant,
} from "./types";

/**
 * ডিভাইসের ভেতরের ডাটাবেস (IndexedDB)। ইন্টারনেট/বিদ্যুৎ না থাকলেও সব এন্ট্রি এখানে জমা থাকে,
 * পরে outbox থেকে সার্ভারে পাঠানো হয়।
 */
export class ErpDB extends Dexie {
  settings!: EntityTable<Settings, "id">;
  categories!: EntityTable<Category, "id">;
  products!: EntityTable<Product, "id">;
  variants!: EntityTable<Variant, "id">;
  customers!: EntityTable<Customer, "id">;
  suppliers!: EntityTable<Supplier, "id">;
  sales!: EntityTable<Sale, "id">;
  sale_returns!: EntityTable<SaleReturn, "id">;
  purchases!: EntityTable<Purchase, "id">;
  payments!: EntityTable<Payment, "id">;
  expenses!: EntityTable<Expense, "id">;
  stock_moves!: EntityTable<StockMove, "id">;
  ledger!: EntityTable<LedgerEntry, "id">;
  cash_moves!: EntityTable<CashMove, "id">;
  // শুধু এই ডিভাইসের জন্য (সিঙ্ক হয় না)
  stock!: EntityTable<StockRow, "variant_id">;
  balances!: EntityTable<BalanceRow, "party_id">;
  cash!: EntityTable<CashRow, "method">;
  outbox!: EntityTable<Outbox, "seq">;
  meta!: EntityTable<Meta, "key">;
  local_users!: EntityTable<LocalUser, "id">;

  constructor() {
    super("rafi-erp");
    this.version(1).stores({
      settings: "id",
      categories: "id",
      products: "id, category_id",
      variants: "id, product_id, sku",
      customers: "id, phone",
      suppliers: "id",
      sales: "id, date, customer_id, invoice_no, created_at",
      sale_returns: "id, date, sale_id, customer_id",
      purchases: "id, date, supplier_id, created_at",
      payments: "id, date, party_id",
      expenses: "id, date",
      stock_moves: "id, variant_id, date",
      ledger: "id, party_id, date",
      cash_moves: "id, date",
      stock: "variant_id",
      balances: "party_id",
      cash: "method",
      outbox: "++seq, [tbl+id]",
      meta: "key",
      local_users: "id",
    });
  }
}

export const db = new ErpDB();

export const SYNC_TABLE_NAMES = [
  "settings",
  "categories",
  "products",
  "variants",
  "customers",
  "suppliers",
  "sales",
  "sale_returns",
  "purchases",
  "payments",
  "expenses",
  "stock_moves",
  "ledger",
  "cash_moves",
] as const;

export const ALL_WRITE_TABLES = [
  ...SYNC_TABLE_NAMES,
  "stock",
  "balances",
  "cash",
  "outbox",
  "meta",
] as const;

export async function getMeta<T>(key: string): Promise<T | undefined> {
  const row = await db.meta.get(key);
  return row?.value as T | undefined;
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  await db.meta.put({ key, value });
}

/** ব্রাউজারকে বলা যেন এই ডাটা কখনো নিজে থেকে মুছে না ফেলে */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (navigator.storage?.persisted && (await navigator.storage.persisted())) return true;
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}
