import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { toast } from "sonner";
import { ArrowDownLeft, ArrowUpRight, ClipboardCheck, Equal, History, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Field } from "./common";
import { NumInput } from "./NumInput";
import { Chips } from "./PartyForms";
import { UNITS } from "@/lib/constants";
import { db } from "@/lib/db";
import { round2 } from "@/lib/format";
import type { CatalogItem, VariantWithStock } from "@/lib/hooks";
import { useI18n } from "@/lib/i18n";
import { adjustStockBy } from "@/lib/ops";
import type { StockMove } from "@/lib/types";
import { cn } from "@/lib/utils";

type Mode = "add" | "remove" | "set";

const REASONS: Record<Mode, [string, string][]> = {
  add: [
    ["নতুন মাল (বিল ছাড়া)", "New stock (no bill)"],
    ["ফেরত এসেছে", "Returned"],
    ["গুনে ঠিক করা", "Stock count"],
    ["অন্যান্য", "Other"],
  ],
  remove: [
    ["নষ্ট / ভাঙা", "Damaged"],
    ["হারিয়ে গেছে", "Lost"],
    ["নিজের কাজে ব্যবহার", "Own use"],
    ["গুনে ঠিক করা", "Stock count"],
    ["অন্যান্য", "Other"],
  ],
  set: [["গুনে ঠিক করা", "Stock count"]],
};

const MOVE_LABEL: Record<StockMove["type"], [string, string]> = {
  opening: ["শুরুর স্টক", "Opening stock"],
  purchase: ["মাল কেনা", "Purchase"],
  sale: ["বিক্রি", "Sale"],
  return: ["কাস্টমার ফেরত", "Customer return"],
  adjust: ["স্টক বদল", "Adjustment"],
  void: ["বাতিল / মুছে ফেলা", "Cancelled / deleted"],
};

export type StockTarget = { item: CatalogItem; v: VariantWithStock };

