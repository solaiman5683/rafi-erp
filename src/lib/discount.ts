import { round2 } from "./format";
import type { DiscMode } from "./types";

export interface ResolvedDiscount {
  /** মোট ছাড় (টাকা) */
  amount: number;
  /** ছাড় শতাংশে */
  percent: number;
  /** ছাড়ের পর মোট */
  final: number;
}

/**
 * base = ছাড়ের আগের মোট টাকা।
 * mode = "percent" → value শতাংশ; "amount" → value টাকা; "price" → value হলো ছাড়ের পর মোট দাম।
 * যেকোনো একটা দিলে বাকি দুটো হিসাব হয়ে যায়।
 */
export function resolveDiscount(base: number, mode: DiscMode, value: number): ResolvedDiscount {
  let amount = 0;
  if (mode === "percent") amount = (base * value) / 100;
  else if (mode === "amount") amount = value;
  else if (mode === "price") amount = base - value;
  amount = round2(amount);
  const final = round2(base - amount);
  const percent = base > 0 ? round2((amount / base) * 100) : 0;
  return { amount, percent, final };
}

export interface LineCalc {
  disc_amount: number;
  price: number;
  total: number;
  percent: number;
}

/**
 * এক লাইনের হিসাব। "price" মোডে value = প্রতি এককের বিক্রি দাম;
 * "amount" মোডে value = পুরো লাইনে মোট ছাড়।
 */
export function calcLine(qty: number, listPrice: number, mode: DiscMode, value: number): LineCalc {
  const base = round2(qty * listPrice);
  const priceValue = mode === "price" ? round2(value * qty) : value;
  const r = resolveDiscount(base, mode, priceValue);
  return {
    disc_amount: r.amount,
    total: r.final,
    price: qty > 0 ? round2(r.final / qty) : listPrice,
    percent: r.percent,
  };
}
