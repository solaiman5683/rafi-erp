import type { Table, Transaction } from "dexie";
import { ALL_WRITE_TABLES, db, getMeta, setMeta } from "./db";
import { calcLine, resolveDiscount } from "./discount";
import { round2, todayISO } from "./format";
import type {
  Base,
  CashMove,
  Category,
  Customer,
  DiscMode,
  Expense,
  LedgerEntry,
  PartyType,
  PayMethod,
  Payment,
  Product,
  PublicUser,
  Purchase,
  PurchaseItem,
  ReturnItem,
  Sale,
  SaleItem,
  SaleReturn,
  Settings,
  StockMove,
  Supplier,
  SyncTable,
  StockRow,
  BalanceRow,
  CashRow,
  Meta,
  Variant,
} from "./types";

// ---------------- সাধারণ ----------------

export function newId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** undefined মান বাদ দেয়, যাতে স্প্রেড করলে id ইত্যাদি মুছে না যায় */
export function clean<T extends object>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
}

let currentUser: PublicUser | null = null;
export function setOpsUser(u: PublicUser | null) {
  currentUser = u;
}

const writeListeners = new Set<() => void>();
export function onLocalWrite(cb: () => void): () => void {
  writeListeners.add(cb);
  return () => writeListeners.delete(cb);
}

const JOURNALS = new Set<SyncTable>(["stock_moves", "ledger", "cash_moves"]);

/**
 * ট্রানজেকশনের সাথে বাঁধা টেবিল। Dexie-র "zone" অনেক async ধাপে হারিয়ে যেতে পারে
 * (বিশেষ করে সিঙ্ক একসাথে চললে), তাই ট্রানজেকশনের ভেতরে সবসময় tx.table() ব্যবহার করি।
 */
export type TableOf = <T, K = string>(name: string) => Table<T, K>;

export const txTables = (tx: Transaction): TableOf => (name) => tx.table(name);

/** জার্নাল এন্ট্রি থেকে স্টক / বাকি / ক্যাশের সারসংক্ষেপ আপডেট */
export async function applyJournal(tbl: SyncTable, rec: Record<string, unknown>, t: TableOf) {
  if (tbl === "stock_moves") {
    const m = rec as unknown as StockMove;
    const stock = t<StockRow>("stock");
    const row = await stock.get(m.variant_id);
    await stock.put({ variant_id: m.variant_id, qty: round2((row?.qty ?? 0) + m.qty) });
  } else if (tbl === "ledger") {
    const l = rec as unknown as LedgerEntry;
    const balances = t<BalanceRow>("balances");
    const row = await balances.get(l.party_id);
    await balances.put({ party_id: l.party_id, amount: round2((row?.amount ?? 0) + l.bill - l.paid) });
  } else if (tbl === "cash_moves") {
    const c = rec as unknown as CashMove;
    const cash = t<CashRow, PayMethod>("cash");
    const row = await cash.get(c.method);
    await cash.put({ method: c.method, amount: round2((row?.amount ?? 0) + c.amount) });
  }
}

class Writer {
  now = Date.now();
  date = todayISO();
  t: TableOf;

  constructor(tx: Transaction) {
    this.t = txTables(tx);
  }

  base(): Base {
    return { id: newId(), created_at: this.now, updated_at: this.now, deleted: 0, by: currentUser?.id };
  }

  async put<T extends Base>(tbl: SyncTable, rec: T): Promise<T> {
    rec.updated_at = Math.max(this.now, (rec.updated_at ?? 0) + 1);
    await this.t<T>(tbl).put(rec);
    await this.t<{ tbl: SyncTable; id: string }, number>("outbox").add({ tbl, id: rec.id });
    if (JOURNALS.has(tbl)) await applyJournal(tbl, rec as unknown as Record<string, unknown>, this.t);
    return rec;
  }

  async stockOf(variant_id: string): Promise<number> {
    return (await this.t<StockRow>("stock").get(variant_id))?.qty ?? 0;
  }