/** স্টক যোগ/বিয়োগ/গুনে বসানো + কখন কে কতটা ঢুকিয়েছে-বের করেছে তার পুরো লগ */
export function StockDialog({ target, onClose }: { target: StockTarget | null; onClose: () => void }) {
  const { L, B } = useI18n();
  const [tab, setTab] = useState("adjust");
  useEffect(() => {
    if (target) setTab("adjust");
  }, [target]);

  return (
    <Dialog open={!!target} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {target?.item.product.name} {target?.v.name && <span className="text-muted-foreground">· {target.v.name}</span>}
          </DialogTitle>
        </DialogHeader>
        {target && (
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="adjust">
                <ClipboardCheck /> {L("স্টক বদলান", "Change stock")}
              </TabsTrigger>
              <TabsTrigger value="log">
                <History /> {L("স্টকের ইতিহাস", "Stock history")}
              </TabsTrigger>
            </TabsList>
            <TabsContent value="adjust" className="pt-3">
              <AdjustForm target={target} unit={B(UNITS[target.item.product.unit])} onDone={onClose} />
            </TabsContent>
            <TabsContent value="log" className="pt-3">
              <StockLog variantId={target.v.id} unit={B(UNITS[target.item.product.unit])} />
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}

function AdjustForm({ target, unit, onDone }: { target: StockTarget; unit: string; onDone: () => void }) {
  const { L, B, num } = useI18n();
  const [mode, setMode] = useState<Mode>("add");
  const [amount, setAmount] = useState(0);
  const [reason, setReason] = useState(0);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const current = target.v.stock;

  const delta = mode === "add" ? amount : mode === "remove" ? -amount : round2(amount - current);
  const after = round2(current + delta);

  function pickMode(m: Mode) {
    setMode(m);
    setReason(0);
    setAmount(m === "set" ? current : 0);
  }

  async function save() {
    if (!delta) return toast.error(L("কত যোগ বা কমাবেন লিখুন", "Enter how much to add or remove"));
    setBusy(true);
    try {
      const why = REASONS[mode][reason][0];
      await adjustStockBy(target.v.id, delta, note.trim() ? `${why} — ${note.trim()}` : why);
      toast.success(L(`স্টক এখন ${num(after)} ${unit}`, `Stock is now ${num(after)} ${unit}`));
      onDone();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const modeBtn = (m: Mode, Icon: typeof Plus, label: string, tone: string) => (
    <button
      type="button"
      onClick={() => pickMode(m)}
      className={cn("flex h-12 items-center justify-center gap-1.5 rounded-xl border-2 text-sm font-bold transition", mode === m ? tone : "bg-white hover:bg-muted")}
    >
      <Icon className="size-5" /> {label}
    </button>
  );

  return (
    <form className="grid gap-4" onSubmit={(e) => (e.preventDefault(), void save())}>
      <p className="rounded-xl bg-muted p-3 text-center text-lg">
        {L("এখন স্টকে আছে", "In stock now")}: <b className="tabular">{num(current)} {unit}</b>
      </p>
      <div className="grid grid-cols-3 gap-2">
        {modeBtn("add", Plus, L("যোগ করুন", "Add"), "border-emerald-500 bg-emerald-600 text-white")}
        {modeBtn("remove", Minus, L("কমান", "Remove"), "border-red-500 bg-red-600 text-white")}
        {modeBtn("set", Equal, L("গুনে বসান", "Set count"), "border-blue-500 bg-blue-600 text-white")}
      </div>
      <Field label={mode === "set" ? L("আসলে কত আছে? (গুনে লিখুন)", "Actual count") : mode === "add" ? L("কতটা যোগ হবে?", "How much to add?") : L("কতটা কমবে?", "How much to remove?")}>
        <NumInput autoFocus value={amount} allowEmpty={mode !== "set"} onValueChange={(n) => setAmount(Math.max(n, 0))} suffix={unit} className="[&_input]:h-14 [&_input]:text-2xl" />
      </Field>
      <p className="tabular flex items-center justify-center gap-2 rounded-xl border p-3 text-lg">
        <span>{num(current)}</span>
        <span className={cn("font-bold", delta > 0 ? "text-emerald-700" : delta < 0 ? "text-red-600" : "text-muted-foreground")}>
          {delta >= 0 ? "+" : "−"}
          {num(Math.abs(delta))}
        </span>
        <span>=</span>
        <b className={after < 0 ? "text-red-600" : undefined}>
          {num(after)} {unit}
        </b>
      </p>
      <Field label={L("কারণ", "Reason")}>
        <Chips value={String(reason)} onChange={(v) => setReason(Number(v))} options={REASONS[mode].map((r, i) => ({ id: String(i), label: B(r) }))} />
      </Field>
      <Field label={L("নোট (ইচ্ছা হলে)", "Note (optional)")}>
        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={L("যেমন: গোডাউন থেকে আনা", "e.g. brought from godown")} />
      </Field>
      <Button type="submit" size="lg" className="w-full" disabled={busy || !delta}>
        <ClipboardCheck /> {L("সেভ করুন", "Save")}
      </Button>
    </form>
  );
}

function StockLog({ variantId, unit }: { variantId: string; unit: string }) {
  const { L, B, num, date, time } = useI18n();
  const rows = useLiveQuery(async () => {
    const moves = await db.stock_moves.where("variant_id").equals(variantId).toArray();
    moves.sort((a, b) => a.created_at - b.created_at);
    const ids = (t: StockMove["type"][]) => [...new Set(moves.filter((m) => t.includes(m.type) && m.ref_id).map((m) => m.ref_id!))];
    const [sales, purchases, returns, users] = await Promise.all([
      db.sales.bulkGet(ids(["sale", "void"])),
      db.purchases.bulkGet(ids(["purchase", "void"])),
      db.sale_returns.bulkGet(ids(["return", "void"])),
      db.local_users.toArray(),
    ]);
    const ref = new Map<string, { no: string; by?: string; party?: string }>();
    for (const s of sales) if (s) ref.set(s.id, { no: s.invoice_no, by: s.by_name, party: s.customer_name });
    for (const p of purchases) if (p) ref.set(p.id, { no: p.purchase_no, party: p.supplier_name });
    for (const r of returns) if (r) ref.set(r.id, { no: r.return_no, party: r.customer_name });
    const userName = new Map(users.map((u) => [u.id, u.name]));
    let bal = 0;
    const out = moves.map((m) => {
      bal = round2(bal + m.qty);
      const r = m.ref_id ? ref.get(m.ref_id) : undefined;
      return { m, balance: bal, refNo: r?.no, party: r?.party, who: m.by_name ?? r?.by ?? (m.by ? userName.get(m.by) : undefined) };
    });
    return out.reverse();
  }, [variantId]);

  if (!rows) return null;
  if (!rows.length) return <p className="py-8 text-center text-muted-foreground">{L("এখনো কোনো স্টক এন্ট্রি নেই", "No stock entries yet")}</p>;

  const totalIn = rows.reduce((s, r) => s + Math.max(r.m.qty, 0), 0);
  const totalOut = rows.reduce((s, r) => s + Math.max(-r.m.qty, 0), 0);

  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-2 gap-2 text-center">
        <p className="rounded-xl bg-emerald-50 p-2">
          <span className="block text-xs text-emerald-800">{L("মোট ঢুকেছে", "Total in")}</span>
          <b className="tabular text-emerald-700">
            +{num(totalIn)} {unit}
          </b>
        </p>
        <p className="rounded-xl bg-red-50 p-2">
          <span className="block text-xs text-red-800">{L("মোট বের হয়েছে", "Total out")}</span>
          <b className="tabular text-red-600">
            −{num(totalOut)} {unit}
          </b>
        </p>
      </div>
      <ol className="grid gap-2">
        {rows.map(({ m, balance, refNo, party, who }) => {
          const isIn = m.qty > 0;
          return (
            <li key={m.id} className="flex items-start gap-3 rounded-xl border bg-white p-3">
              <span className={cn("grid size-9 shrink-0 place-items-center rounded-full", isIn ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600")}>
                {isIn ? <ArrowDownLeft className="size-5" /> : <ArrowUpRight className="size-5" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">
                  {B(MOVE_LABEL[m.type])}
                  {refNo && <span className="font-normal text-muted-foreground"> · {refNo}</span>}
                </p>
                {(party || m.note) && <p className="truncate text-sm text-muted-foreground">{[party, m.note].filter(Boolean).join(" · ")}</p>}
                <p className="tabular text-xs text-muted-foreground">
                  {date(m.date)} · {time(m.created_at)} · {who ? `${L("করেছেন", "by")} ${who}` : L("ইউজার অজানা", "user unknown")}
                </p>
              </div>
              <div className="text-right">
                <p className={cn("tabular font-bold", isIn ? "text-emerald-700" : "text-red-600")}>
                  {isIn ? "+" : "−"}
                  {num(Math.abs(m.qty))}
                </p>
                <p className="tabular text-xs text-muted-foreground">
                  {L("পরে", "after")} {num(balance)}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
