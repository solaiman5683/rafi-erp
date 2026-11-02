import { useParams } from "react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { methodLabel } from "@/components/PayMethodPicker";
import { UNITS, WALK_IN } from "@/lib/constants";
import { db } from "@/lib/db";
import { amountInWords } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { PrintLayout, ShopHeader, Signatures } from "./PrintLayout";

export default function PrintSale() {
  const { id } = useParams();
  const { L, B, money, num, date, time, lang } = useI18n();
  const sale = useLiveQuery(() => db.sales.get(id!), [id]);

  return (
    <PrintLayout ready={!!sale} title={sale ? `Memo ${sale.invoice_no}` : "Memo"}>
      {(s) =>
        sale && (
          <div>
            <ShopHeader s={s} title={L("ক্যাশ মেমো", "CASH MEMO")} />
            <div className="mb-3 grid grid-cols-2 gap-x-4 gap-y-0.5">
              <p>
                {L("মেমো নং", "Memo No")}: <b>{sale.invoice_no}</b>
              </p>
              <p className="text-right">
                {L("তারিখ", "Date")}: <b>{date(sale.date)}</b> {time(sale.created_at)}
              </p>
              <p className="col-span-2">
                {L("নাম", "Name")}: <b>{sale.customer_name || B(WALK_IN)}</b>
                {sale.customer_phone && <> · {sale.customer_phone}</>}
              </p>
              {sale.customer_address && (
                <p className="col-span-2">
                  {L("ঠিকানা", "Address")}: {sale.customer_address}
                </p>
              )}
            </div>
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-y-2 border-black text-left">
                  <th className="w-[6%] py-1 pr-1">{L("নং", "#")}</th>
                  <th className="py-1">{L("মালের বিবরণ", "Description")}</th>
                  <th className="py-1 text-right">{L("পরিমাণ", "Qty")}</th>
                  <th className="py-1 text-right">{L("দর", "Rate")}</th>
                  <th className="py-1 text-right">{L("টাকা", "Amount")}</th>
                </tr>
              </thead>
              <tbody>
                {sale.items.map((it, i) => (
                  <tr key={i} className="border-b border-dashed border-gray-400 align-top">
                    <td className="py-1 pr-1">{num(i + 1)}</td>
                    <td className="py-1">
                      {it.name}
                      {it.variant_name && ` (${it.variant_name})`}
                      {it.disc_amount > 0 && (
                        <span className="block text-[0.85em] text-gray-600">
                          {L("ছাড়", "Disc")} {money(it.disc_amount)}
                        </span>
                      )}
                    </td>
                    <td className="py-1 text-right whitespace-nowrap">
                      {num(it.qty)} {B(UNITS[it.unit])}
                    </td>
                    <td className="py-1 text-right">{money(it.price)}</td>
                    <td className="py-1 text-right font-semibold">{money(it.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-2 flex justify-between gap-4">
              <div className="flex-1 self-end text-[0.95em]">
                <p>
                  {L("কথায়", "In words")}: <b>{amountInWords(sale.total, lang)}</b>
                </p>
                <p className="text-gray-600">
                  {L("পরিশোধ", "Paid by")}: {methodLabel(sale.method, B)}
                </p>
              </div>
              <table className="w-[48%]">
                <tbody>
                  <SumRow label={L("মোট", "Subtotal")} value={money(sale.subtotal)} />
                  {sale.discount !== 0 && <SumRow label={L("ছাড়", "Discount")} value={`- ${money(sale.discount)}`} />}
                  <SumRow label={L("সর্বমোট", "Grand total")} value={money(sale.total)} bold border />
                  <SumRow label={L("জমা", "Paid")} value={money(sale.paid)} />
                  {sale.customer_id ? (
                    <>
                      <SumRow label={L("এই মেমোর বাকি", "Due (this memo)")} value={money(sale.due)} />
                      <SumRow label={L("আগের বাকি", "Previous due")} value={money(sale.prev_due)} />
                      <SumRow label={L("মোট বাকি", "Total due")} value={money(sale.prev_due + sale.due)} bold border />
                    </>
                  ) : (
                    sale.due > 0 && <SumRow label={L("বাকি", "Due")} value={money(sale.due)} bold />
                  )}
                </tbody>
              </table>
            </div>
            <Signatures left={L("ক্রেতার স্বাক্ষর", "Customer's signature")} right={L("বিক্রেতার স্বাক্ষর", "Seller's signature")} />
            {s?.invoice_note && <p className="mt-4 border-t pt-1 text-center text-[0.9em]">{s.invoice_note}</p>}
            {sale.by_name && <p className="mt-1 text-center text-[0.75em] text-gray-500">{L("বিক্রেতা", "Served by")}: {sale.by_name}</p>}
          </div>
        )
      }
    </PrintLayout>
  );
}

function SumRow({ label, value, bold, border }: { label: string; value: string; bold?: boolean; border?: boolean }) {
  return (
    <tr className={`${bold ? "font-bold" : ""} ${border ? "border-t border-black" : ""}`}>
      <td className="py-0.5">{label}</td>
      <td className="py-0.5 text-right">{value}</td>
    </tr>
  );
}
