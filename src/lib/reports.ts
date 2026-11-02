import { db } from "./db";
import { addDays, round2 } from "./format";
import type { CashMove, PayMethod } from "./types";

export interface DaySeries {
  date: string;
  sales: number;
  profit: number;
  expense: number;
}

export interface TopProduct {
  key: string;
  name: string;
  variant: string;
  unit: string;
  qty: number;
  revenue: number;
  profit: number;
}

export interface Summary {
  salesCount: number;
  sales: number;
  discount: number;
  cost: number;
  received: number;
  creditGiven: number;
  returns: number;
  returnCost: number;
  refunds: number;
  netSales: number;
  grossProfit: number;
  expenses: number;
  netProfit: number;
  purchases: number;
  purchasePaid: number;
  collections: number;
  supplierPayments: number;
  cashIn: number;
  cashOut: number;
  byMethod: Record<string, { in: number; out: number }>;
  series: DaySeries[];
  /** লম্বা সময় হলে মাসভিত্তিক (date = YYYY-MM) */
  seriesBy: "day" | "month";
  top: TopProduct[];
  expenseByCat: Record<string, number>;
}

export async function summaryFor(from: string, to: string): Promise<Summary> {
  const [sales, returns, expenses, purchases, payments, cash] = await Promise.all([
    db.sales.where("date").between(from, to, true, true).toArray(),
    db.sale_returns.where("date").between(from, to, true, true).toArray(),
    db.expenses.where("date").between(from, to, true, true).toArray(),
    db.purchases.where("date").between(from, to, true, true).toArray(),
    db.payments.where("date").between(from, to, true, true).toArray(),
    db.cash_moves.where("date").between(from, to, true, true).toArray(),
  ]);

  const s: Summary = {
    salesCount: sales.filter((x) => !x.deleted).length,
    sales: 0,
    discount: 0,
    cost: 0,
    received: 0,
    creditGiven: 0,
    returns: 0,
    returnCost: 0,
    refunds: 0,
    netSales: 0,
    grossProfit: 0,
    expenses: 0,
    netProfit: 0,
    purchases: 0,
    purchasePaid: 0,
    collections: 0,
    supplierPayments: 0,
    cashIn: 0,
    cashOut: 0,
    byMethod: {},
    series: [],
    seriesBy: "day",
    top: [],
    expenseByCat: {},
  };

  // চার্টের দাগ: ডাটা যেদিন থেকে আছে সেদিন থেকে; ৬২ দিনের বেশি হলে মাস ধরে
  const dates = [...sales, ...returns, ...expenses].filter((x) => !x.deleted).map((x) => x.date);
  const first = dates.length ? dates.reduce((a, b) => (a < b ? a : b)) : to;
  const start = from > first ? from : first;
  const monthly = (Date.parse(to) - Date.parse(start)) / 86_400_000 > 62;
  s.seriesBy = monthly ? "month" : "day";
  const keyOf = (d: string) => (monthly ? d.slice(0, 7) : d);
  const blank = (k: string): DaySeries => ({ date: k, sales: 0, profit: 0, expense: 0 });
  const days = new Map<string, DaySeries>();
  for (let d = start; d <= to && days.size < 400; d = addDays(d, 1)) if (!days.has(keyOf(d))) days.set(keyOf(d), blank(keyOf(d)));
  const day = (d: string) => days.get(keyOf(d)) ?? days.set(keyOf(d), blank(keyOf(d))).get(keyOf(d))!;
  const top = new Map<string, TopProduct>();

  for (const x of sales) {
    if (x.deleted) continue;
    s.sales += x.total;
    s.cost += x.cost;
    s.received += x.paid;
    s.creditGiven += x.due;
    s.discount += x.discount + x.items.reduce((a, i) => a + i.disc_amount, 0);
    const dd = day(x.date);
    dd.sales += x.total;
    dd.profit += x.total - x.cost;
    const factor = x.subtotal > 0 ? x.total / x.subtotal : 1;
    for (const it of x.items) {
      const t = top.get(it.variant_id) ?? { key: it.variant_id, name: it.name, variant: it.variant_name, unit: it.unit, qty: 0, revenue: 0, profit: 0 };
      t.qty += it.qty;
      t.revenue += it.total * factor;
      t.profit += it.total * factor - it.cost * it.qty;
      top.set(it.variant_id, t);
    }
  }
  for (const r of returns) {
    if (r.deleted) continue;
    s.returns += r.total;
    s.returnCost += r.cost;
    s.refunds += r.refund;
    const dd = day(r.date);
    dd.sales -= r.total;
    dd.profit -= r.total - r.cost;
    for (const it of r.items) {
      const t = top.get(it.variant_id);
      if (t) {
        t.qty -= it.qty;
        t.revenue -= it.total;
        t.profit -= it.total - it.cost * it.qty;
      }
    }
  }
  for (const e of expenses) {
    if (e.deleted) continue;
    s.expenses += e.amount;
    day(e.date).expense += e.amount;
    s.expenseByCat[e.category] = (s.expenseByCat[e.category] ?? 0) + e.amount;
  }
  for (const p of purchases) {
    if (p.status === "void") continue;
    s.purchases += p.total;
    s.purchasePaid += p.paid;
  }
  for (const p of payments) {
    if (p.deleted) continue;
    if (p.party_type === "customer") s.collections += p.amount;
    else s.supplierPayments += p.amount;
  }
  // মুছে ফেলা মেমো/খরচের এন্ট্রি ও তার উল্টো এন্ট্রি মিলে শূন্য — টাকার হিসাবে ধরা হয় না
  const netByRef = new Map<string, number>();
  for (const c of cash) if (c.ref_id) netByRef.set(c.ref_id, (netByRef.get(c.ref_id) ?? 0) + c.amount);
  for (const c of cash) {
    if (c.ref_id && Math.abs(netByRef.get(c.ref_id) ?? 1) < 0.005) continue;
    const m = (s.byMethod[c.method] ??= { in: 0, out: 0 });
    if (c.amount > 0) {
      s.cashIn += c.amount;
      m.in += c.amount;
    } else {
      s.cashOut -= c.amount;
      m.out -= c.amount;
    }
  }

  s.netSales = s.sales - s.returns;
  s.grossProfit = s.sales - s.cost - (s.returns - s.returnCost);
  s.netProfit = s.grossProfit - s.expenses;
  s.series = [...days.values()].sort((a, b) => a.date.localeCompare(b.date)).map((d) => ({ ...d, sales: round2(d.sales), profit: round2(d.profit) }));
  s.top = [...top.values()].filter((t) => t.qty > 0).sort((a, b) => b.revenue - a.revenue);
  return s;
}

