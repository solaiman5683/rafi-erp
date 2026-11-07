import { toPng } from "html-to-image";

/** কোটেশন — বিক্রি না করে দামের হিসাব; লিংকে শেয়ার করা যায়, তাই দোকানের তথ্যও সাথে থাকে */
export interface QuoteDoc {
  v: 1;
  no: string;
  /** YYYY-MM-DD */
  date: string;
  created_at: number;
  by_name?: string;
  shop: { name: string; tagline?: string; address?: string; phone?: string; phone2?: string; note?: string };
  customer?: { name: string; phone?: string; address?: string };
  items: {
    name: string;
    variant?: string;
    unit: string;
    qty: number;
    /** ছাড়ের আগের দাম (প্রতি একক) */
    list_price: number;
    /** ছাড়ের পরের দাম (প্রতি একক) */
    price: number;
    disc_amount: number;
    total: number;
  }[];
  subtotal: number;
  /** পুরো বিলে ছাড় */
  discount: number;
  total: number;
  note?: string;
}

const KEY = "erp.quote.current";

/** কোটেশন নম্বর: Q-বছরমাসদিন-ঘণ্টামিনিট (যেমন Q-261107-1432) */
export function quoteNo(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `Q-${String(d.getFullYear()).slice(2)}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

export function saveCurrentQuote(doc: QuoteDoc, sharedId?: string) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ doc, sharedId }));
  } catch {
    /* ignore */
  }
}

export function loadCurrentQuote(): { doc: QuoteDoc; sharedId?: string } | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** কোটেশনের ঘরটা ছবি (PNG) হিসেবে ডাউনলোড — ফোনের মাপ যাই হোক, ছবি সবসময় একই চওড়া */
export async function downloadAsImage(node: HTMLElement, fileName: string) {
  const width = 640;
  const url = await toPng(node, {
    pixelRatio: 2,
    backgroundColor: "#ffffff",
    width,
    style: { width: `${width}px`, maxWidth: "none", margin: "0", boxShadow: "none" },
    cacheBust: true,
  });
  const a = document.createElement("a");
  a.href = url;
  a.download = `${fileName}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
