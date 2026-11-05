import type { CatalogItem, VariantWithStock } from "./hooks";

/**
 * পণ্য খোঁজার ইঞ্জিন। নাম, ব্র্যান্ড, ক্যাটাগরি, সাইজ ও কোড — যেকোনোটার টুকরো লিখলে মেলে
 * ("cnc 1/4", "randa 1/2")। বানান ভুল হলেও কাছাকাছি পণ্য আসে, আর বাংলা-ইংরেজি উচ্চারণও মেলে
 * ("পাইপ" ↔ "pipe")। কোথায় মিলেছে তা দেখানোর জন্য matchRanges আছে।
 */

const BN_DIGITS = "০১২৩৪৫৬৭৮৯";
const FRACTIONS: Record<string, string> = {
  "½": "1/2", "¼": "1/4", "¾": "3/4", "⅛": "1/8", "⅜": "3/8", "⅝": "5/8", "⅞": "7/8", "⅓": "1/3", "⅔": "2/3",
};

/** ছোট হাতের অক্ষর, ইংরেজি অঙ্ক, ½ → 1/2; map[i] = আসল লেখার কোন অক্ষর থেকে এসেছে */
function normalizeWithMap(text: string): { norm: string; map: number[]; source: string } {
  const source = text.normalize("NFC");
  let norm = "";
  const map: number[] = [];
  const push = (s: string, i: number) => {
    for (const ch of s) {
      norm += ch;
      for (let k = 0; k < ch.length; k++) map.push(i);
    }
  };
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (FRACTIONS[ch]) {
      if (norm && /\d$/.test(norm)) push(" ", i); // 1½ → 1 1/2
      push(FRACTIONS[ch], i);
    } else if (BN_DIGITS.includes(ch)) push(String(BN_DIGITS.indexOf(ch)), i);
    else if (/["'`”“’‘,;()]/.test(ch)) push(" ", i);
    else push(ch.toLowerCase(), i);
  }
  return { norm, map, source };
}

export const normalize = (text: string) => normalizeWithMap(text).norm.replace(/\s+/g, " ").trim();

const GLYPH: Record<string, string> = Object.fromEntries(Object.entries(FRACTIONS).map(([g, f]) => [f, g]));

/**
 * লেখা সাইজকে সুন্দর ইঞ্চি রূপে: "3/4" → ¾", "1 1/4" / "1-1/4" → 1¼", "2" → 2", "১/২ ইঞ্চি" → ½"
 * সাইজ না হলে (যেমন "10mm", "লাল") null
 */
export function prettySize(text: string): string | null {
  const t = normalize(text).replace(/(inches|inch|in|ইঞ্চি|ইঞ্চ)$/, "").trim();
  let m = t.match(/^(?:(\d+)\s*[- ]\s*)?(\d+)\/(\d+)$/);
  if (m) {
    const g = GLYPH[`${m[2]}/${m[3]}`];
    const frac = g ?? `${m[2]}/${m[3]}`;
    return m[1] ? `${m[1]}${g ? "" : " "}${frac}"` : `${frac}"`;
  }
  m = t.match(/^\d+(?:\.\d+)?$/);
  return m ? `${m[0]}"` : null;
}

/** সাইজ মেলানোর জন্য: ইউনিট ও ফাঁকা বাদ — `1"`, `1 inch`, `1inch` সব "1" */
const sizeKey = (s: string) => normalize(s).replace(/(inches|inch|ইঞ্চি)/g, "").replace(/\s+/g, "");

const hasDigit = (s: string) => /\d/.test(s);

const BN_PHONETIC: Record<string, string> = {
  ক: "k", খ: "k", গ: "g", ঘ: "g", ঙ: "n", চ: "c", ছ: "c", জ: "j", ঝ: "j", ঞ: "n", ট: "t", ঠ: "t", ড: "d", ঢ: "d", ণ: "n", ত: "t", থ: "t", দ: "d", ধ: "d", ন: "n",
  প: "p", ফ: "f", ব: "b", ভ: "b", ম: "m", য: "j", র: "r", ল: "l", শ: "s", ষ: "s", স: "s", হ: "h", ৎ: "t", "ং": "n", "ঃ": "h",
};

/** উচ্চারণের কঙ্কাল (শুধু ব্যঞ্জন): "pipe" ও "পাইপ" দুটোই "pp"; "screw" ও "স্ক্রু" দুটোই "skr" */
function skeleton(word: string): string {
  let out = "";
  let last = -2;
  const w = word
    // ড়/ঢ় উচ্চারণে "র" (যুক্ত ও আলাদা দুই রূপই)
    .replace(/[ড়ঢ়]|[ডঢ]়/g, "র")
    .replace(/ph/g, "f")
    .replace(/ch/g, "C")
    .replace(/sh/g, "s")
    .replace(/[kgjtdb]h/g, (m) => m[0])
    .replace(/q/g, "k")
    .replace(/z/g, "j")
    .replace(/v/g, "b")
    .replace(/x/g, "ks");
  for (let i = 0; i < w.length; i++) {
    const ch = w[i];
    let c = "";
    // য-ফলা (্য) উচ্চারণে স্বরের মতো: হ্যাঙ্গার ↔ hanger, ক্যাবল ↔ cable
    if (ch === "য" && w[i - 1] === "্") continue;
    if (BN_PHONETIC[ch]) c = BN_PHONETIC[ch];
    else if (/[bdfgjklmnprst]/.test(ch)) c = ch;
    else if (ch === "C") c = "c";
    else if (ch === "c") c = "k";
    else if (ch === "h" && i === 0) c = "h";
    if (!c) continue;
    // শুধু পাশাপাশি দ্বিত্ব এক হয় (hammer, দ্দ); "pipe"-এর দুই p আলাদা থাকে
    const adjacent = last === i - 1 || (last === i - 2 && w[i - 1] === "্");
    if (!(adjacent && out.endsWith(c))) out += c;
    last = i;
  }
  // "ng" আর "n" একই ধরা: rong ↔ রং, bangla ↔ বাংলা, hanger ↔ হ্যাঙ্গার
  return out.replace(/ng/g, "n");
}

/** Damerau-Levenshtein; max পেরোলে আগেই থামে */
function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev2: number[] = [];
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
      cur[j] = v;
      if (v < best) best = v;
    }
    if (best > max) return max + 1;
    prev2 = prev;
    prev = cur;
  }
  return prev[b.length];
}

