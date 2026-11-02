import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { toast } from "sonner";
import { Save, Trash2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ConfirmAction, EmptyState, Field, PageHeader } from "@/components/common";
import { DateRangeBar, useDateRange } from "@/components/DateRange";
import { IconTile } from "@/components/Icon";
import { NumInput } from "@/components/NumInput";
import { methodLabel, PayMethodPicker } from "@/components/PayMethodPicker";
import { useAuth } from "@/lib/auth";
import { EXPENSE_CATEGORIES } from "@/lib/constants";
import { db } from "@/lib/db";
import { todayISO } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { Pager, usePaged } from "@/components/Pager";
import { addExpense, deleteExpense } from "@/lib/ops";
import type { PayMethod } from "@/lib/types";

export default function Expenses() {
  const { L, B, money, date, num } = useI18n();
  const { isOwner } = useAuth();
  const [range, setRange] = useDateRange("month");
  const [cat, setCat] = useState<string | null>(null);
  const [amount, setAmount] = useState(0);
  const [method, setMethod] = useState<PayMethod>("cash");
  const [note, setNote] = useState("");
  const [day, setDay] = useState(todayISO());
  const [busy, setBusy] = useState(false);

  const expenses = useLiveQuery(async () => {
    const list = await db.expenses.where("date").between(range.from, range.to, true, true).toArray();
    return list.filter((e) => !e.deleted).sort((a, b) => b.date.localeCompare(a.date) || b.created_at - a.created_at);
  }, [range.from, range.to]);

  const byCat = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of expenses ?? []) m.set(e.category, (m.get(e.category) ?? 0) + e.amount);
    return m;
  }, [expenses]);
  const paged = usePaged(expenses, [range.from, range.to]);
  const total = (expenses ?? []).reduce((s, e) => s + e.amount, 0);
  const catInfo = (id: string) => EXPENSE_CATEGORIES.find((c) => c.id === id) ?? EXPENSE_CATEGORIES[EXPENSE_CATEGORIES.length - 1];

  function open(id: string) {
    setCat(id);
    setAmount(0);
    setMethod("cash");
    setNote("");
    setDay(todayISO());
  }

  async function save() {
    if (!cat) return;
    if (amount <= 0) return toast.error(L("টাকার পরিমাণ লিখুন", "Enter amount"));
    setBusy(true);
    try {
      await addExpense({ category: cat, amount, method, note: note || undefined, date: day });
      toast.success(L("খরচ লেখা হয়েছে", "Expense saved"));
      setCat(null);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader icon={Wallet} color="#e11d48" title={L("খরচ", "Expenses")} subtitle={L("দোকানের খরচ লিখুন — নিচের যেকোনো একটায় চাপ দিন", "Tap a category below to add an expense")} />

      <div className="mb-6 grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-9">
        {EXPENSE_CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => open(c.id)}
            className="flex flex-col items-center gap-2 rounded-2xl border-2 bg-white p-3 text-center text-sm font-semibold shadow-xs transition hover:-translate-y-0.5 hover:shadow-md"
            style={{ borderColor: `${c.color}33` }}
          >
            <IconTile name={c.icon} color={c.color} size="lg" />
            <span className="leading-tight">{B(c.label)}</span>
          </button>
        ))}
      </div>

      <div className="mb-4 grid gap-3">
        <DateRangeBar value={range} onChange={setRange} />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl bg-rose-600 p-4 text-white">
        <span className="text-lg font-semibold">{L("মোট খরচ", "Total expenses")}</span>
        <span className="tabular ml-auto text-3xl font-bold">{money(total)}</span>
      </div>

      {byCat.size > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {[...byCat].map(([id, amt]) => (
            <span key={id} className="rounded-full border bg-white px-3 py-1 text-sm">
              {B(catInfo(id).label)}: <b className="tabular">{money(amt)}</b>
            </span>
          ))}
        </div>
      )}

      {expenses && expenses.length === 0 ? (
        <EmptyState icon={Wallet} title={L("এই সময়ে কোনো খরচ নেই", "No expenses in this period")} />
      ) : (
        <div className="grid gap-2">
          {paged.rows.map((e) => {
            const c = catInfo(e.category);
            return (
              <div key={e.id} className="flex items-center gap-3 rounded-2xl border bg-white p-3 shadow-xs">
                <IconTile name={c.icon} color={c.color} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{B(c.label)}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {date(e.date)} · {methodLabel(e.method, B)}
                    {e.note && ` · ${e.note}`}
                  </p>
                </div>
                <span className="tabular font-bold text-rose-600">{money(e.amount)}</span>
                {isOwner && (
                  <ConfirmAction
                    destructive
                    title={L("এই খরচ মুছবেন?", "Delete this expense?")}
                    description={`${B(c.label)} — ${money(e.amount)}`}
                    onConfirm={async () => {
                      await deleteExpense(e.id);
                      toast.success(L("মুছে ফেলা হয়েছে", "Deleted"));
                    }}
                    trigger={
                      <Button variant="ghost" size="icon-sm" className="text-red-600" aria-label="delete">
                        <Trash2 />
                      </Button>
                    }
                  />
                )}
              </div>
            );
          })}
          <p className="text-center text-sm text-muted-foreground">
            {num(expenses?.length ?? 0)} {L("টি খরচ", "expenses")}
          </p>
        </div>
      )}

      <Dialog open={!!cat} onOpenChange={(v) => !v && setCat(null)}>
        <DialogContent>
          {cat && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3 text-xl">
                  <IconTile name={catInfo(cat).icon} color={catInfo(cat).color} size="sm" />
                  {B(catInfo(cat).label)}
                </DialogTitle>
              </DialogHeader>
              <div className="grid gap-4">
                <Field label={L("কত টাকা?", "How much?")}>
                  <NumInput autoFocus value={amount} onValueChange={setAmount} prefix="৳" className="[&_input]:h-14 [&_input]:text-2xl" />
                </Field>
                <Field label={L("কীভাবে দিলেন?", "Paid by")}>
                  <PayMethodPicker value={method} onChange={setMethod} compact />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label={L("তারিখ", "Date")}>
                    <Input type="date" value={day} max={todayISO()} onChange={(e) => setDay(e.target.value)} />
                  </Field>
                  <Field label={L("নোট", "Note")}>
                    <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={L("কিসের জন্য", "What for")} />
                  </Field>
                </div>
              </div>
              <DialogFooter>
                <Button size="lg" className="w-full bg-rose-600 hover:bg-rose-700" disabled={busy} onClick={() => void save()}>
                  <Save /> {L("খরচ সেভ করুন", "Save expense")}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
      <Pager {...paged} />
    </div>
  );
}
