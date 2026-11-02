export type Lang = "bn" | "en";

const BN_DIGITS = "০১২৩৪৫৬৭৮৯";

/** বাংলা সংখ্যা, কমা, ৳ চিহ্ন সরিয়ে সাধারণ সংখ্যার স্ট্রিং বানায় */
export function normalizeNumberInput(s: string): string {
  return s
    .replace(/[০-৯]/g, (d) => String(BN_DIGITS.indexOf(d)))
    .replace(/[৳,\s]/g, "")
    .replace(/[।]/g, ".");
}

export function parseNum(s: string | number | null | undefined): number {
  if (typeof s === "number") return Number.isFinite(s) ? s : 0;
  if (!s) return 0;
  const n = Number.parseFloat(normalizeNumberInput(s));
  return Number.isFinite(n) ? n : 0;
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

const nfCache = new Map<string, Intl.NumberFormat>();
function nf(locale: string, maxFrac: number) {
  const key = `${locale}|${maxFrac}`;
  let f = nfCache.get(key);
  if (!f) {
    f = new Intl.NumberFormat(locale, { maximumFractionDigits: maxFrac, minimumFractionDigits: 0 });
    nfCache.set(key, f);
  }
  return f;
}

/** লাখ-কোটি ভাগে সংখ্যা (সবসময় ইংরেজি অঙ্কে): 12,34,567 */
export function fmtNum(n: number, maxFrac = 2): string {
  return nf("en-IN", maxFrac).format(round2(n || 0));
}

export function fmtMoney(n: number): string {
  const neg = n < 0;
  return `${neg ? "-" : ""}৳${fmtNum(Math.abs(n))}`;
}

export function todayISO(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d + days);
  return todayISO(dt);
}

const BN_MONTHS = ["জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"];
const EN_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const BN_DAYS = ["রবিবার", "সোমবার", "মঙ্গলবার", "বুধবার", "বৃহস্পতিবার", "শুক্রবার", "শনিবার"];
const EN_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function fmtDate(iso: string, lang: Lang): string {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return lang === "bn" ? `${d} ${BN_MONTHS[m - 1]} ${y}` : `${d} ${EN_MONTHS[m - 1]} ${y}`;
}

export function fmtShortDate(iso: string, lang: Lang): string {
  const [, m, d] = iso.slice(0, 10).split("-").map(Number);
  return lang === "bn" ? `${d} ${BN_MONTHS[m - 1].slice(0, 3)}` : `${d} ${EN_MONTHS[m - 1]}`;
}

export function fmtTime(ts: number): string {
  const d = new Date(ts);
  let h = d.getHours();
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${String(d.getMinutes()).padStart(2, "0")} ${ap}`;
}

export function weekdayName(iso: string, lang: Lang): string {
  const [y, m, d] = iso.split("-").map(Number);
  const wd = new Date(y, m - 1, d).getDay();
  return lang === "bn" ? BN_DAYS[wd] : EN_DAYS[wd];
}

// ---------------- টাকা কথায় ----------------

const BN_0_99 = (
  "শূন্য এক দুই তিন চার পাঁচ ছয় সাত আট নয় দশ এগারো বারো তেরো চৌদ্দ পনেরো ষোলো সতেরো আঠারো উনিশ " +
  "বিশ একুশ বাইশ তেইশ চব্বিশ পঁচিশ ছাব্বিশ সাতাশ আটাশ উনত্রিশ ত্রিশ একত্রিশ বত্রিশ তেত্রিশ চৌত্রিশ পঁয়ত্রিশ ছত্রিশ সাঁইত্রিশ আটত্রিশ উনচল্লিশ " +
  "চল্লিশ একচল্লিশ বিয়াল্লিশ তেতাল্লিশ চুয়াল্লিশ পঁয়তাল্লিশ ছেচল্লিশ সাতচল্লিশ আটচল্লিশ উনপঞ্চাশ পঞ্চাশ একান্ন বায়ান্ন তিপ্পান্ন চুয়ান্ন পঞ্চান্ন ছাপ্পান্ন সাতান্ন আটান্ন উনষাট " +
  "ষাট একষট্টি বাষট্টি তেষট্টি চৌষট্টি পঁয়ষট্টি ছেষট্টি সাতষট্টি আটষট্টি উনসত্তর সত্তর একাত্তর বাহাত্তর তিয়াত্তর চুয়াত্তর পঁচাত্তর ছিয়াত্তর সাতাত্তর আটাত্তর উনআশি " +
  "আশি একাশি বিরাশি তিরাশি চুরাশি পঁচাশি ছিয়াশি সাতাশি আটাশি উননব্বই নব্বই একানব্বই বিরানব্বই তিরানব্বই চুরানব্বই পঁচানব্বই ছিয়ানব্বই সাতানব্বই আটানব্বই নিরানব্বই"
).split(" ");

const EN_ONES = "Zero One Two Three Four Five Six Seven Eight Nine Ten Eleven Twelve Thirteen Fourteen Fifteen Sixteen Seventeen Eighteen Nineteen".split(" ");
const EN_TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function en0to99(n: number): string {
  if (n < 20) return EN_ONES[n];
  return EN_TENS[Math.floor(n / 10)] + (n % 10 ? ` ${EN_ONES[n % 10]}` : "");
}

/** ভারতীয় পদ্ধতিতে (কোটি-লাখ-হাজার-শত) ভাগ করে কথায় লেখে */
function intToWords(n: number, lang: Lang): string {
  if (n === 0) return lang === "bn" ? BN_0_99[0] : EN_ONES[0];
  const w = (x: number) => (lang === "bn" ? BN_0_99[x] : en0to99(x));
  const parts: string[] = [];
  const crore = Math.floor(n / 10_000_000);
  n %= 10_000_000;
  const lakh = Math.floor(n / 100_000);
  n %= 100_000;
  const thousand = Math.floor(n / 1000);
  n %= 1000;
  const hundred = Math.floor(n / 100);
  const rest = n % 100;
  if (crore) parts.push(`${crore > 99 ? intToWords(crore, lang) : w(crore)} ${lang === "bn" ? "কোটি" : "Crore"}`);
  if (lakh) parts.push(`${w(lakh)} ${lang === "bn" ? "লক্ষ" : "Lakh"}`);
  if (thousand) parts.push(`${w(thousand)} ${lang === "bn" ? "হাজার" : "Thousand"}`);
  if (hundred) parts.push(lang === "bn" ? `${w(hundred)}শত` : `${w(hundred)} Hundred`);
  if (rest) parts.push(w(rest));
  return parts.join(" ");
}

export function amountInWords(amount: number, lang: Lang): string {
  const abs = Math.abs(round2(amount));
  const taka = Math.floor(abs);
  const paisa = Math.round((abs - taka) * 100);
  if (lang === "bn") {
    let s = `${intToWords(taka, "bn")} টাকা`;
    if (paisa) s += ` ${intToWords(paisa, "bn")} পয়সা`;
    return `${s} মাত্র`;
  }
  let s = `${intToWords(taka, "en")} Taka`;
  if (paisa) s += ` and ${intToWords(paisa, "en")} Paisa`;
  return `${s} Only`;
}