  async balanceOf(party_id: string): Promise<number> {
    return (await this.t<BalanceRow>("balances").get(party_id))?.amount ?? 0;
  }

  stock(variant_id: string, qty: number, type: StockMove["type"], ref_id?: string, note?: string) {
    if (!qty) return;
    return this.put<StockMove>("stock_moves", { ...this.base(), date: this.date, variant_id, qty: round2(qty), type, ref_id, note, by_name: currentUser?.name });
  }

  ledger(e: Omit<LedgerEntry, keyof Base | "date"> & { date?: string }) {
    if (!e.bill && !e.paid) return;
    return this.put<LedgerEntry>("ledger", { ...this.base(), date: this.date, ...e, bill: round2(e.bill), paid: round2(e.paid) });
  }

  cash(amount: number, method: PayMethod, type: CashMove["type"], ref_id?: string, note?: string, date?: string) {
    if (!amount) return;
    return this.put<CashMove>("cash_moves", { ...this.base(), date: date ?? this.date, amount: round2(amount), method, type, ref_id, note });
  }

  /** ডিভাইস কোড সহ ক্রমিক নম্বর, যেমন K4M-0012 — অফলাইনেও দুই ডিভাইসে নম্বর মিলবে না */
  async nextNo(kind: "sale" | "purchase" | "return" | "receipt"): Promise<string> {
    const meta = this.t<Meta>("meta");
    const code = await deviceCode(this.t);
    const key = `counter.${kind}`;
    const n = (((await meta.get(key))?.value as number | undefined) ?? 0) + 1;
    await meta.put({ key, value: n });
    const prefix = { sale: "", purchase: "P-", return: "R-", receipt: "MR-" }[kind];
    return `${prefix}${code}-${String(n).padStart(4, "0")}`;
  }
}

async function commit<T>(fn: (w: Writer) => Promise<T>): Promise<T> {
  const tables = ALL_WRITE_TABLES.map((t) => db.table(t));
  const result = await db.transaction("rw", tables, (tx) => fn(new Writer(tx)));
  writeListeners.forEach((cb) => cb());
  return result;
}

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export async function deviceCode(t?: TableOf): Promise<string> {
  const read = async () => (t ? ((await t<Meta>("meta").get("device.code"))?.value as string | undefined) : getMeta<string>("device.code"));
  let code = await read();
  if (!code) {
    const r = crypto.getRandomValues(new Uint8Array(3));
    code = [...r].map((x) => CODE_CHARS[x % CODE_CHARS.length]).join("");
    if (t) await t<Meta>("meta").put({ key: "device.code", value: code });
    else await setMeta("device.code", code);
  }
  return code;
}

// ---------------- সেটিংস ও মাস্টার ডাটা ----------------

export function saveSettings(patch: Partial<Settings>) {
  return commit(async (w) => {
    const cur = (await w.t<Settings>("settings").get("shop")) ?? { ...w.base(), id: "shop", shop_name: "" };
    return w.put<Settings>("settings", { ...cur, ...patch, id: "shop" });
  });
}

export function saveCategory(c: Partial<Category> & { name: string }) {
  return commit(async (w) => {
    const cur = c.id ? await w.t<Category>("categories").get(c.id) : undefined;
    return w.put<Category>("categories", { ...w.base(), icon: "Package", color: "#64748b", ...cur, ...clean(c) } as Category);
  });
}

export function deleteCategory(id: string) {
  return commit(async (w) => {
    const cur = await w.t<Category>("categories").get(id);
    if (cur) await w.put("categories", { ...cur, deleted: 1 });
  });
}

export interface VariantDraft extends Partial<Variant> {
  name: string;
  buy_price: number;
  sell_price: number;
  /** নতুন ভ্যারিয়েন্টের শুরুর স্টক */
  opening?: number;
}

