import type { CashMove, LedgerEntry } from "./types";

type Lx = (bn: string, en: string) => string;

export function ledgerLabel(e: LedgerEntry, L: Lx): string {
  const ref = e.ref_no ? ` (${e.ref_no})` : "";
  const cust = e.party_type === "customer";
  switch (e.type) {
    case "opening":
      return cust ? L("আগের বাকি", "Opening due") : L("আগের দেনা", "Opening payable");
    case "sale":
      return L("বিক্রি", "Sale") + ref;
    case "purchase":
      return L("মাল কেনা", "Purchase") + ref;
    case "payment":
      return (cust ? L("টাকা জমা", "Payment received") : L("টাকা দেওয়া", "Payment made")) + ref;
    case "return":
      return L("মাল ফেরত", "Return") + ref;
    case "void":
      return L("বাতিল", "Voided") + ref;
    default:
      return L("সমন্বয়", "Adjustment") + ref;
  }
}

export function cashLabel(c: CashMove, L: Lx): string {
  const map: Record<CashMove["type"], [string, string]> = {
    sale: ["বিক্রি", "Sale"],
    collection: ["বাকি আদায়", "Due collected"],
    purchase: ["মাল কেনা", "Purchase"],
    supplier_payment: ["সাপ্লায়ারকে দেওয়া", "Supplier payment"],
    expense: ["খরচ", "Expense"],
    refund: ["ফেরত টাকা", "Refund"],
    void: ["বাতিল", "Void"],
    owner_in: ["মালিক জমা দিলেন", "Owner added"],
    owner_out: ["মালিক নিলেন", "Owner took"],
    opening: ["শুরুর ক্যাশ", "Opening cash"],
  };
  const [bn, en] = map[c.type] ?? ["অন্যান্য", "Other"];
  return L(bn, en);
}

/** খাতার এন্ট্রি সময় অনুযায়ী সাজিয়ে চলমান ব্যালেন্স */
export function withRunning(entries: LedgerEntry[]) {
  const sorted = [...entries].sort((a, b) => a.created_at - b.created_at || a.date.localeCompare(b.date));
  let bal = 0;
  return sorted.map((e) => {
    bal += e.bill - e.paid;
    return { e, balance: Math.round(bal * 100) / 100 };
  });
}