const allowedTypos = (len: number) => (len >= 7 ? 2 : len >= 4 ? 1 : 0);

const TIER = { full: 120, word: 100, prefix: 80, sub: 60, typo: 35, sound: 25 } as const;
const FUZZY_BELOW = TIER.sub;

interface Field {
  norm: string;
  compact: string;
  words: string[];
  sizeKey: string;
}

function makeField(text: string): Field {
  const norm = normalize(text);
  const words = norm.split(/[\s\-_]+/).filter(Boolean);
  const joined = words.slice(0, -1).map((w, i) => w + words[i + 1]); // "ball nose" ↔ "ballnose"
  return { norm, compact: norm.replace(/[\s\-_]+/g, ""), words: [...words, ...joined], sizeKey: sizeKey(text) };
}

/** একটা শব্দ এই ঘরে কতটা ভালো মেলে; 0 মানে মেলে না */
function scoreToken(token: string, f: Field): number {
  if (!f.norm) return 0;
  if (token === f.norm || sizeKey(token) === f.sizeKey) return TIER.full;
  if (f.words.includes(token)) return TIER.word;
  if (f.words.some((w) => w.startsWith(token))) return TIER.prefix;
  if (f.norm.includes(token) || (token.length >= 4 && f.compact.includes(token))) return TIER.sub;
  // সংখ্যা/সাইজে বানান-ভুল ধরা যাবে না: 1/2 আর 1/4 আলাদা জিনিস
  if (hasDigit(token) || token.length < 3) return 0;
  const typos = allowedTypos(token.length);
  if (typos) {
    for (const w of f.words) {
      if (hasDigit(w)) continue;
      if (editDistance(token, w, typos) <= typos) return TIER.typo;
      if (w.length > token.length && editDistance(token, w.slice(0, token.length), typos) <= typos) return TIER.typo - 5;
    }
  }
  const sk = skeleton(token);
  if (sk.length >= 2) {
    for (const w of f.words) {
      if (hasDigit(w)) continue;
      const wk = skeleton(w);
      if (wk === sk || (sk.length >= 4 && editDistance(sk, wk, 1) <= 1)) return TIER.sound;
      // অর্ধেক লেখা অবস্থাতেই মেলানো: "scre" → স্ক্রু (অন্তত ৩টা ব্যঞ্জন লাগে)
      if (sk.length >= 3 && token.length >= 4 && wk.startsWith(sk)) return TIER.sound - 3;
    }
  }
  return 0;
}

interface IndexedItem {
  name: Field;
  brand: Field;
  category: Field;
  variants: { v: VariantWithStock; name: Field; sku: Field }[];
}

const cache = new WeakMap<CatalogItem, IndexedItem>();

function indexOf(item: CatalogItem): IndexedItem {
  let idx = cache.get(item);
  if (!idx) {
    idx = {
      name: makeField(item.product.name),
      brand: makeField(item.product.brand ?? ""),
      category: makeField(`${item.category?.name ?? ""} ${item.category?.name_en ?? ""}`),
      variants: item.variants.map((v) => ({ v, name: makeField(v.name), sku: makeField(v.sku ?? "") })),
    };
    cache.set(item, idx);
  }
  return idx;
}

export interface SearchHit {
  item: CatalogItem;
  score: number;
  /** হুবহু না মিলে কাছাকাছি মিলেছে (বানান ভুল / আংশিক) */
  fuzzy: boolean;
  /** সাইজ/কোড লিখে খোঁজা হলে যে সাইজগুলো মিলেছে */
  variants: VariantWithStock[];
  categoryMatched: boolean;
  brandMatched: boolean;
}

