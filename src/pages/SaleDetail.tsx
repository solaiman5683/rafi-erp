import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { toast } from "sonner";
import { Printer, ReceiptText, Trash2, TriangleAlert, Undo2, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmAction, Field, PageHeader } from "@/components/common";
import { NumInput } from "@/components/NumInput";
import { methodLabel, PayMethodPicker } from "@/components/PayMethodPicker";
import { useAuth } from "@/lib/auth";
import { UNITS, WALK_IN } from "@/lib/constants";
import { db } from "@/lib/db";
import { round2 } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { createReturn, deleteSale } from "@/lib/ops";
import type { PayMethod, Sale } from "@/lib/types";

export default function SaleDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { L, B, money, num, date, time } = useI18n();
  const { isOwner } = useAuth();
  const [returning, setReturning] = useState(false);

  const sale = useLiveQuery(() => db.sales.get(id!), [id]);
  const returns = (useLiveQuery(() => db.sale_returns.where("sale_id").equals(id!).toArray(), [id]) ?? []).filter((r) => !r.deleted);

  if (sale === undefined) return null;
  if (!sale) return <p className="p-10 text-center">{L("মেমো পাওয়া যায়নি", "Memo not found")}</p>;

  const profit = sale.total - sale.cost - returns.reduce((s, r) => s + (r.total - r.cost), 0);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        back="/sales"
        icon={ReceiptText}
        color="#0d9488"
        title={`${L("মেমো", "Memo")} ${sale.invoice_no}`}
        subtitle={`${date(sale.date)} · ${time(sale.created_at)}${sale.by_name ? ` · ${sale.by_name}` : ""}`}
        actions={
          !sale.deleted && (
            <>
              {isOwner && (
                <ConfirmAction
                  destructive
                  title={L(`মেমো ${sale.invoice_no} মুছে ফেলবেন?`, `Delete memo ${sale.invoice_no}?`)}
                  description={L(
                    "মাল স্টকে ফেরত যাবে, কাস্টমারের বাকি ও ক্যাশের হিসাব আগের মতো হয়ে যাবে। এই মেমোর ফেরতগুলোও মুছে যাবে।",
                    "Items go back to stock, and the customer's due and cash are reversed. Returns on this memo are removed too.",
                  )}
                  confirmText={L("হ্যাঁ, মুছে ফেলুন", "Yes, delete")}
                  onConfirm={async () => {
                    try {
                      await deleteSale(sale.id);
                      toast.success(L(`মেমো ${sale.invoice_no} মুছে ফেলা হয়েছে`, `Memo ${sale.invoice_no} deleted`));
                      nav("/sales");
                    } catch (e) {
                      toast.error((e as Error).message);
                    }
                  }}
                  trigger={
                    <Button variant="destructive" size="icon" aria-label={L("মুছুন", "Delete")} title={L("মেমো মুছুন", "Delete memo")}>
                      <Trash2 />
                    </Button>
                  }
                />
              )}
              <Button variant="outline" onClick={() => setReturning(true)}>
                <Undo2 /> {L("মাল ফেরত", "Return")}
              </Button>
              <Button onClick={() => window.open(`/print/sale/${sale.id}?auto=1`, "_blank")}>
                <Printer /> {L("প্রিন্ট", "Print")}
              </Button>
            </>
          )
        }
      />

      {!!sale.deleted && (
        <p className="mb-4 flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 font-semibold text-red-700">
          <TriangleAlert className="size-5 shrink-0" /> {L("এই মেমো মুছে ফেলা হয়েছে — হিসাবে আর ধরা হয় না।", "This memo was deleted and no longer counts.")}
        </p>
      )}

      <div className="grid gap-4">
        <Card>
          <CardContent className="flex flex-wrap items-center gap-3">
            <span className="grid size-11 place-items-center rounded-full bg-violet-100 text-violet-700">
              <UserRound className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-bold">{sale.customer_name || B(WALK_IN)}</p>
              {sale.customer_phone && <p className="text-sm text-muted-foreground">{sale.customer_phone}</p>}
            </div>
            {sale.customer_id && (
              <Button variant="outline" onClick={() => nav(`/customers/${sale.customer_id}`)}>
                {L("কাস্টমারের খাতা", "Customer ledger")}
              </Button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="overflow-x-auto px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">{L("পণ্য", "Item")}</TableHead>
                  <TableHead className="text-right">{L("পরিমাণ", "Qty")}</TableHead>
                  <TableHead className="text-right">{L("দাম", "Price")}</TableHead>
                  <TableHead className="text-right">{L("ছাড়", "Disc")}</TableHead>
                  <TableHead className="pr-4 text-right">{L("মোট", "Total")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sale.items.map((it, i) => (
                  <TableRow key={i}>
                    <TableCell className="pl-4">
                      <p className="font-semibold">{it.name}</p>
                      {it.variant_name && <p className="text-sm text-muted-foreground">{it.variant_name}</p>}
                    </TableCell>
                    <TableCell className="tabular text-right">
                      {num(it.qty)} {B(UNITS[it.unit])}
                    </TableCell>
                    <TableCell className="tabular text-right">{money(it.list_price)}</TableCell>
                    <TableCell className="tabular text-right text-amber-700">{it.disc_amount ? money(it.disc_amount) : "—"}</TableCell>
                    <TableCell className="tabular pr-4 text-right font-semibold">{money(it.total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="ml-auto grid max-w-sm gap-1.5 px-4 pt-4 text-base">
              <Row label={L("মোট", "Subtotal")} value={money(sale.subtotal)} />
              {sale.discount !== 0 && <Row label={L("বিলে ছাড়", "Bill discount")} value={`- ${money(sale.discount)}`} />}
              <Row label={L("সর্বমোট", "Total")} value={money(sale.total)} bold />
              <Row label={`${L("পেয়েছি", "Paid")} (${methodLabel(sale.method, B)})`} value={money(sale.paid)} />
              {sale.due > 0 && <Row label={L("বাকি", "Due")} value={money(sale.due)} className="text-red-600" bold />}
              {isOwner && <Row label={L("লাভ", "Profit")} value={money(profit)} className="text-emerald-700" />}
            </div>
            {sale.note && <p className="px-4 pt-3 text-sm text-muted-foreground">{L("নোট", "Note")}: {sale.note}</p>}
          </CardContent>
        </Card>

        {returns.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Undo2 className="size-5 text-amber-600" /> {L("ফেরত", "Returns")}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              {returns.map((r) => (
                <div key={r.id} className="rounded-xl border bg-amber-50/50 p-3">
                  <p className="font-semibold">
                    {r.return_no} · {date(r.date)}
                  </p>
                  <p className="text-sm">
                    {r.items.map((it) => `${it.name}${it.variant_name ? ` ${it.variant_name}` : ""} × ${num(it.qty)}`).join(", ")}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {L("ফেরত মূল্য", "Value")} {money(r.total)} · {L("টাকা ফেরত", "Refunded")} {money(r.refund)}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      <ReturnDialog open={returning} onOpenChange={setReturning} sale={sale} />
    </div>
  );
}

function Row({ label, value, bold, className }: { label: string; value: string; bold?: boolean; className?: string }) {
  return (
    <div className={`flex justify-between gap-4 ${bold ? "font-bold" : ""} ${className ?? ""}`}>
      <span>{label}</span>
      <span className="tabular">{value}</span>
    </div>
  );
}

function ReturnDialog({ open, onOpenChange, sale }: { open: boolean; onOpenChange: (v: boolean) => void; sale: Sale }) {
  const { L, B, money, num } = useI18n();
  const [qty, setQty] = useState<Record<string, number>>({});
  const [refund, setRefund] = useState<number | null>(null);
  const [method, setMethod] = useState<PayMethod>("cash");
  const [busy, setBusy] = useState(false);

  const already = useLiveQuery(async () => {
    const out: Record<string, number> = {};
    for (const r of await db.sale_returns.where("sale_id").equals(sale.id).toArray())
      for (const it of r.items) out[it.variant_id] = (out[it.variant_id] ?? 0) + it.qty;
    return out;
  }, [sale.id]) ?? {};
  const balance = useLiveQuery(async () => (sale.customer_id ? ((await db.balances.get(sale.customer_id))?.amount ?? 0) : 0), [sale.customer_id]) ?? 0;

  useEffect(() => {
    if (open) {
      setQty({});
      setRefund(null);
      setMethod(sale.method);
    }
  }, [open, sale.method]);

  const factor = sale.subtotal > 0 ? sale.total / sale.subtotal : 1;
  const value = useMemo(() => round2(sale.items.reduce((s, it) => s + (qty[it.variant_id] ?? 0) * round2(it.price * factor), 0)), [qty, sale, factor]);
  const defaultRefund = sale.customer_id ? round2(Math.max(0, value - Math.max(balance, 0))) : value;
  const refundNow = sale.customer_id ? Math.min(refund ?? defaultRefund, value) : value;

  async function submit() {
    setBusy(true);
    try {
      await createReturn({
        sale,
        items: Object.entries(qty).map(([variant_id, q]) => ({ variant_id, qty: q })),
        refund: refundNow,
        method,
      });
      toast.success(L("ফেরত নেওয়া হয়েছে, স্টকে যোগ হয়েছে", "Return saved, stock updated"));
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Undo2 className="size-6 text-amber-600" /> {L("মাল ফেরত নিন", "Take return")}
          </DialogTitle>
          <p className="text-muted-foreground">{L("কোন মাল কতটা ফেরত দিল লিখুন", "Enter how much of each item came back")}</p>
        </DialogHeader>
        <div className="grid gap-2">
          {sale.items.map((it) => {
            const max = round2(it.qty - (already[it.variant_id] ?? 0));
            return (
              <div key={it.variant_id} className="flex items-center gap-3 rounded-xl border bg-white p-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">
                    {it.name} {it.variant_name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {L("বিক্রি", "Sold")} {num(it.qty)} {B(UNITS[it.unit])}
                    {already[it.variant_id] ? ` · ${L("আগে ফেরত", "returned")} ${num(already[it.variant_id])}` : ""}
                  </p>
                </div>
                {max > 0 ? (
                  <>
                    <NumInput
                      className="w-24"
                      value={qty[it.variant_id] ?? 0}
                      onValueChange={(n) => setQty((q) => ({ ...q, [it.variant_id]: Math.min(Math.max(n, 0), max) }))}
                    />
                    <Button variant="outline" size="sm" onClick={() => setQty((q) => ({ ...q, [it.variant_id]: max }))}>
                      {L("সব", "All")}
                    </Button>
                  </>
                ) : (
                  <span className="text-sm text-muted-foreground">{L("সব ফেরত হয়েছে", "All returned")}</span>
                )}
              </div>
            );
          })}
        </div>
        {value > 0 && (
          <div className="grid gap-3 rounded-2xl bg-amber-50 p-3">
            <p className="flex justify-between text-lg font-bold">
              <span>{L("ফেরত মালের দাম", "Return value")}</span>
              <span className="tabular">{money(value)}</span>
            </p>
            {sale.customer_id && (
              <Field label={L("এখন হাতে কত টাকা ফেরত দেবেন?", "Cash refund now")} hint={L(`বাকি থেকে কমবে: ${money(value - refundNow)}`, `Reduces due by ${money(value - refundNow)}`)}>
                <NumInput value={refundNow} allowEmpty={false} onValueChange={(n) => setRefund(Math.min(Math.max(n, 0), value))} prefix="৳" />
              </Field>
            )}
            {refundNow > 0 && <PayMethodPicker value={method} onChange={setMethod} compact />}
          </div>
        )}
        <DialogFooter>
          <Button size="lg" className="w-full bg-amber-600 hover:bg-amber-700" disabled={busy || value <= 0} onClick={() => void submit()}>
            <Undo2 /> {L("ফেরত সেভ করুন", "Save return")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