export function saveProduct(p: Partial<Product> & { name: string; unit: string }, variants: VariantDraft[]) {
  return commit(async (w) => {
    const cur = p.id ? await w.t<Product>("products").get(p.id) : undefined;
    const product = await w.put<Product>("products", { ...w.base(), ...cur, ...clean(p) } as Product);
    const existing = await w.t<Variant>("variants").where("product_id").equals(product.id).toArray();
    const keep = new Set<string>();
    for (const [idx, v] of variants.entries()) {
      const { opening, ...rest } = v;
      const old = v.id ? existing.find((e) => e.id === v.id) : undefined;
      const saved = await w.put<Variant>("variants", {
        ...w.base(),
        ...old,
        ...clean(rest),
        sort: idx,
        product_id: product.id,
        deleted: 0,
      } as Variant);
      keep.add(saved.id);
      if (!old && opening) await w.stock(saved.id, opening, "opening", product.id);
    }
    for (const e of existing) if (!keep.has(e.id) && !e.deleted) await w.put("variants", { ...e, deleted: 1 });
    return product;
  });
}

export function deleteProduct(id: string) {
  return commit(async (w) => {
    const p = await w.t<Product>("products").get(id);
    if (!p) return;
    await w.put("products", { ...p, deleted: 1 });
    for (const v of await w.t<Variant>("variants").where("product_id").equals(id).toArray()) await w.put("variants", { ...v, deleted: 1 });
  });
}

/** স্টক গুনে নতুন সংখ্যা বসানো */
export function adjustStock(variant_id: string, newQty: number, note?: string) {
  return commit(async (w) => {
    const cur = await w.stockOf(variant_id);
    await w.stock(variant_id, round2(newQty - cur), "adjust", undefined, note);
  });
}

/** বর্তমান স্টক থেকে যোগ (+) বা বিয়োগ (−) */
export function adjustStockBy(variant_id: string, delta: number, note?: string) {
  return commit(async (w) => {
    await w.stock(variant_id, round2(delta), "adjust", undefined, note);
  });
}

export function saveCustomer(c: Partial<Customer> & { name: string }, openingDue = 0) {
  return commit(async (w) => {
    const cur = c.id ? await w.t<Customer>("customers").get(c.id) : undefined;
    const saved = await w.put<Customer>("customers", {
      ...w.base(),
      type: "retail",
      price_tier: "retail",
      disc_mode: "none",
      disc_value: 0,
      ...cur,
      ...clean(c),
    } as Customer);
    if (!cur && openingDue) await w.ledger({ party_type: "customer", party_id: saved.id, type: "opening", bill: openingDue, paid: 0, note: "আগের বাকি" });
    return saved;
  });
}

export function saveSupplier(s: Partial<Supplier> & { name: string }, openingDue = 0) {
  return commit(async (w) => {
    const cur = s.id ? await w.t<Supplier>("suppliers").get(s.id) : undefined;
    const saved = await w.put<Supplier>("suppliers", { ...w.base(), ...cur, ...clean(s) } as Supplier);
    if (!cur && openingDue) await w.ledger({ party_type: "supplier", party_id: saved.id, type: "opening", bill: openingDue, paid: 0, note: "আগের দেনা" });
    return saved;
  });
}

export function deleteParty(type: PartyType, id: string) {
  return commit(async (w) => {
    const tbl = type === "customer" ? "customers" : "suppliers";
    const cur = await w.t<Customer | Supplier>(tbl).get(id);
    if (cur) await w.put(tbl, { ...cur, deleted: 1 });
  });
}

// ---------------- বিক্রি ----------------

export interface CartLine {
  key: string;
  variant_id: string;
  product_id: string;
  name: string;
  variant_name: string;
  unit: string;
  qty: number;
  list_price: number;
  disc_mode: DiscMode;
  disc_value: number;
}

export interface SaleInput {
  customer: Customer | null;
  lines: CartLine[];
  disc_mode: DiscMode;
  disc_value: number;
  paid: number;
  method: PayMethod;
  note?: string;
}

