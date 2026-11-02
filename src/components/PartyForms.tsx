import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "./common";
import { NumInput } from "./NumInput";
import { CUSTOMER_TYPES } from "@/lib/constants";
import { useI18n } from "@/lib/i18n";
import { saveCustomer, saveSupplier } from "@/lib/ops";
import type { Customer, Supplier } from "@/lib/types";
import { cn } from "@/lib/utils";

function Chips<T extends string>({ value, options, onChange }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={cn(
            "h-10 rounded-full border-2 px-4 text-sm font-semibold transition",
            value === o.id ? "border-primary bg-primary text-primary-foreground" : "bg-white hover:bg-muted",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export { Chips };

const emptyCustomer = (): Partial<Customer> => ({
  name: "",
  phone: "",
  address: "",
  type: "retail",
  price_tier: "retail",
  disc_mode: "none",
  disc_value: 0,
  note: "",
});

export function CustomerFormDialog({
  open,
  onOpenChange,
  initial,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: Customer | null;
  onSaved?: (c: Customer) => void;
}) {
  const { L, B } = useI18n();
  const [f, setF] = useState<Partial<Customer>>(emptyCustomer);
  const [opening, setOpening] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setF(initial ? { ...initial } : emptyCustomer());
      setOpening(0);
    }
  }, [open, initial]);

  const set = <K extends keyof Customer>(k: K, v: Customer[K]) => setF((p) => ({ ...p, [k]: v }));

  async function submit() {
    if (!f.name?.trim()) return toast.error(L("কাস্টমারের নাম লিখুন", "Enter customer name"));
    setBusy(true);
    try {
      const saved = await saveCustomer({ ...f, name: f.name.trim(), phone: f.phone?.trim() } as Customer, initial ? 0 : opening);
      toast.success(L("কাস্টমার সেভ হয়েছে", "Customer saved"));
      onSaved?.(saved);
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
          <DialogTitle className="text-xl">{initial ? L("কাস্টমার এডিট", "Edit customer") : L("নতুন কাস্টমার", "New customer")}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <Field label={L("নাম *", "Name *")}>
            <Input autoFocus value={f.name ?? ""} onChange={(e) => set("name", e.target.value)} placeholder={L("যেমন: করিম সাহেব", "e.g. Karim")} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={L("মোবাইল", "Phone")}>
              <Input inputMode="tel" value={f.phone ?? ""} onChange={(e) => set("phone", e.target.value)} placeholder="01XXXXXXXXX" />
            </Field>
            <Field label={L("ঠিকানা", "Address")}>
              <Input value={f.address ?? ""} onChange={(e) => set("address", e.target.value)} />
            </Field>
          </div>
          <Field label={L("কাস্টমারের ধরন", "Customer type")}>
            <Chips
              value={f.type ?? "retail"}
              onChange={(v) => setF((p) => ({ ...p, type: v, price_tier: v === "retail" ? "retail" : "wholesale" }))}
              options={(Object.keys(CUSTOMER_TYPES) as Customer["type"][]).map((k) => ({ id: k, label: B(CUSTOMER_TYPES[k]) }))}
            />
          </Field>
          <Field label={L("কোন দামে বিক্রি হবে?", "Which price?")}>
            <Chips
              value={f.price_tier ?? "retail"}
              onChange={(v) => set("price_tier", v)}
              options={[
                { id: "retail", label: L("খুচরা দাম", "Retail price") },
                { id: "wholesale", label: L("পাইকারি দাম", "Wholesale price") },
              ]}
            />
          </Field>
          <Field label={L("এই কাস্টমারের নিয়মিত ছাড়", "Regular discount")} hint={L("বিক্রির সময় নিজে থেকে বসে যাবে, চাইলে বদলানো যাবে", "Applied automatically on sale; can be changed")}>
            <div className="flex flex-wrap items-center gap-2">
              <Chips
                value={f.disc_mode ?? "none"}
                onChange={(v) => setF((p) => ({ ...p, disc_mode: v, disc_value: v === "none" ? 0 : p.disc_value }))}
                options={[
                  { id: "none", label: L("ছাড় নেই", "None") },
                  { id: "percent", label: L("% শতাংশ", "% Percent") },
                  { id: "amount", label: L("৳ টাকা", "৳ Fixed") },
                ]}
              />
              {f.disc_mode !== "none" && (
                <NumInput
                  className="w-32"
                  value={f.disc_value ?? 0}
                  onValueChange={(n) => set("disc_value", n)}
                  suffix={f.disc_mode === "percent" ? "%" : "৳"}
                />
              )}
            </div>
          </Field>
          {!initial && (
            <Field label={L("আগের বাকি (থাকলে)", "Previous due (if any)")}>
              <NumInput value={opening} onValueChange={setOpening} prefix="৳" />
            </Field>
          )}
          <Field label={L("নোট", "Note")}>
            <Textarea value={f.note ?? ""} onChange={(e) => set("note", e.target.value)} rows={2} />
          </Field>
        </div>
        <DialogFooter>
          <Button size="lg" className="w-full" disabled={busy} onClick={() => void submit()}>
            <Save /> {L("সেভ করুন", "Save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function SupplierFormDialog({
  open,
  onOpenChange,
  initial,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: Supplier | null;
  onSaved?: (s: Supplier) => void;
}) {
  const { L } = useI18n();
  const [f, setF] = useState<Partial<Supplier>>({});
  const [opening, setOpening] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setF(initial ? { ...initial } : { name: "", company: "", phone: "", address: "", note: "" });
      setOpening(0);
    }
  }, [open, initial]);

  const set = <K extends keyof Supplier>(k: K, v: Supplier[K]) => setF((p) => ({ ...p, [k]: v }));

  async function submit() {
    if (!f.name?.trim()) return toast.error(L("সাপ্লায়ারের নাম লিখুন", "Enter supplier name"));
    setBusy(true);
    try {
      const saved = await saveSupplier({ ...f, name: f.name.trim() } as Supplier, initial ? 0 : opening);
      toast.success(L("সাপ্লায়ার সেভ হয়েছে", "Supplier saved"));
      onSaved?.(saved);
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
          <DialogTitle className="text-xl">{initial ? L("সাপ্লায়ার এডিট", "Edit supplier") : L("নতুন সাপ্লায়ার", "New supplier")}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <Field label={L("নাম *", "Name *")}>
            <Input autoFocus value={f.name ?? ""} onChange={(e) => set("name", e.target.value)} />
          </Field>
          <Field label={L("কোম্পানি / দোকানের নাম", "Company")}>
            <Input value={f.company ?? ""} onChange={(e) => set("company", e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={L("মোবাইল", "Phone")}>
              <Input inputMode="tel" value={f.phone ?? ""} onChange={(e) => set("phone", e.target.value)} placeholder="01XXXXXXXXX" />
            </Field>
            <Field label={L("ঠিকানা", "Address")}>
              <Input value={f.address ?? ""} onChange={(e) => set("address", e.target.value)} />
            </Field>
          </div>
          {!initial && (
            <Field label={L("আগের দেনা (থাকলে)", "Previous payable (if any)")}>
              <NumInput value={opening} onValueChange={setOpening} prefix="৳" />
            </Field>
          )}
          <Field label={L("নোট", "Note")}>
            <Textarea value={f.note ?? ""} onChange={(e) => set("note", e.target.value)} rows={2} />
          </Field>
        </div>
        <DialogFooter>
          <Button size="lg" className="w-full" disabled={busy} onClick={() => void submit()}>
            <Save /> {L("সেভ করুন", "Save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
