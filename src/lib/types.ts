import type { PublicUser, Role, SyncTable } from "../../shared/tables";

export type { PublicUser, Role, SyncTable };

export interface Base {
  id: string;
  created_at: number;
  updated_at: number;
  deleted: 0 | 1;
  /** যে ইউজার তৈরি করেছে */
  by?: string;
}

/** ছাড়ের ধরন: শতাংশ, টাকা, নাকি সরাসরি বিক্রয় মূল্য দেওয়া হয়েছে */
export type DiscMode = "none" | "percent" | "amount" | "price";

export type PayMethod = "cash" | "bkash" | "nagad" | "rocket" | "bank" | "cheque";

export type PartyType = "customer" | "supplier";

export interface Settings extends Base {
  shop_name: string;
  tagline?: string;
  address?: string;
  phone?: string;
  phone2?: string;
  invoice_note?: string;
  paper?: "A4" | "A5";
  /** সব পণ্যের জন্য একটাই কম-স্টক সীমা */
  low_stock?: number;
  /** মালিকের বানানো খরচের খাত */
  expense_categories?: CustomExpenseCategory[];
}

export interface CustomExpenseCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
  /** মুছে ফেলা খাত — পুরোনো খরচে নাম দেখাতে রেখে দেওয়া হয় */
  deleted?: 0 | 1;
}

export interface Category extends Base {
  name: string;
  name_en?: string;
  icon: string;
  color: string;
  sort?: number;
}

export interface Product extends Base {
  name: string;
  category_id?: string;
  brand?: string;
  unit: string;
  note?: string;
}

export interface Variant extends Base {
  product_id: string;
  /** সাইজ/কালার/মডেল ইত্যাদি — একটাই হলে ফাঁকা */
  name: string;
  sku?: string;
  buy_price: number;
  sell_price: number;
  wholesale_price?: number;
  low_stock?: number;
  /** তালিকায় কোন ক্রমে দেখাবে */
  sort?: number;
}

export interface Customer extends Base {
  name: string;
  phone?: string;
  address?: string;
  type: "retail" | "wholesale" | "contractor" | "mistri";
  price_tier: "retail" | "wholesale";
  disc_mode: "none" | "percent" | "amount";
  disc_value: number;
  note?: string;
}

export interface Supplier extends Base {
  name: string;
  company?: string;
  phone?: string;
  address?: string;
  note?: string;
}

export interface SaleItem {
  variant_id: string;
  product_id: string;
  name: string;
  variant_name: string;
  unit: string;
  qty: number;
  /** তালিকা মূল্য (প্রতি একক) */
  list_price: number;
  disc_mode: DiscMode;
  disc_value: number;
  /** এই লাইনে মোট ছাড় (টাকা) */
  disc_amount: number;
  /** ছাড়ের পর প্রতি এককের দাম */
  price: number;
  total: number;
  /** কেনা দাম (প্রতি একক) — লাভ হিসাবের জন্য */
  cost: number;
}

export interface Sale extends Base {
  invoice_no: string;
  date: string;
  customer_id: string | null;
  customer_name: string;
  customer_phone?: string;
  customer_address?: string;
  items: SaleItem[];
  subtotal: number;
  disc_mode: DiscMode;
  disc_value: number;
  discount: number;
  total: number;
  paid: number;
  due: number;
  method: PayMethod;
  cost: number;
  /** এই বিক্রির আগে কাস্টমারের বাকি (মেমোতে দেখানোর জন্য) */
  prev_due: number;
  note?: string;
  by_name?: string;
}

export interface ReturnItem {
  variant_id: string;
  name: string;
  variant_name: string;
  unit: string;
  qty: number;
  price: number;
  total: number;
  cost: number;
}

export interface SaleReturn extends Base {
  return_no: string;
  date: string;
  sale_id: string;
  invoice_no: string;
  customer_id: string | null;
  customer_name: string;
  items: ReturnItem[];
  total: number;
  refund: number;
  method: PayMethod;
  cost: number;
  note?: string;
}

export interface PurchaseItem {
  variant_id: string;
  product_id: string;
  name: string;
  variant_name: string;
  unit: string;
  qty: number;
  price: number;
  total: number;
}

export interface Purchase extends Base {
  purchase_no: string;
  bill_no?: string;
  date: string;
  supplier_id: string;
  supplier_name: string;
  items: PurchaseItem[];
  subtotal: number;
  disc_mode: DiscMode;
  disc_value: number;
  discount: number;
  total: number;
  paid: number;
  due: number;
  method: PayMethod;
  status: "ok" | "void";
  note?: string;
}

export interface Payment extends Base {
  date: string;
  party_type: PartyType;
  party_id: string;
  party_name: string;
  amount: number;
  method: PayMethod;
  note?: string;
  receipt_no: string;
}

export interface Expense extends Base {
  date: string;
  category: string;
  amount: number;
  method: PayMethod;
  note?: string;
}

export interface StockMove extends Base {
  date: string;
  variant_id: string;
  qty: number;
  type: "opening" | "purchase" | "sale" | "return" | "adjust" | "void";
  ref_id?: string;
  note?: string;
  /** যে ইউজার এন্ট্রি করেছে (লগে দেখানোর জন্য) */
  by_name?: string;
}

export interface LedgerEntry extends Base {
  date: string;
  party_type: PartyType;
  party_id: string;
  type: "opening" | "sale" | "payment" | "return" | "purchase" | "void" | "adjust";
  ref_id?: string;
  ref_no?: string;
  /** বিলের পরিমাণ (বাকি বাড়ায়) */
  bill: number;
  /** পরিশোধ (বাকি কমায়) */
  paid: number;
  note?: string;
}

export interface CashMove extends Base {
  date: string;
  /** + মানে ক্যাশে টাকা ঢুকল, − মানে বের হল */
  amount: number;
  method: PayMethod;
  type:
    | "sale"
    | "collection"
    | "purchase"
    | "supplier_payment"
    | "expense"
    | "refund"
    | "void"
    | "owner_in"
    | "owner_out"
    | "opening";
  ref_id?: string;
  note?: string;
}

export interface Outbox {
  seq?: number;
  tbl: SyncTable;
  id: string;
}

export interface Meta {
  key: string;
  value: unknown;
}

export interface StockRow {
  variant_id: string;
  qty: number;
}

export interface BalanceRow {
  party_id: string;
  amount: number;
}

export interface CashRow {
  method: PayMethod;
  amount: number;
}

export interface LocalUser {
  id: string;
  name: string;
  role: Role;
  salt: string;
  hash: string;
  token: string;
}

export interface Session {
  token: string;
  user: PublicUser;
}
