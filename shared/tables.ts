/** যেসব টেবিল সব ডিভাইসে সিঙ্ক হয় */
export const SYNC_TABLES = [
  "settings",
  "categories",
  "products",
  "variants",
  "customers",
  "suppliers",
  "sales",
  "sale_returns",
  "purchases",
  "payments",
  "expenses",
  "stock_moves",
  "ledger",
  "cash_moves",
] as const;

export type SyncTable = (typeof SYNC_TABLES)[number];

/** শুধু মালিক (owner) এই টেবিলগুলোতে লিখতে পারবে */
export const OWNER_ONLY_TABLES: readonly SyncTable[] = [
  "settings",
  "categories",
  "products",
  "variants",
  "suppliers",
  "purchases",
];

/** জার্নাল টেবিল — একবার লেখা হলে আর বদলায় না (append-only) */
export const JOURNAL_TABLES: readonly SyncTable[] = ["stock_moves", "ledger", "cash_moves"];

export type Role = "owner" | "staff";

export interface SyncChange {
  tbl: SyncTable;
  id: string;
  data: Record<string, unknown>;
  updated_at: number;
  deleted: 0 | 1;
  seq?: number;
}

export interface PublicUser {
  id: string;
  name: string;
  role: Role;
}
