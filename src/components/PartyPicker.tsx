import { useMemo, useState } from "react";
import { Phone, Search, UserPlus, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { DueText } from "./common";
import { CustomerFormDialog, SupplierFormDialog } from "./PartyForms";
import { matchSearch, useCustomers, useSuppliers } from "@/lib/hooks";
import { useI18n } from "@/lib/i18n";
import type { Customer, Supplier } from "@/lib/types";

type PickerProps<T> = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onPick: (p: T) => void;
};

function PickerList<T extends Customer | Supplier>({
  title,
  items,
  kind,
  onPick,
  onNew,
  newLabel,
}: {
  title: string;
  items: { party: T; balance: number }[] | undefined;
  kind: "customer" | "supplier";
  onPick: (p: T) => void;
  onNew: () => void;
  newLabel: string;
}) {
  const { L } = useI18n();
  const [q, setQ] = useState("");
  const list = useMemo(
    () => (items ?? []).filter((i) => !q || matchSearch(`${i.party.name} ${i.party.phone ?? ""} ${"company" in i.party ? (i.party.company ?? "") : ""}`, q)).slice(0, 80),
    [items, q],
  );
  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-xl">{title}</DialogTitle>
      </DialogHeader>
      <div className="relative">
        <Search className="absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground" />
        <Input autoFocus className="pl-10" placeholder={L("নাম বা মোবাইল নম্বর লিখুন", "Search name or phone")} value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <Button variant="secondary" size="lg" className="w-full border-2 border-dashed border-primary/40" onClick={onNew}>
        <UserPlus /> {newLabel}
      </Button>
      <div className="-mx-1 max-h-[50vh] overflow-y-auto px-1">
        {list.length === 0 && <p className="py-6 text-center text-muted-foreground">{L("কেউ পাওয়া যায়নি", "No one found")}</p>}
        <div className="grid gap-2">
          {list.map(({ party, balance }) => (
            <button
              key={party.id}
              type="button"
              onClick={() => onPick(party)}
              className="flex items-center gap-3 rounded-xl border bg-white p-3 text-left transition hover:border-primary hover:bg-primary/5"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-violet-100 text-violet-700">
                <UserRound className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{party.name}</span>
                {party.phone && (
                  <span className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Phone className="size-3" /> {party.phone}
                  </span>
                )}
              </span>
              <DueText amount={balance} kind={kind} className="text-sm" />
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

export function CustomerPicker({ open, onOpenChange, onPick }: PickerProps<Customer>) {
  const { L } = useI18n();
  const customers = useCustomers();
  const [creating, setCreating] = useState(false);
  return (
    <>
      <Dialog open={open && !creating} onOpenChange={onOpenChange}>
        <DialogContent>
          <PickerList
            title={L("কাস্টমার বাছাই করুন", "Choose customer")}
            items={customers}
            kind="customer"
            onPick={(c) => {
              onPick(c);
              onOpenChange(false);
            }}
            onNew={() => setCreating(true)}
            newLabel={L("নতুন কাস্টমার যোগ করুন", "Add new customer")}
          />
        </DialogContent>
      </Dialog>
      <CustomerFormDialog
        open={creating}
        onOpenChange={setCreating}
        onSaved={(c) => {
          onPick(c);
          onOpenChange(false);
        }}
      />
    </>
  );
}

export function SupplierPicker({ open, onOpenChange, onPick }: PickerProps<Supplier>) {
  const { L } = useI18n();
  const suppliers = useSuppliers();
  const [creating, setCreating] = useState(false);
  return (
    <>
      <Dialog open={open && !creating} onOpenChange={onOpenChange}>
        <DialogContent>
          <PickerList
            title={L("সাপ্লায়ার বাছাই করুন", "Choose supplier")}
            items={suppliers}
            kind="supplier"
            onPick={(s) => {
              onPick(s);
              onOpenChange(false);
            }}
            onNew={() => setCreating(true)}
            newLabel={L("নতুন সাপ্লায়ার যোগ করুন", "Add new supplier")}
          />
        </DialogContent>
      </Dialog>
      <SupplierFormDialog
        open={creating}
        onOpenChange={setCreating}
        onSaved={(s) => {
          onPick(s);
          onOpenChange(false);
        }}
      />
    </>
  );
}
