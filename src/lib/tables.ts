import { EXPENSE_CATEGORIES, UNITS, WALK_IN, type BiText } from "./constants";
import { db } from "./db";
import { cashLabel } from "./labels";
import { cashBook, summaryFor } from "./reports";

/**
 * রিপোর্ট ও বিক্রির তালিকা একটাই আকারে বানানো হয় — একই ডাটা দিয়ে CSV (Excel) ডাউনলোড ও প্রিন্ট পাতা।
 */
export type CellKind = "text" | "money" | "num";

export interface TableData {
  title: string;
  columns: { label: string; kind?: CellKind }[];
  rows: (string | number)[][];
  /** শেষের মোট সারি */
  footer?: (string | number)[];
  /** উপরে ছোট সারাংশ, যেমন "মোট মেমো: 12" */
  notes?: string[];
}

export interface Fmt {
  L: (bn: string, en: string) => string;
  B: (t: BiText | undefined) => string;
  money: (n: number) => string;
  num: (n: number, maxFrac?: number) => string;
  date: (iso: string) => string;
  time: (ts: number) => string;
}

export type ReportTab = "summary" | "products" | "stock" | "dues" | "cash";

export async function buildSales(from: string, to: string, q: string, f: Fmt): Promise<TableData> {
  const { L, B } = f;
  const all = (await db.sales.where("date").between(from, to, true, true).toArray()).filter((s) => !s.deleted);
  const term = q.trim().toLowerCase();
  const sales = all
    .filter((s) => !term || `${s.invoice_no} ${s.customer_name} ${s.customer_phone ?? ""}`.toLowerCase().includes(term))
    .sort((a, b) => b.created_at - a.created_at);
  const returns = (await db.sale_returns.where("sale_id").anyOf(sales.map((s) => s.id)).toArray()).filter((r) => !r.deleted);
  const returned = new Map<string, number>();
  for (const r of returns) returned.set(r.sale_id, (returned.get(r.sale_id) ?? 0) + r.total);
  const sum = (k: "total" | "paid" | "due") => sales.reduce((s, x) => s + x[k], 0);
  return {
    title: L("বিক্রির তালিকা", "Sales list"),
    columns: [
      { label: L("মেমো নং", "Memo no") },
      { label: L("তারিখ", "Date") },
      { label: L("সময়", "Time") },
      { label: L("কাস্টমার", "Customer") },
      { label: L("আইটেম", "Items"), kind: "num" },
      { label: L("মোট", "Total"), kind: "money" },
      { label: L("পেয়েছি", "Paid"), kind: "money" },
      { label: L("বাকি", "Due"), kind: "money" },
      { label: L("ফেরত", "Returned"), kind: "money" },
    ],
    rows: sales.map((s) => [s.invoice_no, f.date(s.date), f.time(s.created_at), s.customer_name || B(WALK_IN), s.items.length, s.total, s.paid, s.due, returned.get(s.id) ?? 0]),
    footer: [L("মোট", "Total"), "", "", "", sales.reduce((s, x) => s + x.items.length, 0), sum("total"), sum("paid"), sum("due"), [...returned.values()].reduce((a, b) => a + b, 0)],
    notes: [L(`মোট মেমো: ${f.num(sales.length)}`, `Memos: ${f.num(sales.length)}`)],
  };
}

