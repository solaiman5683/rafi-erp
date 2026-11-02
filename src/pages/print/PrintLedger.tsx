import { useParams } from "react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { todayISO } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { ledgerLabel, withRunning } from "@/lib/labels";
import type { Customer, PartyType, Supplier } from "@/lib/types";
import { PrintLayout, ShopHeader } from "./PrintLayout";

export default function PrintLedger() {
  const { type, id } = useParams() as { type: PartyType; id: string };
  const { L, money, date } = useI18n();
  const data = useLiveQuery(async () => {
    const party = (type === "customer" ? await db.customers.get(id) : await db.suppliers.get(id)) as Customer | Supplier | undefined;
    const entries = await db.ledger.where("party_id").equals(id).toArray();
    return party ? { party, rows: withRunning(entries) } : null;
  }, [type, id]);

  const final = data?.rows.at(-1)?.balance ?? 0;

  return (
    <PrintLayout ready={!!data} title={data ? `Ledger ${data.party.name}` : "Ledger"}>
      {(s) =>
        data && (
          <div>
            <ShopHeader s={s} title={L("হিসাব বিবরণী (খাতা)", "ACCOUNT STATEMENT")} />
            <div className="mb-3 flex justify-between">
              <div>
                <p>
                  {L("নাম", "Name")}: <b>{data.party.name}</b>
                </p>
                {data.party.phone && <p>{data.party.phone}</p>}
                {data.party.address && <p>{data.party.address}</p>}
              </div>
              <p>
                {L("তারিখ", "Date")}: <b>{date(todayISO())}</b>
              </p>
            </div>
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-y-2 border-black text-left">
                  <th className="py-1">{L("তারিখ", "Date")}</th>
                  <th className="py-1">{L("বিবরণ", "Details")}</th>
                  <th className="py-1 text-right">{L("বিল", "Bill")}</th>
                  <th className="py-1 text-right">{L("জমা", "Paid")}</th>
                  <th className="py-1 text-right">{L("ব্যালেন্স", "Balance")}</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map(({ e, balance }) => (
                  <tr key={e.id} className="border-b border-dashed border-gray-400">
                    <td className="py-1 whitespace-nowrap">{date(e.date)}</td>
                    <td className="py-1">{ledgerLabel(e, L)}</td>
                    <td className="py-1 text-right">{e.bill ? money(e.bill) : ""}</td>
                    <td className="py-1 text-right">{e.paid ? money(e.paid) : ""}</td>
                    <td className="py-1 text-right font-semibold">{money(balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 rounded border-2 border-black p-2 text-right text-[1.2em] font-bold">
              {type === "customer" ? (final >= 0 ? L("মোট বাকি", "Total due") : L("অগ্রিম", "Advance")) : L("মোট দেনা", "Total payable")}: {money(Math.abs(final))}
            </p>
          </div>
        )
      }
    </PrintLayout>
  );
}