export function computeCart(lines: CartLine[], disc_mode: DiscMode, disc_value: number) {
  const items = lines.map((l) => ({ line: l, ...calcLine(l.qty, l.list_price, l.disc_mode, l.disc_value) }));
  const subtotal = round2(items.reduce((s, i) => s + i.total, 0));
  const listTotal = round2(lines.reduce((s, l) => s + l.qty * l.list_price, 0));
  const d = resolveDiscount(subtotal, disc_mode, disc_value);
  return { items, subtotal, listTotal, discount: d.amount, discountPercent: d.percent, total: d.final };
}

export function createSale(input: SaleInput): Promise<Sale> {
  return commit(async (w) => {
    const calc = computeCart(input.lines, input.disc_mode, input.disc_value);
    const total = calc.total;
    const paid = round2(Math.min(Math.max(input.paid, 0), Math.max(total, 0)));
    const due = round2(total - paid);
    if (due > 0 && !input.customer) throw new Error("বাকি বিক্রির জন্য কাস্টমার বাছাই করুন");

    const items: SaleItem[] = [];
    let cost = 0;
    for (const i of calc.items) {
      const v = await w.t<Variant>("variants").get(i.line.variant_id);
      const unitCost = v?.buy_price ?? 0;
      cost += unitCost * i.line.qty;
      items.push({
        variant_id: i.line.variant_id,
        product_id: i.line.product_id,
        name: i.line.name,
        variant_name: i.line.variant_name,
        unit: i.line.unit,
        qty: i.line.qty,
        list_price: i.line.list_price,
        disc_mode: i.line.disc_mode,
        disc_value: i.line.disc_value,
        disc_amount: i.disc_amount,
        price: i.price,
        total: i.total,
        cost: unitCost,
      });
    }

    const c = input.customer;
    const prev_due = c ? await w.balanceOf(c.id) : 0;
    const sale = await w.put<Sale>("sales", {
      ...w.base(),
      invoice_no: await w.nextNo("sale"),
      date: w.date,
      customer_id: c?.id ?? null,
      customer_name: c?.name ?? "",
      customer_phone: c?.phone,
      customer_address: c?.address,
      items,
      subtotal: calc.subtotal,
      disc_mode: input.disc_mode,
      disc_value: input.disc_value,
      discount: calc.discount,
      total,
      paid,
      due,
      method: input.method,
      cost: round2(cost),
      prev_due,
      note: input.note,
      by_name: currentUser?.name,
    });

    for (const it of items) await w.stock(it.variant_id, -it.qty, "sale", sale.id);
    if (c) await w.ledger({ party_type: "customer", party_id: c.id, type: "sale", ref_id: sale.id, ref_no: sale.invoice_no, bill: total, paid });
    await w.cash(paid, input.method, "sale", sale.id, sale.invoice_no);
    return sale;
  });
}

export interface ReturnInput {
  sale: Sale;
  items: { variant_id: string; qty: number }[];
  refund: number;
  method: PayMethod;
  note?: string;
}

/** কোন ভ্যারিয়েন্টের কতটা আগে ফেরত হয়েছে */
export async function returnedQty(sale_id: string): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  const rows = await db.sale_returns.where("sale_id").equals(sale_id).toArray();
  for (const r of rows) if (!r.deleted) for (const it of r.items) out[it.variant_id] = (out[it.variant_id] ?? 0) + it.qty;
  return out;
}

