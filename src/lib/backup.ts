import { ALL_WRITE_TABLES, db, SYNC_TABLE_NAMES } from "./db";
import { todayISO } from "./format";
import { rebuildDerived } from "./ops";

export async function exportBackup(): Promise<void> {
  const tables: Record<string, unknown[]> = {};
  for (const t of SYNC_TABLE_NAMES) tables[t] = await db.table(t).toArray();
  const data = { app: "rafi-erp", version: 1, exported_at: new Date().toISOString(), tables };
  const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `rafi-erp-backup-${todayISO()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

/** ব্যাকআপ ফাইল থেকে ডাটা ফেরত আনা — নতুন বা নতুনতর রেকর্ডগুলো বসে এবং সার্ভারে পাঠানো হয় */
export async function importBackup(file: File): Promise<number> {
  const data = JSON.parse(await file.text());
  if (data?.app !== "rafi-erp" || !data.tables) throw new Error("এটা সঠিক ব্যাকআপ ফাইল নয়");
  let count = 0;
  await db.transaction("rw", ALL_WRITE_TABLES.map((t) => db.table(t)), async (tx) => {
    const outbox = tx.table("outbox");
    for (const t of SYNC_TABLE_NAMES) {
      const table = tx.table(t);
      const rows = (data.tables[t] ?? []) as { id: string; updated_at: number }[];
      for (const r of rows) {
        if (!r?.id) continue;
        const cur = await table.get(r.id);
        if (cur && (cur.updated_at ?? 0) >= (r.updated_at ?? 0)) continue;
        await table.put(r);
        await outbox.add({ tbl: t, id: r.id });
        count++;
      }
    }
  });
  await rebuildDerived();
  return count;
}