export async function receivablesPayables() {
  const [customers, suppliers, balances] = await Promise.all([db.customers.toArray(), db.suppliers.toArray(), db.balances.toArray()]);
  const custIds = new Set(customers.map((c) => c.id));
  const supIds = new Set(suppliers.map((c) => c.id));
  let receivable = 0;
  let payable = 0;
  for (const b of balances) {
    if (custIds.has(b.party_id) && b.amount > 0) receivable += b.amount;
    if (supIds.has(b.party_id) && b.amount > 0) payable += b.amount;
  }
  return { receivable: round2(receivable), payable: round2(payable) };
}

export async function cashBalances(): Promise<Record<PayMethod, number>> {
  const rows = await db.cash.toArray();
  const out = { cash: 0, bkash: 0, nagad: 0, rocket: 0, bank: 0, cheque: 0 } as Record<PayMethod, number>;
  for (const r of rows) out[r.method] = round2(r.amount);
  return out;
}

export async function cashBook(from: string, to: string): Promise<{ opening: number; rows: (CashMove & { balance: number })[]; closing: number }> {
  // শুধু নগদ ক্যাশ (method = cash) এর বই
  const all = await db.cash_moves.where("date").belowOrEqual(to).toArray();
  const cashOnly = all.filter((c) => c.method === "cash").sort((a, b) => a.date.localeCompare(b.date) || a.created_at - b.created_at);
  let bal = 0;
  let opening = 0;
  const rows: (CashMove & { balance: number })[] = [];
  for (const c of cashOnly) {
    bal += c.amount;
    if (c.date < from) opening = bal;
    else rows.push({ ...c, balance: round2(bal) });
  }
  return { opening: round2(opening), rows, closing: round2(bal) };
}