export function createReturn(input: ReturnInput): Promise<SaleReturn> {
  return commit(async (w) => {
    const { sale } = input;
    // ইনভয়েসের মোট ছাড় আনুপাতিক ভাগ করে প্রকৃত দাম বের করা
    const factor = sale.subtotal > 0 ? sale.total / sale.subtotal : 1;
    const items: ReturnItem[] = [];
    for (const r of input.items) {
      if (r.qty <= 0) continue;
      const it = sale.items.find((x) => x.variant_id === r.variant_id);
      if (!it) continue;
      const price = round2(it.price * factor);
      items.push({
        variant_id: it.variant_id,
        name: it.name,
        variant_name: it.variant_name,
        unit: it.unit,
        qty: r.qty,
        price,
        total: round2(price * r.qty),
        cost: it.cost,
      });
    }
    if (!items.length) throw new Error("ফেরতের পরিমাণ দিন");
    const total = round2(items.reduce((s, i) => s + i.total, 0));
    const refund = sale.customer_id ? round2(Math.min(Math.max(input.refund, 0), total)) : total;

    const ret = await w.put<SaleReturn>("sale_returns", {
      ...w.base(),
      return_no: await w.nextNo("return"),
      date: w.date,
      sale_id: sale.id,
      invoice_no: sale.invoice_no,
      customer_id: sale.customer_id,
      customer_name: sale.customer_name,
      items,
      total,
      refund,
      method: input.method,
      cost: round2(items.reduce((s, i) => s + i.cost * i.qty, 0)),
      note: input.note,
    });
    for (const it of items) await w.stock(it.variant_id, it.qty, "return", ret.id);
    if (sale.customer_id) {
      await w.ledger({ party_type: "customer", party_id: sale.customer_id, type: "return", ref_id: ret.id, ref_no: ret.return_no, bill: -total, paid: -refund });
    }
    await w.cash(-refund, input.method, "refund", ret.id, ret.return_no);
    return ret;
  });
}

/**
 * মালিক মেমো মুছলে: মেমো ও তার ফেরতগুলো মুছে দেখানো বন্ধ হয়, আর স্টক, কাস্টমারের বাকি ও ক্যাশ
 * উল্টো এন্ট্রি দিয়ে আগের অবস্থায় ফেরে। জার্নালে "void" এন্ট্রি থেকে যায় যাতে কে কখন মুছল বোঝা যায়।
 */
export function deleteSale(id: string) {
  return commit(async (w) => {
    const sale = await w.t<Sale>("sales").get(id);
    if (!sale || sale.deleted) return;
    const returns = (await w.t<SaleReturn>("sale_returns").where("sale_id").equals(id).toArray()).filter((r) => !r.deleted);
    for (const r of returns) {
      await w.put<SaleReturn>("sale_returns", { ...r, deleted: 1 });
      const note = `${r.return_no} মুছে ফেলা`;
      for (const it of r.items) await w.stock(it.variant_id, -it.qty, "void", r.id, note);
      if (r.customer_id) await w.ledger({ party_type: "customer", party_id: r.customer_id, type: "void", ref_id: r.id, ref_no: r.return_no, bill: r.total, paid: r.refund, note });
      await w.cash(r.refund, r.method, "void", r.id, note);
    }
    await w.put<Sale>("sales", { ...sale, deleted: 1 });
    const note = `${sale.invoice_no} মুছে ফেলা`;
    for (const it of sale.items) await w.stock(it.variant_id, it.qty, "void", sale.id, note);
    if (sale.customer_id) {
      await w.ledger({ party_type: "customer", party_id: sale.customer_id, type: "void", ref_id: sale.id, ref_no: sale.invoice_no, bill: -sale.total, paid: -sale.paid, note });
    }
    await w.cash(-sale.paid, sale.method, "void", sale.id, note);
  });
}

// ---------------- ক্রয় ----------------

export interface PurchaseLine {
  key: string;
  variant_id: string;
  product_id: string;
  name: string;
  variant_name: string;
  unit: string;
  qty: number;
  price: number;
  /** দিলে ভ্যারিয়েন্টের বিক্রি দাম আপডেট হবে */
  new_sell_price?: number;
}

export interface PurchaseInput {
  supplier: Supplier;
  lines: PurchaseLine[];
  disc_mode: DiscMode;
  disc_value: number;
  paid: number;
  method: PayMethod;
  bill_no?: string;
  note?: string;
}

