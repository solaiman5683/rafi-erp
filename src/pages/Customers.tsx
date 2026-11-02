import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { ChevronRight, HandCoins, Phone, Search, UserPlus, UserRound, Users, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DueText, EmptyState, PageHeader, StatCard } from "@/components/common";
import { CustomerFormDialog } from "@/components/PartyForms";
import { PaymentDialog } from "@/components/PaymentDialog";
import { CUSTOMER_TYPES } from "@/lib/constants";
import { matchSearch, useCustomers } from "@/lib/hooks";
import { useI18n } from "@/lib/i18n";
import { Pager, usePaged } from "@/components/Pager";
import { cn } from "@/lib/utils";

export default function Customers() {
  const { L, B, money, num } = useI18n();
  const nav = useNavigate();
  const customers = useCustomers();
  const [q, setQ] = useState("");
  const [dueOnly, setDueOnly] = useState(false);
  const [adding, setAdding] = useState(false);
  const [paying, setPaying] = useState(false);

  const list = useMemo(() => {
    let l = (customers ?? []).filter((c) => !q || matchSearch(`${c.party.name} ${c.party.phone ?? ""} ${c.party.address ?? ""}`, q));
    if (dueOnly) l = l.filter((c) => c.balance > 0.009).sort((a, b) => b.balance - a.balance);
    return l;
  }, [customers, q, dueOnly]);

  const paged = usePaged(list, [q, dueOnly]);
  const totalDue = (customers ?? []).reduce((s, c) => s + Math.max(c.balance, 0), 0);
  const dueCount = (customers ?? []).filter((c) => c.balance > 0.009).length;

  return (
    <div>
      <PageHeader
        icon={Users}
        color="#7c3aed"
        title={L("কাস্টমার ও বাকি", "Customers & dues")}
        subtitle={L("কে কত টাকা বাকি রেখেছে — সব এক জায়গায়", "Who owes how much — all in one place")}
        actions={
          <>
            <Button variant="outline" onClick={() => setPaying(true)}>
              <HandCoins /> {L("টাকা জমা নিন", "Receive")}
            </Button>
            <Button onClick={() => setAdding(true)} className="bg-violet-600 hover:bg-violet-700">
              <UserPlus /> {L("নতুন কাস্টমার", "New customer")}
            </Button>
          </>
        }
      />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard icon={Users} color="#7c3aed" label={L("মোট কাস্টমার", "Customers")} value={num(customers?.length ?? 0)} />
        <StatCard
          icon={Wallet}
          color="#dc2626"
          label={L("মোট পাওনা (বাকি)", "Total receivable")}
          value={money(totalDue)}
          hint={L(`${num(dueCount)} জনের কাছে`, `from ${num(dueCount)} customers`)}
          onClick={() => setDueOnly(true)}
        />
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-60 flex-1">
          <Search className="absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-10" placeholder={L("নাম, মোবাইল বা ঠিকানা…", "Name, phone or address…")} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="flex gap-1 rounded-xl bg-muted p-1">
          <button type="button" onClick={() => setDueOnly(false)} className={cn("h-9 rounded-lg px-4 font-semibold", !dueOnly && "bg-white shadow")}>
            {L("সবাই", "All")}
          </button>
          <button type="button" onClick={() => setDueOnly(true)} className={cn("h-9 rounded-lg px-4 font-semibold", dueOnly && "bg-white text-red-600 shadow")}>
            {L("যাদের বাকি আছে", "With due")}
          </button>
        </div>
      </div>

      {customers && customers.length === 0 ? (
        <EmptyState
          icon={Users}
          title={L("এখনো কোনো কাস্টমার নেই", "No customers yet")}
          hint={L("বাকিতে বিক্রি করতে হলে কাস্টমার যোগ করুন", "Add customers to sell on credit")}
          action={<Button onClick={() => setAdding(true)}><UserPlus /> {L("নতুন কাস্টমার", "New customer")}</Button>}
        />
      ) : (
        <div className="grid gap-2 md:grid-cols-2">
          {paged.rows.map(({ party: c, balance }) => (
            <button
              key={c.id}
              type="button"
              onClick={() => nav(`/customers/${c.id}`)}
              className="flex items-center gap-3 rounded-2xl border bg-white p-3 text-left shadow-xs transition hover:border-violet-400"
            >
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-violet-100 text-violet-700">
                <UserRound className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-bold">{c.name}</span>
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  {c.phone && (
                    <span className="flex items-center gap-0.5">
                      <Phone className="size-3" /> {c.phone}
                    </span>
                  )}
                  <span className="rounded bg-muted px-1.5">{B(CUSTOMER_TYPES[c.type])}</span>
                </span>
              </span>
              <DueText amount={balance} className="text-sm" />
              <ChevronRight className="size-5 text-muted-foreground" />
            </button>
          ))}
        </div>
      )}

      <CustomerFormDialog open={adding} onOpenChange={setAdding} />
      <PaymentDialog open={paying} onOpenChange={setPaying} partyType="customer" />
      <Pager {...paged} />
    </div>
  );
}
