import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { toast } from "sonner";
import { Pencil, Plus, Save, Trash2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ConfirmAction, EmptyState, Field, PageHeader } from "@/components/common";
import { DateRangeBar, useDateRange } from "@/components/DateRange";
import { IconTile, NamedIcon } from "@/components/Icon";
import { NumInput } from "@/components/NumInput";
import { methodLabel, PayMethodPicker } from "@/components/PayMethodPicker";
import { useAuth } from "@/lib/auth";
import { CATEGORY_COLORS, EXPENSE_ICONS } from "@/lib/constants";
import { db } from "@/lib/db";
import { todayISO } from "@/lib/format";
import { useExpenseCategories } from "@/lib/hooks";
import { useI18n } from "@/lib/i18n";
import { Pager, usePaged } from "@/components/Pager";
import { addExpense, deleteExpense, newId, saveSettings } from "@/lib/ops";
import type { CustomExpenseCategory, PayMethod } from "@/lib/types";
import { cn } from "@/lib/utils";

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
  const [editCat, setEditCat] = useState<Partial<CustomExpenseCategory> | null>(null);
  const allCats = useExpenseCategories();
  const cats = allCats.filter((c) => !c.deleted);

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
  const catInfo = (id: string) => allCats.find((c) => c.id === id) ?? allCats[allCats.length - 1];

  /** নতুন খাত সেভ / নাম বদল / মুছে ফেলা (শুধু মালিক; সেটিংসের সাথে সব ডিভাইসে যায়) */
  async function saveCat(remove = false) {
    if (!editCat) return;
    const name = editCat.name?.trim();
    if (!remove && !name) return toast.error(L("খাতের নাম লিখুন", "Enter a name"));
    if (!remove && allCats.some((c) => !c.deleted && c.id !== editCat.id && (c.label[0] === name || c.label[1].toLowerCase() === name!.toLowerCase())))
      return toast.error(L("এই নামে খাত আগেই আছে", "This category already exists"));
    const cur = (await db.settings.get("shop"))?.expense_categories ?? [];
    const item: CustomExpenseCategory = {
      id: editCat.id ?? `x-${newId()}`,
      name: name ?? "",
      icon: editCat.icon ?? "Receipt",
      color: editCat.color ?? CATEGORY_COLORS[0],
      ...(remove ? { deleted: 1 as const } : {}),
    };
    const list = cur.some((c) => c.id === item.id) ? cur.map((c) => (c.id === item.id ? { ...c, ...item } : c)) : [...cur, item];
    await saveSettings({ expense_categories: list });
    toast.success(remove ? L("খাত মুছে ফেলা হয়েছে", "Category removed") : L("খাত সেভ হয়েছে", "Category saved"));
    setEditCat(null);
  }

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

      <div className="mb-6 grid grid-cols-2 gap-2.5 sm:grid-cols-[repeat(auto-fill,minmax(11rem,1fr))]">
        {cats.map((c) => (
          <div key={c.id} className="relative">
            <button
              type="button"
              onClick={() => open(c.id)}
              className="flex h-full w-full items-center gap-2.5 rounded-2xl border-2 bg-white p-2.5 text-left font-semibold shadow-xs transition hover:-translate-y-0.5 hover:shadow-md"
              style={{ borderColor: `${c.color}33` }}
            >
              <IconTile name={c.icon} color={c.color} size="md" />
              <span className={cn("min-w-0 leading-tight", c.custom && isOwner && "pr-6")}>{B(c.label)}</span>
            </button>
            {c.custom && isOwner && (
              <button
                type="button"
                onClick={() => setEditCat({ id: c.id, name: c.label[0], icon: c.icon, color: c.color })}
                className="absolute top-1.5 right-1.5 grid size-7 place-items-center rounded-full text-muted-foreground hover:bg-muted"
                aria-label={L("খাত এডিট", "Edit category")}
                title={L("খাত এডিট", "Edit category")}
              >
                <Pencil className="size-3.5" />
              </button>
            )}
          </div>
        ))}
        {isOwner && (
          <button
            type="button"
            onClick={() => setEditCat({ icon: "Receipt", color: CATEGORY_COLORS[0] })}
            className="flex items-center gap-2.5 rounded-2xl border-2 border-dashed bg-white/60 p-2.5 text-left font-semibold text-muted-foreground transition hover:border-primary hover:text-primary"
          >
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-muted">
              <Plus className="size-6" />
            </span>
            <span className="leading-tight">{L("নতুন খাত", "New category")}</span>
          </button>
        )}
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
      <Dialog open={!!editCat} onOpenChange={(v) => !v && setEditCat(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto">
          {editCat && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3 text-xl">
                  <IconTile name={editCat.icon} color={editCat.color} size="sm" />
                  {editCat.id ? L("খাত এডিট", "Edit category") : L("নতুন খরচের খাত", "New expense category")}
                </DialogTitle>
              </DialogHeader>
              <div className="grid gap-4">
                <Field label={L("খাতের নাম", "Name")}>
                  <Input autoFocus value={editCat.name ?? ""} onChange={(e) => setEditCat({ ...editCat, name: e.target.value })} placeholder={L("যেমন: পানির বিল, দোকান পরিষ্কার", "e.g. Water bill, Cleaning")} />
                </Field>
                <Field label={L("আইকন", "Icon")}>
                  <div className="grid grid-cols-8 gap-1.5">
                    {EXPENSE_ICONS.map((ic) => (
                      <button
                        key={ic}
                        type="button"
                        onClick={() => setEditCat({ ...editCat, icon: ic })}
                        className={cn("grid aspect-square place-items-center rounded-lg border-2", editCat.icon === ic ? "border-primary bg-primary/10" : "bg-white")}
                      >
                        <NamedIcon name={ic} className="size-5" style={{ color: editCat.color }} />
                      </button>
                    ))}
                  </div>
                </Field>
                <Field label={L("রং", "Color")}>
                  <div className="flex flex-wrap gap-2">
                    {CATEGORY_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setEditCat({ ...editCat, color: c })}
                        className={cn("size-9 rounded-full ring-offset-2", editCat.color === c && "ring-2 ring-foreground")}
                        style={{ backgroundColor: c }}
                        aria-label={c}
                      />
                    ))}
                  </div>
                </Field>
              </div>
              <DialogFooter className="gap-2">
                {editCat.id && (
                  <ConfirmAction
                    destructive
                    title={L("এই খাত মুছবেন?", "Remove this category?")}
                    description={L("আগের খরচগুলো ঠিক থাকবে, শুধু নতুন খরচের তালিকা থেকে সরে যাবে।", "Past expenses stay; it just won't be offered for new ones.")}
                    confirmText={L("হ্যাঁ, মুছুন", "Remove")}
                    onConfirm={async () => void (await saveCat(true))}
                    trigger={
                      <Button variant="outline" size="lg" className="text-red-600">
                        <Trash2 /> {L("মুছুন", "Remove")}
                      </Button>
                    }
                  />
                )}
                <Button size="lg" className="flex-1" onClick={() => void saveCat()}>
                  <Save /> {L("সেভ করুন", "Save")}
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