export function createPurchase(input: PurchaseInput): Promise<Purchase> {
  return commit(async (w) => {
    const items: PurchaseItem[] = input.lines
      .filter((l) => l.qty > 0)
      .map((l) => ({
        variant_id: l.variant_id,
        product_id: l.product_id,
        name: l.name,
        variant_name: l.variant_name,
        unit: l.unit,
        qty: l.qty,
        price: l.price,
        total: round2(l.qty * l.price),
      }));
    if (!items.length) throw new Error("অন্তত একটি পণ্য দিন");
    const subtotal = round2(items.reduce((s, i) => s + i.total, 0));
    const d = resolveDiscount(subtotal, input.disc_mode, input.disc_value);
    const total = d.final;
    const paid = round2(Math.min(Math.max(input.paid, 0), total));
    const factor = subtotal > 0 ? total / subtotal : 1;

    const purchase = await w.put<Purchase>("purchases", {
      ...w.base(),
      purchase_no: await w.nextNo("purchase"),
      bill_no: input.bill_no,
      date: w.date,
      supplier_id: input.supplier.id,
      supplier_name: input.supplier.name,
      items,
      subtotal,
      disc_mode: input.disc_mode,
      disc_value: input.disc_value,
      discount: d.amount,
      total,
      paid,
      due: round2(total - paid),
      method: input.method,
      status: "ok",
      note: input.note,
    });

    for (const line of input.lines.filter((l) => l.qty > 0)) {
      // গড় কেনা দাম (weighted average) আপডেট
      const v = await w.t<Variant>("variants").get(line.variant_id);
      if (v) {
        const before = Math.max(await w.stockOf(v.id), 0);
        const unitCost = line.price * factor;
        const avg = before > 0 ? (before * v.buy_price + line.qty * unitCost) / (before + line.qty) : unitCost;
        await w.put<Variant>("variants", {
          ...v,
          buy_price: round2(avg),
          sell_price: line.new_sell_price && line.new_sell_price > 0 ? line.new_sell_price : v.sell_price,
        });
      }
      await w.stock(line.variant_id, line.qty, "purchase", purchase.id);
    }
    await w.ledger({ party_type: "supplier", party_id: input.supplier.id, type: "purchase", ref_id: purchase.id, ref_no: purchase.purchase_no, bill: total, paid });
    await w.cash(-paid, input.method, "purchase", purchase.id, purchase.purchase_no);
    return purchase;
  });
}

export function voidPurchase(id: string) {
  return commit(async (w) => {
    const p = await w.t<Purchase>("purchases").get(id);
    if (!p || p.status === "void") return;
    await w.put<Purchase>("purchases", { ...p, status: "void" });
    for (const it of p.items) await w.stock(it.variant_id, -it.qty, "void", p.id);
    await w.ledger({ party_type: "supplier", party_id: p.supplier_id, type: "void", ref_id: p.id, ref_no: p.purchase_no, bill: -p.total, paid: -p.paid, note: "ক্রয় বাতিল" });
    await w.cash(p.paid, p.method, "void", p.id, `${p.purchase_no} বাতিল`);
  });
}

// ---------------- টাকা লেনদেন ----------------

export interface PaymentInput {
  party_type: PartyType;
  party_id: string;
  party_name: string;
  amount: number;
  method: PayMethod;
  note?: string;
}

export function createPayment(input: PaymentInput): Promise<Payment> {
  return commit(async (w) => {
    const amount = round2(input.amount);
    if (amount <= 0) throw new Error("টাকার পরিমাণ দিন");
    const pay = await w.put<Payment>("payments", {
      ...w.base(),
      date: w.date,
      receipt_no: await w.nextNo("receipt"),
      ...input,
      amount,
    });
    await w.ledger({ party_type: input.party_type, party_id: input.party_id, type: "payment", ref_id: pay.id, ref_no: pay.receipt_no, bill: 0, paid: amount, note: input.note });
    const isIn = input.party_type === "customer";
    await w.cash(isIn ? amount : -amount, input.method, isIn ? "collection" : "supplier_payment", pay.id, input.party_name);
    return pay;
  });
}

