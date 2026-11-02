import { useParams } from "react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { methodLabel } from "@/components/PayMethodPicker";
import { db } from "@/lib/db";
import { amountInWords } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { PrintLayout, ShopHeader, Signatures } from "./PrintLayout";

export default function PrintReceipt() {
  const { id } = useParams();
  const { L, B, money, date, time, lang } = useI18n();
  const data = useLiveQuery(async () => {
    const pay = await db.payments.get(id!);
    if (!pay) return null;
    const balance = (await db.balances.get(pay.party_id))?.amount ?? 0;
    return { pay, balance };
  }, [id]);
  const pay = data?.pay;
  const isIn = pay?.party_type === "customer";

  return (
    <PrintLayout ready={!!pay} title={pay ? `Receipt ${pay.receipt_no}` : "Receipt"}>
      {(s) =>
        pay && (
          <div>
            <ShopHeader s={s} title={isIn ? L("মানি রিসিপ্ট", "MONEY RECEIPT") : L("টাকা প্রদানের রসিদ", "PAYMENT VOUCHER")} />
            <div className="mb-4 flex justify-between">
              <p>
                {L("রসিদ নং", "Receipt No")}: <b>{pay.receipt_no}</b>
              </p>
              <p>
                {L("তারিখ", "Date")}: <b>{date(pay.date)}</b> {time(pay.created_at)}
              </p>
            </div>
            <div className="space-y-3 text-[1.1em] leading-relaxed">
              <p>
                {isIn ? L("জনাব/জনাবা", "Received with thanks from") : L("প্রাপক", "Paid to")}: <b className="border-b border-dotted border-black px-2">{pay.party_name}</b>
                {isIn && L(" এর নিকট হইতে", "")}
              </p>
              <p>
                {L("টাকার পরিমাণ", "The sum of")}: <b className="border-b border-dotted border-black px-2">{money(pay.amount)}</b>
              </p>
              <p>
                {L("কথায়", "In words")}: <b>{amountInWords(pay.amount, lang)}</b>
              </p>
              <p>
                {L("মাধ্যম", "By")}: {methodLabel(pay.method, B)}
                {pay.note && ` — ${pay.note}`}
              </p>
              {isIn && lang === "bn" && <p>বুঝিয়া পাইলাম।</p>}
              <p className="rounded border border-black p-2 font-semibold">
                {isIn ? L("এখন বাকি আছে", "Remaining due") : L("এখন দেনা আছে", "Remaining payable")}: {money(data!.balance)}
              </p>
            </div>
            <Signatures left={isIn ? L("প্রদানকারীর স্বাক্ষর", "Payer") : L("গ্রহীতার স্বাক্ষর", "Receiver")} right={L("কর্তৃপক্ষের স্বাক্ষর", "Authorised signature")} />
          </div>
        )
      }
    </PrintLayout>
  );
}
