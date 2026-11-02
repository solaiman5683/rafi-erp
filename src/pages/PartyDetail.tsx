import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { toast } from "sonner";
import { BookOpen, Factory, HandCoins, MapPin, Pencil, Phone, Printer, ShoppingCart, Trash2, Truck, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmAction, DueText, EmptyState, PageHeader } from "@/components/common";
import { CustomerFormDialog, SupplierFormDialog } from "@/components/PartyForms";
import { PaymentDialog } from "@/components/PaymentDialog";
import { useAuth } from "@/lib/auth";
import { CUSTOMER_TYPES } from "@/lib/constants";
import { db } from "@/lib/db";
import { useI18n } from "@/lib/i18n";
import { ledgerLabel, withRunning } from "@/lib/labels";
import { deleteParty, deletePayment } from "@/lib/ops";
import type { Customer, PartyType, Supplier } from "@/lib/types";

export default function PartyDetail({ type }: { type: PartyType }) {
  const { id } = useParams();
  const nav = useNavigate();
  const { L, B, money, num, date } = useI18n();
  const { isOwner } = useAuth();
  const [editing, setEditing] = useState(false);
  const [paying, setPaying] = useState(false);
  const isCust = type === "customer";

  const party = useLiveQuery(async () => (isCust ? db.customers.get(id!) : db.suppliers.get(id!)), [id, isCust]) as Customer | Supplier | undefined | null;
  const entries = useLiveQuery(() => db.ledger.where("party_id").equals(id!).toArray(), [id]) ?? [];
  const balance = useLiveQuery(async () => (await db.balances.get(id!))?.amount ?? 0, [id]) ?? 0;

  const payments = useLiveQuery(() => db.payments.where("party_id").equals(id!).toArray(), [id]) ?? [];
  const rows = useMemo(() => withRunning(entries).reverse(), [entries]);
  const totals = useMemo(() => entries.reduce((t, e) => ({ bill: t.bill + e.bill, paid: t.paid + e.paid }), { bill: 0, paid: 0 }), [entries]);

  if (party === undefined) return null;
  if (!party) return <p className="p-10 text-center">{L("পাওয়া যায়নি", "Not found")}</p>;

  const c = isCust ? (party as Customer) : null;
  const s = !isCust ? (party as Supplier) : null;

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        back={isCust ? "/customers" : "/suppliers"}
        icon={isCust ? UserRound : Factory}
        color={isCust ? "#7c3aed" : "#0891b2"}
        title={party.name}
        subtitle={c ? B(CUSTOMER_TYPES[c.type]) : s?.company}
        actions={
          <>
            <Button variant="outline" size="icon" onClick={() => setEditing(true)} aria-label="edit">
              <Pencil />
            </Button>
            <Button variant="outline" onClick={() => window.open(`/print/ledger/${type}/${party.id}?auto=1`, "_blank")}>
              <Printer /> {L("খাতা প্রিন্ট", "Print ledger")}
            </Button>
          </>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[300px_1fr]">
        <div className="grid content-start gap-4">
          <Card className={balance > 0 ? "border-red-200 bg-red-50/50" : "bg-emerald-50/50"}>
            <CardContent className="grid gap-3 text-center">
              <p className="text-muted-foreground">{isCust ? L("এখন বাকি আছে", "Current due") : L("এখন দেনা আছে", "Current payable")}</p>
              <DueText amount={balance} kind={type} className="text-3xl" />
              <Button size="lg" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => setPaying(true)}>
                <HandCoins /> {isCust ? L("টাকা জমা নিন", "Receive payment") : L("টাকা দিন", "Pay")}
              </Button>
              {isCust ? (
                <Button size="lg" variant="outline" onClick={() => nav(`/sell?customer=${party.id}`)}>
                  <ShoppingCart /> {L("এই কাস্টমারকে বিক্রি", "Sell to this customer")}
                </Button>
              ) : (
                <Button size="lg" variant="outline" onClick={() => nav("/purchase")}>
                  <Truck /> {L("মাল কিনুন", "New purchase")}
                </Button>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="grid gap-2 text-base">
              {party.phone && (
                <a href={`tel:${party.phone}`} className="flex items-center gap-2 font-semibold text-primary">
                  <Phone className="size-4" /> {party.phone}
                </a>
              )}
              {party.address && (
                <p className="flex items-center gap-2">
                  <MapPin className="size-4 text-muted-foreground" /> {party.address}
                </p>
              )}
              {c && c.disc_mode !== "none" && (
                <p>
                  {L("নিয়মিত ছাড়", "Regular discount")}: <b>{c.disc_mode === "percent" ? `${num(c.disc_value)}%` : money(c.disc_value)}</b>
                </p>
              )}
              {c && (
                <p>
                  {L("দাম", "Price")}: <b>{c.price_tier === "wholesale" ? L("পাইকারি", "Wholesale") : L("খুচরা", "Retail")}</b>
                </p>
              )}
              {party.note && <p className="text-muted-foreground">{party.note}</p>}
              {isOwner && (
                <ConfirmAction
                  destructive
                  title={L("মুছে ফেলবেন?", "Delete?")}
                  description={L("খাতার হিসাব থেকে যাবে, শুধু তালিকা থেকে সরে যাবে।", "Ledger history stays; only hidden from the list.")}
                  onConfirm={async () => {
                    await deleteParty(type, party.id);
                    toast.success(L("মুছে ফেলা হয়েছে", "Deleted"));
                    nav(isCust ? "/customers" : "/suppliers");
                  }}
                  trigger={
                    <Button variant="ghost" className="mt-2 justify-start text-red-600">
                      <Trash2 /> {L("মুছে ফেলুন", "Delete")}
                    </Button>
                  }
                />
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="size-5 text-violet-600" /> {L("হিসাবের খাতা", "Ledger")}
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto px-0">
            {rows.length === 0 ? (
              <div className="px-4">
                <EmptyState icon={BookOpen} title={L("এখনো কোনো লেনদেন নেই", "No transactions yet")} />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">{L("তারিখ", "Date")}</TableHead>
                    <TableHead>{L("বিবরণ", "Details")}</TableHead>
                    <TableHead className="text-right">{isCust ? L("বিল", "Bill") : L("কেনা", "Bill")}</TableHead>
                    <TableHead className="text-right">{isCust ? L("জমা", "Paid") : L("দিয়েছি", "Paid")}</TableHead>
                    <TableHead className="pr-4 text-right">{L("ব্যালেন্স", "Balance")}</TableHead>
                    {isOwner && <TableHead className="w-12 pr-3" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map(({ e, balance: b }) => (
                    <TableRow
                      key={e.id}
                      className={e.type === "sale" ? "cursor-pointer" : undefined}
                      onClick={() => e.type === "sale" && e.ref_id && nav(`/sales/${e.ref_id}`)}
                    >
                      <TableCell className="pl-4 whitespace-nowrap">{date(e.date)}</TableCell>
                      <TableCell>
                        {ledgerLabel(e, L)}
                        {e.note && e.type !== "opening" && <span className="block text-xs text-muted-foreground">{e.note}</span>}
                      </TableCell>
                      <TableCell className="tabular text-right">{e.bill ? money(e.bill) : ""}</TableCell>
                      <TableCell className="tabular text-right text-emerald-700">{e.paid ? money(e.paid) : ""}</TableCell>
                      <TableCell className={`tabular pr-4 text-right font-semibold ${b > 0 ? "text-red-600" : "text-emerald-700"}`}>{money(b)}</TableCell>
                      {isOwner && (
                        <TableCell className="pr-3 text-right">
                          {e.type === "payment" && payments.some((p) => p.id === e.ref_id && !p.deleted) && (
                            <ConfirmAction
                              destructive
                              title={L(`${money(e.paid)} এর এন্ট্রি মুছবেন?`, `Delete this ${money(e.paid)} entry?`)}
                              description={
                                isCust
                                  ? L("এই জমা বাতিল হবে: কাস্টমারের বাকি আবার বাড়বে, ক্যাশ থেকে টাকা কমবে।", "This payment is cancelled: the customer's due goes back up and cash goes down.")
                                  : L("এই পরিশোধ বাতিল হবে: সাপ্লায়ারের দেনা আবার বাড়বে, ক্যাশে টাকা ফিরবে।", "This payment is cancelled: the payable goes back up and cash comes back.")
                              }
                              confirmText={L("হ্যাঁ, মুছে ফেলুন", "Yes, delete")}
                              onConfirm={async () => {
                                try {
                                  await deletePayment(e.ref_id!);
                                  toast.success(L("এন্ট্রি মুছে ফেলা হয়েছে", "Entry deleted"));
                                } catch (err) {
                                  toast.error((err as Error).message);
                                }
                              }}
                              trigger={
                                <Button variant="ghost" size="icon-sm" className="text-red-600" aria-label={L("মুছুন", "Delete")} title={L("এই এন্ট্রি মুছুন", "Delete this entry")}>
                                  <Trash2 />
                                </Button>
                              }
                            />
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/50 font-bold">
                    <TableCell className="pl-4" colSpan={2}>
                      {L("মোট", "Total")}
                    </TableCell>
                    <TableCell className="tabular text-right">{money(totals.bill)}</TableCell>
                    <TableCell className="tabular text-right">{money(totals.paid)}</TableCell>
                    <TableCell className="tabular pr-4 text-right">{money(balance)}</TableCell>
                    {isOwner && <TableCell />}
                  </TableRow>
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {isCust ? (
        <CustomerFormDialog open={editing} onOpenChange={setEditing} initial={c} />
      ) : (
        <SupplierFormDialog open={editing} onOpenChange={setEditing} initial={s} />
      )}
      <PaymentDialog open={paying} onOpenChange={setPaying} partyType={type} party={party} />
    </div>
  );
}