/** "randa1/2" → randa, 1/2 ; "3d" অক্ষত থাকে */
function tokenize(q: string): string[] {
  return normalize(q)
    .split(" ")
    .flatMap((t) => t.split(/(?<=[^\d\s/.x])(?=\d)/))
    .filter(Boolean);
}

function hitFor(item: CatalogItem, tokens: string[]): (SearchHit & { matched: number }) | null {
  const idx = indexOf(item);
  let score = 0;
  let matched = 0;
  let fuzzy = false;
  let categoryMatched = false;
  let brandMatched = false;
  const variantTokens: string[] = [];

  for (const t of tokens) {
    const name = scoreToken(t, idx.name);
    const brand = scoreToken(t, idx.brand) * 0.85;
    const category = scoreToken(t, idx.category) * 0.7;
    let variant = 0;
    for (const x of idx.variants) variant = Math.max(variant, scoreToken(t, x.name) * 0.95, scoreToken(t, x.sku));
    const best = Math.max(name, brand, category, variant);
    if (!best) continue;
    matched++;
    score += best;
    if (name < FUZZY_BELOW && brand < FUZZY_BELOW * 0.85 && category < FUZZY_BELOW * 0.7 && variant < FUZZY_BELOW * 0.95) fuzzy = true;
    if (category === best) categoryMatched = true;
    if (brand === best) brandMatched = true;
    if (variant > 0 && variant >= Math.max(name, brand, category)) variantTokens.push(t);
  }
  if (!matched) return null;

  // সাইজ দিয়ে খুঁজলে শুধু সেই সাইজ; হুবহু মিললে (1/2) কাছাকাছি (1 1/2) বাদ
  let variants: VariantWithStock[] = [];
  for (const t of variantTokens) {
    const scored = idx.variants.map((x) => ({ v: x.v, s: Math.max(scoreToken(t, x.name), scoreToken(t, x.sku)) })).filter((x) => x.s > 0);
    const top = Math.max(0, ...scored.map((x) => x.s));
    const keep = top === TIER.full ? scored.filter((x) => x.s === TIER.full) : scored;
    for (const k of keep) if (!variants.includes(k.v)) variants.push(k.v);
  }
  variants = item.variants.filter((v) => variants.includes(v));

  return { item, score: score / tokens.length, fuzzy, variants, categoryMatched, brandMatched, matched };
}

/**
 * সব শব্দ মেলে এমন পণ্য আগে। কিছুই না পেলে যেগুলোর বেশিরভাগ শব্দ মেলে সেগুলো "কাছাকাছি" হিসেবে আসে।
 */
export function searchCatalog(items: CatalogItem[], query: string, limit = 120): SearchHit[] {
  const tokens = tokenize(query);
  if (!tokens.length) return [];
  const all = items.map((i) => hitFor(i, tokens)).filter((h): h is NonNullable<typeof h> => !!h);
  let hits = all.filter((h) => h.matched === tokens.length);
  if (!hits.length) {
    const need = Math.max(1, Math.ceil(tokens.length / 2));
    hits = all.filter((h) => h.matched >= need).map((h) => ({ ...h, fuzzy: true }));
  }
  return hits
    .sort((a, b) => Number(a.fuzzy) - Number(b.fuzzy) || b.score - a.score || a.item.product.name.localeCompare(b.item.product.name))
    .slice(0, limit);
}

/** লেখার কোন অংশগুলো খোঁজার সাথে মিলেছে (আসল লেখার [শুরু, শেষ) ঘর) */
export function matchRanges(text: string, query: string): { source: string; ranges: [number, number][] } {
  const { norm, map, source } = normalizeWithMap(text);
  const tokens = tokenize(query);
  const raw: [number, number][] = [];
  const toSource = (start: number, end: number) => raw.push([map[start], map[end - 1] + 1]);
  for (const t of tokens) {
    let found = false;
    for (let at = norm.indexOf(t); at !== -1; at = norm.indexOf(t, at + t.length)) {
      toSource(at, at + t.length);
      found = true;
    }
    if (found) continue;
    // হুবহু নেই — বানান-ভুলে মিলে গেলে পুরো শব্দটা
    for (const m of norm.matchAll(/[^\s\-_]+/g)) {
      if (scoreToken(t, makeField(m[0])) > 0) toSource(m.index, m.index + m[0].length);
    }
  }
  raw.sort((a, b) => a[0] - b[0]);
  const ranges: [number, number][] = [];
  for (const r of raw) {
    const last = ranges[ranges.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else ranges.push([r[0], r[1]]);
  }
  return { source, ranges };
}

/** এই লেখায় খোঁজার সব শব্দ (বানান-ভুল সহ) মেলে কিনা */
export function matchesText(text: string, query: string): boolean {
  const tokens = tokenize(query);
  const f = makeField(text);
  return tokens.length > 0 && tokens.every((t) => scoreToken(t, f) > 0);
}

/** নাম হুবহু এক কিনা (নতুন পণ্য বানানোর সময় ডুপ্লিকেট ধরার জন্য) */
export const sameText = (a: string, b: string) => normalize(a) === normalize(b);