/** টাকা জমা/দেওয়ার এন্ট্রি মুছলে বাকি ও ক্যাশ উল্টো এন্ট্রি দিয়ে আগের মতো হয় (শুধু মালিক) */
export function deletePayment(id: string) {
  return commit(async (w) => {
    const pay = await w.t<Payment>("payments").get(id);
    if (!pay || pay.deleted) return;
    await w.put<Payment>("payments", { ...pay, deleted: 1 });
    const note = `${pay.receipt_no} মুছে ফেলা`;
    await w.ledger({ party_type: pay.party_type, party_id: pay.party_id, type: "void", ref_id: pay.id, ref_no: pay.receipt_no, bill: 0, paid: -pay.amount, note });
    await w.cash(pay.party_type === "customer" ? -pay.amount : pay.amount, pay.method, "void", pay.id, note);
  });
}

export function addExpense(e: { category: string; amount: number; method: PayMethod; note?: string; date?: string }) {
  return commit(async (w) => {
    const amount = round2(e.amount);
    if (amount <= 0) throw new Error("টাকার পরিমাণ দিন");
    const exp = await w.put<Expense>("expenses", { ...w.base(), date: e.date ?? w.date, category: e.category, amount, method: e.method, note: e.note });
    await w.cash(-amount, e.method, "expense", exp.id, e.note, exp.date);
    return exp;
  });
}

export function deleteExpense(id: string) {
  return commit(async (w) => {
    const e = await w.t<Expense>("expenses").get(id);
    if (!e || e.deleted) return;
    await w.put<Expense>("expenses", { ...e, deleted: 1 });
    await w.cash(e.amount, e.method, "expense", e.id, "খরচ মুছে ফেলা হয়েছে");
  });
}

export function cashAdjust(type: "owner_in" | "owner_out" | "opening", amount: number, method: PayMethod, note?: string) {
  return commit(async (w) => {
    const signed = type === "owner_out" ? -Math.abs(amount) : type === "owner_in" ? Math.abs(amount) : amount;
    await w.cash(signed, method, type, undefined, note);
  });
}

// ---------------- রক্ষণাবেক্ষণ ----------------

/** জার্নাল থেকে স্টক, বাকি ও ক্যাশ নতুন করে হিসাব করা */
export async function rebuildDerived() {
  await db.transaction("rw", [db.stock, db.balances, db.cash, db.stock_moves, db.ledger, db.cash_moves], async (tx) => {
    const t = txTables(tx);
    const stock = new Map<string, number>();
    const bal = new Map<string, number>();
    const cash = new Map<PayMethod, number>();
    for (const m of await t<StockMove>("stock_moves").toArray()) stock.set(m.variant_id, (stock.get(m.variant_id) ?? 0) + m.qty);
    for (const l of await t<LedgerEntry>("ledger").toArray()) bal.set(l.party_id, (bal.get(l.party_id) ?? 0) + l.bill - l.paid);
    for (const c of await t<CashMove>("cash_moves").toArray()) cash.set(c.method, (cash.get(c.method) ?? 0) + c.amount);
    await t<StockRow>("stock").clear();
    await t<BalanceRow>("balances").clear();
    await t<CashRow, PayMethod>("cash").clear();
    await t<StockRow>("stock").bulkPut([...stock].map(([variant_id, qty]) => ({ variant_id, qty: round2(qty) })));
    await t<BalanceRow>("balances").bulkPut([...bal].map(([party_id, amount]) => ({ party_id, amount: round2(amount) })));
    await t<CashRow, PayMethod>("cash").bulkPut([...cash].map(([method, amount]) => ({ method, amount: round2(amount) })));
  });
}

export async function seedDefaultCategories(defs: { name: string; name_en: string; icon: string; color: string }[]) {
  if ((await db.categories.count()) > 0) return;
  await commit(async (w) => {
    let sort = 0;
    for (const d of defs) await w.put<Category>("categories", { ...w.base(), ...d, sort: sort++ });
  });
}
