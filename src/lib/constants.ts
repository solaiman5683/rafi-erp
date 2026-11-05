import type { Customer, PayMethod, Settings } from "./types";

/** [বাংলা, English] */
export type BiText = readonly [string, string];

export const UNITS: Record<string, BiText> = {
  pcs: ["পিস", "pcs"],
  kg: ["কেজি", "kg"],
  gram: ["গ্রাম", "g"],
  feet: ["ফুট", "ft"],
  meter: ["মিটার", "m"],
  gauge: ["গজ", "yard"],
  inch: ["ইঞ্চি", "inch"],
  dozen: ["ডজন", "dozen"],
  box: ["বক্স", "box"],
  packet: ["প্যাকেট", "packet"],
  coil: ["কয়েল", "coil"],
  roll: ["রোল", "roll"],
  bundle: ["বান্ডেল", "bundle"],
  set: ["সেট", "set"],
  pair: ["জোড়া", "pair"],
  liter: ["লিটার", "liter"],
  gallon: ["গ্যালন", "gallon"],
  bag: ["বস্তা", "bag"],
  length: ["লেন্থ", "length"],
  sheet: ["শিট", "sheet"],
};

/** দশমিক পরিমাণ (যেমন ২.৫ কেজি) যেসব এককে স্বাভাবিক */
export const DECIMAL_UNITS = new Set(["kg", "gram", "feet", "meter", "gauge", "inch", "liter", "gallon"]);

export const PAY_METHODS: { id: PayMethod; label: BiText; color: string }[] = [
  { id: "cash", label: ["ক্যাশ", "Cash"], color: "bg-emerald-600" },
  { id: "bkash", label: ["বিকাশ", "bKash"], color: "bg-pink-600" },
  { id: "nagad", label: ["নগদ (Nagad)", "Nagad"], color: "bg-orange-600" },
  { id: "rocket", label: ["রকেট", "Rocket"], color: "bg-purple-700" },
  { id: "bank", label: ["ব্যাংক", "Bank"], color: "bg-blue-700" },
  { id: "cheque", label: ["চেক", "Cheque"], color: "bg-slate-700" },
];

export const CUSTOMER_TYPES: Record<Customer["type"], BiText> = {
  retail: ["খুচরা ক্রেতা", "Retail"],
  wholesale: ["পাইকারি ক্রেতা", "Wholesale"],
  contractor: ["কন্ট্রাক্টর", "Contractor"],
  mistri: ["মিস্ত্রি", "Mistri"],
};

export const EXPENSE_CATEGORIES: { id: string; label: BiText; icon: string; color: string }[] = [
  { id: "rent", label: ["দোকান ভাড়া", "Shop rent"], icon: "Store", color: "#7c3aed" },
  { id: "salary", label: ["কর্মচারী বেতন", "Salary"], icon: "Users", color: "#2563eb" },
  { id: "electricity", label: ["বিদ্যুৎ বিল", "Electricity"], icon: "Lightbulb", color: "#ca8a04" },
  { id: "transport", label: ["ভ্যান / গাড়ি ভাড়া", "Transport"], icon: "Truck", color: "#0891b2" },
  { id: "labour", label: ["কুলি / লেবার", "Labour"], icon: "HardHat", color: "#ea580c" },
  { id: "food", label: ["চা-নাস্তা", "Tea & snacks"], icon: "Coffee", color: "#a16207" },
  { id: "mobile", label: ["মোবাইল / নেট বিল", "Phone & internet"], icon: "Smartphone", color: "#db2777" },
  { id: "repair", label: ["মেরামত", "Repair"], icon: "Wrench", color: "#475569" },
  { id: "other", label: ["অন্যান্য", "Other"], icon: "Receipt", color: "#64748b" },
];

export interface ExpenseCategory {
  id: string;
  label: BiText;
  icon: string;
  color: string;
  custom?: boolean;
  deleted?: boolean;
}

/** আগে থেকে থাকা খাত + মালিকের বানানো খাত ("অন্যান্য" সবসময় শেষে) */
export function expenseCategories(s?: Settings): ExpenseCategory[] {
  const custom: ExpenseCategory[] = (s?.expense_categories ?? []).map((c) => ({
    id: c.id,
    label: [c.name, c.name] as const,
    icon: c.icon,
    color: c.color,
    custom: true,
    deleted: !!c.deleted,
  }));
  const other = EXPENSE_CATEGORIES[EXPENSE_CATEGORIES.length - 1];
  return [...EXPENSE_CATEGORIES.slice(0, -1), ...custom, other];
}

/** নবাবপুরের হার্ডওয়্যার দোকানের জন্য শুরুর ক্যাটাগরি */
export const DEFAULT_CATEGORIES: { name: string; name_en: string; icon: string; color: string }[] = [
  { name: "পাইপ ও ফিটিংস", name_en: "Pipes & Fittings", icon: "Cylinder", color: "#0284c7" },
  { name: "স্যানিটারি", name_en: "Sanitary", icon: "ShowerHead", color: "#0891b2" },
  { name: "ইলেকট্রিক্যাল", name_en: "Electrical", icon: "Zap", color: "#ca8a04" },
  { name: "টুলস ও যন্ত্রপাতি", name_en: "Tools", icon: "Hammer", color: "#dc2626" },
  { name: "নাট-বল্টু-স্ক্রু", name_en: "Nuts, Bolts & Screws", icon: "Bolt", color: "#475569" },
  { name: "রং ও কেমিক্যাল", name_en: "Paint & Chemicals", icon: "PaintBucket", color: "#9333ea" },
  { name: "মোটর ও পাম্প", name_en: "Motors & Pumps", icon: "Fan", color: "#059669" },
  { name: "তালা ও কব্জা", name_en: "Locks & Hinges", icon: "Lock", color: "#b45309" },
  { name: "ওয়েল্ডিং", name_en: "Welding", icon: "Flame", color: "#ea580c" },
  { name: "অন্যান্য", name_en: "Others", icon: "Package", color: "#64748b" },
];

export const CATEGORY_COLORS = [
  "#0284c7", "#0891b2", "#059669", "#16a34a", "#ca8a04", "#ea580c", "#dc2626", "#db2777", "#9333ea", "#4f46e5", "#475569", "#b45309",
];

/** হার্ডওয়্যারে বেশি চলা সাইজ — নতুন পণ্যের সাইজের ঘরের নিচে সাজেশন হিসেবে আসে */
/** কম স্টক সতর্কতার ডিফল্ট সীমা (সেটিংস থেকে বদলানো যায়) */
export const DEFAULT_LOW_STOCK = 5;

export const COMMON_SIZES = ['⅛"', '¼"', '⅜"', '½"', '⅝"', '¾"', '1"', '1¼"', '1½"', '2"', '2½"', '3"', '4"', '6"', '8"'];

export const WALK_IN: BiText = ["সাধারণ ক্রেতা", "Walk-in customer"];