export async function buildReport(tab: ReportTab, from: string, to: string, f: Fmt): Promise<TableData> {
  const { L, B } = f;

  if (tab === "summary") {
    const s = await summaryFor(from, to);
    const row = (bn: string, en: string, v: number) => [L(bn, en), v];
    const expenseRows = Object.entries(s.expenseByCat)
      .sort((a, b) => b[1] - a[1])
      .map(([id, v]) => [`   ${L("খরচ", "Expense")}: ${B(EXPENSE_CATEGORIES.find((c) => c.id === id)?.label) || id}`, v]);
    return {
      title: L("লাভ-ক্ষতির হিসাব", "Profit & loss"),
      columns: [{ label: L("বিবরণ", "Item") }, { label: L("টাকা", "Amount"), kind: "money" }],
      rows: [
        row("মোট বিক্রি", "Sales", s.sales),
        row("− ফেরত মাল", "− Returns", s.returns),
        row("আসল বিক্রি", "Net sales", s.netSales),
        row("− মালের কেনা দাম", "− Cost of goods", s.cost - s.returnCost),
        row("মালে লাভ", "Gross profit", s.grossProfit),
        row("− দোকানের খরচ", "− Expenses", s.expenses),
        ...expenseRows,
        row("আসল লাভ", "Net profit", s.netProfit),
        ["", ""],
        row("ছাড় দেওয়া হয়েছে", "Discounts given", s.discount),
        row("বিক্রিতে নগদ পেয়েছি", "Received on sales", s.received),
        row("বাকিতে বিক্রি", "Credit sales", s.creditGiven),
        row("পুরনো বাকি আদায়", "Dues collected", s.collections),
        row("মাল কেনা", "Purchases", s.purchases),
        row("সাপ্লায়ারকে দিয়েছি", "Paid to suppliers", s.purchasePaid + s.supplierPayments),
        row("মোট টাকা এসেছে", "Total in", s.cashIn),
        row("মোট টাকা গেছে", "Total out", s.cashOut),
      ],
      notes: [L(`মোট মেমো: ${f.num(s.salesCount)}`, `Memos: ${f.num(s.salesCount)}`)],
    };
  }

  if (tab === "products") {
    const s = await summaryFor(from, to);
    return {
      title: L("সবচেয়ে বেশি বিক্রি হওয়া মাল", "Best selling items"),
      columns: [
        { label: "#", kind: "num" },
        { label: L("মাল", "Item") },
        { label: L("সাইজ", "Size") },
        { label: L("পরিমাণ", "Qty"), kind: "num" },
        { label: L("একক", "Unit") },
        { label: L("বিক্রি", "Revenue"), kind: "money" },
        { label: L("লাভ", "Profit"), kind: "money" },
      ],
      rows: s.top.map((t, i) => [i + 1, t.name, t.variant, t.qty, B(UNITS[t.unit]) || t.unit, Math.round(t.revenue), Math.round(t.profit)]),
      footer: [L("মোট", "Total"), "", "", "", "", Math.round(s.top.reduce((a, t) => a + t.revenue, 0)), Math.round(s.top.reduce((a, t) => a + t.profit, 0))],
    };
  }

  if (tab === "stock") {
    const [products, variants, stock] = await Promise.all([db.products.toArray(), db.variants.toArray(), db.stock.toArray()]);
    const qty = new Map(stock.map((x) => [x.variant_id, x.qty]));
    const prod = new Map(products.filter((p) => !p.deleted).map((p) => [p.id, p]));
    const rows = variants
      .filter((v) => !v.deleted && prod.has(v.product_id))
      .map((v) => ({ p: prod.get(v.product_id)!, v, q: qty.get(v.id) ?? 0 }))
      .sort((a, b) => a.p.name.localeCompare(b.p.name) || (a.v.sort ?? 0) - (b.v.sort ?? 0));
    const value = rows.reduce((s, r) => s + Math.max(r.q, 0) * r.v.buy_price, 0);
    const saleValue = rows.reduce((s, r) => s + Math.max(r.q, 0) * r.v.sell_price, 0);
    return {
      title: L("স্টক রিপোর্ট", "Stock report"),
      columns: [
        { label: L("মাল", "Item") },
        { label: L("ব্র্যান্ড", "Brand") },
        { label: L("সাইজ", "Size") },
        { label: L("স্টক", "Stock"), kind: "num" },
        { label: L("একক", "Unit") },
        { label: L("কেনা দাম", "Cost"), kind: "money" },
        { label: L("বিক্রি দাম", "Price"), kind: "money" },
        { label: L("মোট দাম (কেনা)", "Value (cost)"), kind: "money" },
      ],
      rows: rows.map((r) => [r.p.name, r.p.brand ?? "", r.v.name, r.q, B(UNITS[r.p.unit]) || r.p.unit, r.v.buy_price, r.v.sell_price, Math.max(r.q, 0) * r.v.buy_price]),
      footer: [L("মোট", "Total"), "", "", "", "", "", "", value],
      notes: [L(`বিক্রি দামে মোট: ${f.money(saleValue)}`, `Value at sale price: ${f.money(saleValue)}`)],
    };
  }

  if (tab === "dues") {
    const [customers, suppliers, balances] = await Promise.all([db.customers.toArray(), db.suppliers.toArray(), db.balances.toArray()]);
    const bal = new Map(balances.map((b) => [b.party_id, b.amount]));
    const list = (arr: { id: string; name: string; phone?: string; deleted: 0 | 1 }[], kind: string) =>
      arr
        .filter((p) => !p.deleted && (bal.get(p.id) ?? 0) > 0.009)
        .map((p) => ({ kind, name: p.name, phone: p.phone ?? "", amount: bal.get(p.id)! }))
        .sort((a, b) => b.amount - a.amount);
    const cust = list(customers, L("কাস্টমারের কাছে পাওনা", "Receivable"));
    const sup = list(suppliers, L("সাপ্লায়ারকে দেনা", "Payable"));
    const total = (x: { amount: number }[]) => x.reduce((s, r) => s + r.amount, 0);
    return {
      title: L("বাকি ও দেনা", "Dues"),
      columns: [{ label: L("ধরন", "Type") }, { label: L("নাম", "Name") }, { label: L("মোবাইল", "Phone") }, { label: L("টাকা", "Amount"), kind: "money" }],
      rows: [...cust, ...sup].map((r) => [r.kind, r.name, r.phone, r.amount]),
      notes: [
        L(`মোট পাওনা: ${f.money(total(cust))}`, `Total receivable: ${f.money(total(cust))}`),
        L(`মোট দেনা: ${f.money(total(sup))}`, `Total payable: ${f.money(total(sup))}`),
      ],
    };
  }

  // ক্যাশ বই
  const book = await cashBook(from, to);
  return {
    title: L("ক্যাশ বই (শুধু নগদ)", "Cash book (cash only)"),
    columns: [
      { label: L("তারিখ", "Date") },
      { label: L("সময়", "Time") },
      { label: L("বিবরণ", "Details") },
      { label: L("এলো", "In"), kind: "money" },
      { label: L("গেলো", "Out"), kind: "money" },
      { label: L("ব্যালেন্স", "Balance"), kind: "money" },
    ],
    rows: [
      [L("আগের জের", "Opening balance"), "", "", "", "", book.opening],
      ...book.rows.map((c) => [f.date(c.date), f.time(c.created_at), `${cashLabel(c, L)}${c.note ? ` · ${c.note}` : ""}`, c.amount > 0 ? c.amount : "", c.amount < 0 ? -c.amount : "", c.balance]),
    ],
    footer: [L("এখন ক্যাশে", "Closing balance"), "", "", book.rows.reduce((s, c) => s + Math.max(c.amount, 0), 0), book.rows.reduce((s, c) => s + Math.max(-c.amount, 0), 0), book.rows.at(-1)?.balance ?? book.opening],
  };
}

/** Excel-এ খোলার মতো CSV (বাংলা ঠিক দেখাতে শুরুতে BOM) */
export function downloadCSV(fileName: string, t: TableData) {
  const lines = [t.columns.map((c) => c.label), ...t.rows, ...(t.footer ? [t.footer] : [])];
  const csv = lines.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function rangeText(from: string, to: string, f: Fmt, allFrom: string): string {
  if (from <= allFrom) return f.L(`শুরু থেকে ${f.date(to)} পর্যন্ত`, `All time to ${f.date(to)}`);
  return from === to ? f.date(from) : `${f.date(from)} — ${f.date(to)}`;
}
