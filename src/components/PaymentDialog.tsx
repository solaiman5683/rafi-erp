import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { toast } from "sonner";
import { HandCoins, Printer, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { DueText, Field } from "./common";
import { NumInput } from "./NumInput";
import { CustomerPicker, SupplierPicker } from "./PartyPicker";
import { PayMethodPicker } from "./PayMethodPicker";
import { db } from "@/lib/db";
import { useI18n } from "@/lib/i18n";
import { createPayment } from "@/lib/ops";
import type { Customer, PartyType, PayMethod, Supplier } from "@/lib/types";

/** কাস্টমারের কাছ থেকে টাকা জমা নেওয়া, অথবা সাপ্লায়ারকে টাকা দেওয়া */
export function PaymentDialog({
  open,
  onOpenChange,
  partyType,
  party: initialParty,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  partyType: PartyType;
  party?: Customer | Supplier | null;
}) {
  const { L, money } = useI18n();
  const [party, setParty] = useState<Customer | Supplier | null>(initialParty ?? null);
  const [amount, setAmount] = useState(0);
  const [method, setMethod] = useState<PayMethod>("cash");
  const [note, setNote] = useState("");
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setParty(initialParty ?? null);
      setAmount(0);
      setMethod("cash");
      setNote("");
    }
  }, [open, initialParty]);

  const balance = useLiveQuery(async () => (party ? ((await db.balances.get(party.id))?.amount ?? 0) : 0), [party?.id]) ?? 0;
  const isIn = partyType === "customer";

  async function submit(print: boolean) {
    if (!party) return toast.error(isIn ? L("কাস্টমার বাছাই করুন", "Choose a customer") : L("সাপ্লায়ার বাছাই করুন", "Choose a supplier"));
    if (amount <= 0) return toast.error(L("টাকার পরিমাণ লিখুন", "Enter amount"));
    setBusy(true);
    try {
      const pay = await createPayment({ party_type: partyType, party_id: party.id, party_name: party.name, amount, method, note: note || undefined });
      toast.success(isIn ? L(`${money(amount)} জমা নেওয়া হয়েছে`, `${money(amount)} received`) : L(`${money(amount)} দেওয়া হয়েছে`, `${money(amount)} paid`));
      onOpenChange(false);
      if (print) window.open(`/print/receipt/${pay.id}?auto=1`, "_blank");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Dialog open={open && !picking} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <HandCoins className="size-6 text-emerald-600" />
              {isIn ? L("বাকি টাকা জমা নিন", "Receive payment") : L("সাপ্লায়ারকে টাকা দিন", "Pay supplier")}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <Field label={isIn ? L("কার কাছ থেকে?", "From whom?") : L("কাকে দেবেন?", "To whom?")}>
              <button
                type="button"
                onClick={() => setPicking(true)}
                className="flex items-center gap-3 rounded-xl border-2 bg-white p-3 text-left hover:border-primary"
              >
                <UserRound className="size-6 text-violet-600" />
                <span className="flex-1 font-semibold">{party?.name ?? L("এখানে চাপ দিয়ে বাছাই করুন", "Tap to choose")}</span>
                {party && <DueText amount={balance} kind={partyType} className="text-sm" />}
              </button>
            </Field>
            <Field label={L("কত টাকা?", "Amount")}>
              <NumInput autoFocus value={amount} onValueChange={setAmount} prefix="৳" className="[&_input]:h-14 [&_input]:text-2xl" />
              {balance > 0 && (
                <Button variant="outline" size="sm" className="w-fit" onClick={() => setAmount(balance)}>
                  {L("পুরো বাকি", "Full due")}: {money(balance)}
                </Button>
              )}
            </Field>
            <Field label={L("কীভাবে?", "Method")}>
              <PayMethodPicker value={method} onChange={setMethod} compact />
            </Field>
            <Field label={L("নোট (ইচ্ছা হলে)", "Note (optional)")}>
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={L("যেমন: চেক নং / বিকাশ নম্বর", "e.g. cheque no.")} />
            </Field>
            {party && amount > 0 && (
              <p className="rounded-xl bg-muted p-3 text-center">
                {L("এরপর", "After this")}: <DueText amount={balance - amount} kind={partyType} />
              </p>
            )}
          </div>
          <DialogFooter className="grid grid-cols-2 gap-2 sm:grid-cols-2">
            <Button variant="outline" size="lg" disabled={busy} onClick={() => void submit(true)}>
              <Printer /> {L("সেভ ও রিসিপ্ট", "Save & print")}
            </Button>
            <Button size="lg" disabled={busy} onClick={() => void submit(false)}>
              <HandCoins /> {L("সেভ করুন", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {isIn ? (
        <CustomerPicker open={picking} onOpenChange={setPicking} onPick={setParty} />
      ) : (
        <SupplierPicker open={picking} onOpenChange={setPicking} onPick={setParty} />
      )}
    </>
  );
}
