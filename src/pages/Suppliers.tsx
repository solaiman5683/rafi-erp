import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { ChevronRight, Factory, HandCoins, Phone, Plus, Search, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DueText, EmptyState, PageHeader, StatCard } from "@/components/common";
import { SupplierFormDialog } from "@/components/PartyForms";
import { PaymentDialog } from "@/components/PaymentDialog";
import { matchSearch, useSuppliers } from "@/lib/hooks";
import { useI18n } from "@/lib/i18n";
import { Pager, usePaged } from "@/components/Pager";

export default function Suppliers() {
  const { L, money, num } = useI18n();
  const nav = useNavigate();
  const suppliers = useSuppliers();
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);
  const [paying, setPaying] = useState(false);

  const list = useMemo(
    () => (suppliers ?? []).filter((s) => !q || matchSearch(`${s.party.name} ${s.party.company ?? ""} ${s.party.phone ?? ""}`, q)),
    [suppliers, q],
  );
  const paged = usePaged(list, q);
  const totalPayable = (suppliers ?? []).reduce((s, x) => s + Math.max(x.balance, 0), 0);

  return (
    <div>
      <PageHeader
        icon={Factory}
        color="#0891b2"
        title={L("সাপ্লায়ার", "Suppliers")}
        subtitle={L("যাদের কাছ থেকে মাল কেনেন এবং কত টাকা দেনা", "Who you buy from and what you owe")}
        actions={
          <>
            <Button variant="outline" onClick={() => setPaying(true)}>
              <HandCoins /> {L("টাকা দিন", "Pay")}
            </Button>
            <Button onClick={() => setAdding(true)} className="bg-cyan-600 hover:bg-cyan-700">
              <Plus /> {L("নতুন সাপ্লায়ার", "New supplier")}
            </Button>
          </>
        }
      />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard icon={Factory} color="#0891b2" label={L("মোট সাপ্লায়ার", "Suppliers")} value={num(suppliers?.length ?? 0)} />
        <StatCard icon={Wallet} color="#dc2626" label={L("মোট দেনা", "Total payable")} value={money(totalPayable)} />
      </div>
      <div className="relative mb-4">
        <Search className="absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-10" placeholder={L("নাম, কোম্পানি বা মোবাইল…", "Name, company or phone…")} value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {suppliers && suppliers.length === 0 ? (
        <EmptyState icon={Factory} title={L("এখনো কোনো সাপ্লায়ার নেই", "No suppliers yet")} action={<Button onClick={() => setAdding(true)}><Plus /> {L("নতুন সাপ্লায়ার", "New supplier")}</Button>} />
      ) : (
        <div className="grid gap-2 md:grid-cols-2">
          {paged.rows.map(({ party: s, balance }) => (
            <button
              key={s.id}
              type="button"
              onClick={() => nav(`/suppliers/${s.id}`)}
              className="flex items-center gap-3 rounded-2xl border bg-white p-3 text-left shadow-xs transition hover:border-cyan-400"
            >
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-cyan-100 text-cyan-700">
                <Factory className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-bold">{s.name}</span>
                <span className="flex items-center gap-2 truncate text-xs text-muted-foreground">
                  {s.company}
                  {s.phone && (
                    <span className="flex items-center gap-0.5">
                      <Phone className="size-3" /> {s.phone}
                    </span>
                  )}
                </span>
              </span>
              <DueText amount={balance} kind="supplier" className="text-sm" />
              <ChevronRight className="size-5 text-muted-foreground" />
            </button>
          ))}
        </div>
      )}
      <SupplierFormDialog open={adding} onOpenChange={setAdding} />
      <PaymentDialog open={paying} onOpenChange={setPaying} partyType="supplier" />
      <Pager {...paged} />
    </div>
  );
}
