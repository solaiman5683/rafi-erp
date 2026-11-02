import { useSyncExternalStore } from "react";
import { JOURNAL_TABLES, SYNC_TABLES, type SyncChange, type SyncTable } from "../../shared/tables";
import { api, ApiError } from "./api";
import { ALL_WRITE_TABLES, db, getMeta, setMeta } from "./db";
import { applyJournal, onLocalWrite, txTables } from "./ops";

export type SyncPhase = "idle" | "syncing" | "offline" | "error";

export interface SyncState {
  phase: SyncPhase;
  lastSync: number | null;
  error: string | null;
  online: boolean;
}

const PUSH_BATCH = 300;
const PULL_LIMIT = 1000;
const INTERVAL_MS = 20_000;

let state: SyncState = {
  phase: "idle",
  lastSync: null,
  error: null,
  online: typeof navigator !== "undefined" ? navigator.onLine : true,
};
const listeners = new Set<() => void>();

function setState(patch: Partial<SyncState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export function useSyncState(): SyncState {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
  );
}

const journalSet = new Set<SyncTable>(JOURNAL_TABLES);
const tableSet = new Set<string>(SYNC_TABLES);

async function push(): Promise<void> {
  for (;;) {
    const batch = await db.outbox.orderBy("seq").limit(PUSH_BATCH).toArray();
    if (!batch.length) return;
    // একই রেকর্ড একাধিকবার থাকলে একবারই পাঠাই
    const seen = new Set<string>();
    const changes: SyncChange[] = [];
    for (const o of batch) {
      const k = `${o.tbl}:${o.id}`;
      if (seen.has(k)) continue;
      seen.add(k);
      const rec = await db.table(o.tbl).get(o.id);
      if (!rec) continue;
      changes.push({ tbl: o.tbl, id: o.id, data: rec, updated_at: rec.updated_at ?? Date.now(), deleted: rec.deleted ? 1 : 0 });
    }
    if (changes.length) {
      const res = await api<{ rejected: { tbl: string; id: string; reason: string }[] }>("/sync/push", {
        method: "POST",
        json: { changes },
        timeoutMs: 60000,
      });
      if (res.rejected?.length) console.warn("সার্ভার কিছু এন্ট্রি নেয়নি", res.rejected);
    }
    await db.outbox.bulkDelete(batch.map((b) => b.seq!));
  }
}

async function applyRemote(changes: SyncChange[]) {
  const tables = ALL_WRITE_TABLES.map((t) => db.table(t));
  await db.transaction("rw", tables, async (tx) => {
    const t = txTables(tx);
    const outbox = t<{ tbl: string; id: string }, number>("outbox");
    for (const ch of changes) {
      if (!tableSet.has(ch.tbl)) continue;
      const table = t<Record<string, unknown> & { updated_at?: number }>(ch.tbl);
      const rec = { ...ch.data, id: ch.id, updated_at: ch.updated_at, deleted: ch.deleted };
      const local = await table.get(ch.id);
      if (journalSet.has(ch.tbl)) {
        // জার্নাল কখনো বদলায় না — নতুন হলে যোগ করে হিসাব আপডেট
        if (!local) {
          await table.put(rec);
          await applyJournal(ch.tbl, rec, t);
        }
        continue;
      }
      if (local) {
        const pending = await outbox.where("[tbl+id]").equals([ch.tbl, ch.id]).count();
        if (pending > 0 || (local.updated_at ?? 0) > ch.updated_at) continue;
      }
      await table.put(rec);
    }
  });
}

async function pull(): Promise<void> {
  let since = (await getMeta<number>("sync.lastSeq")) ?? 0;
  for (;;) {
    const res = await api<{ changes: SyncChange[]; lastSeq: number; hasMore: boolean }>(
      `/sync/pull?since=${since}&limit=${PULL_LIMIT}`,
      { timeoutMs: 60000 },
    );
    if (res.changes.length) await applyRemote(res.changes);
    since = res.lastSeq;
    await setMeta("sync.lastSeq", since);
    if (!res.hasMore) return;
  }
}

/**
 * সার্ভারে ডাটা পরিষ্কার করা হলে (epoch বদলালে) এই ডিভাইসের পুরনো কপি মুছে সব নতুন করে নামানো।
 * লগইন, ডিভাইস কোড ও অফলাইন লগইনের তথ্য থাকে; মেমো নম্বর আবার 0001 থেকে শুরু হয়।
 * push-এর আগে চলে, নইলে পুরনো এন্ট্রি আবার সার্ভারে উঠে যেত।
 */
async function checkEpoch(): Promise<void> {
  const { epoch } = await api<{ epoch: string | null }>("/sync/epoch");
  if (!epoch || epoch === (await getMeta<string>("sync.epoch"))) return;
  const tables = ALL_WRITE_TABLES.map((t) => db.table(t));
  await db.transaction("rw", tables, async (tx) => {
    for (const t of [...SYNC_TABLES, "stock", "balances", "cash", "outbox"]) await tx.table(t).clear();
    const meta = tx.table("meta");
    await meta.where("key").startsWith("counter.").delete();
    await meta.put({ key: "sync.lastSeq", value: 0 });
    await meta.put({ key: "sync.epoch", value: epoch });
  });
}

let running = false;
let again = false;
let enabled = false;

export async function syncNow(): Promise<void> {
  if (!enabled) return;
  if (running) {
    again = true;
    return;
  }
  if (!navigator.onLine) {
    setState({ phase: "offline", online: false });
    return;
  }
  running = true;
  setState({ phase: "syncing", online: true });
  try {
    await checkEpoch();
    await push();
    await pull();
    const now = Date.now();
    await setMeta("sync.lastSync", now);
    setState({ phase: "idle", lastSync: now, error: null });
  } catch (e) {
    const offline = e instanceof ApiError && e.status === 0;
    setState({ phase: offline ? "offline" : "error", error: e instanceof Error ? e.message : String(e), online: !offline });
  } finally {
    running = false;
    if (again) {
      again = false;
      void syncNow();
    }
  }
}

let debounce: ReturnType<typeof setTimeout> | undefined;
function scheduleSoon() {
  clearTimeout(debounce);
  debounce = setTimeout(() => void syncNow(), 1200);
}

let started = false;
let intervalId: ReturnType<typeof setInterval> | undefined;

/** লগইনের পর চালু হয়: নেট এলে, ট্যাব দেখা গেলে, নতুন এন্ট্রি হলে এবং প্রতি ২০ সেকেন্ডে সিঙ্ক */
export function startSync() {
  enabled = true;
  if (!started) {
    started = true;
    void getMeta<number>("sync.lastSync").then((t) => t && setState({ lastSync: t }));
    window.addEventListener("online", () => {
      setState({ online: true });
      void syncNow();
    });
    window.addEventListener("offline", () => setState({ online: false, phase: "offline" }));
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") void syncNow();
    });
    onLocalWrite(scheduleSoon);
  }
  clearInterval(intervalId);
  intervalId = setInterval(() => void syncNow(), INTERVAL_MS);
  void syncNow();
}

export function stopSync() {
  enabled = false;
  clearInterval(intervalId);
}

export async function resetSyncCursor() {
  await setMeta("sync.lastSeq", 0);
}
