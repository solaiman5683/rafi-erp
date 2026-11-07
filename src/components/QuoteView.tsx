import { forwardRef } from "react";
import { UNITS } from "@/lib/constants";
import { amountInWords } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import type { QuoteDoc } from "@/lib/quote";

/** কোটেশন — মেমোর মতো দেখতে; পর্দা, প্রিন্ট আর ছবি তিন জায়গাতেই এটাই */
export const QuoteView = forwardRef<HTMLDivElement, { doc: QuoteDoc }>(function QuoteView({ doc }, ref) {
  const { L, B, money, num, date, lang } = useI18n();
  const s = doc.shop;
  const anyItemDisc = doc.items.some((it) => it.disc_amount > 0);
  return (
    <div ref={ref} className="mx-auto w-full max-w-[640px] bg-white p-5 text-[13px] text-black sm:p-7">
      <div className="mb-3 border-b-2 border-black pb-2 text-center">
        <p className="text-[1.9em] leading-tight font-bold">{s.name}</p>
        {s.tagline && <p className="text-[0.95em]">{s.tagline}</p>}
        {s.address && <p className="text-[0.95em]">{s.address}</p>}
        {(s.phone || s.phone2) && <p className="text-[0.95em]">☎ {[s.phone, s.phone2].filter(Boolean).join(", ")}</p>}
        <span className="mt-1.5 inline-block rounded-full border-2 border-black px-4 py-0.5 text-[1.05em] font-bold">{L("কোটেশন", "QUOTATION")}</span>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-x-4 gap-y-0.5">
        <p>
          {L("কোটেশন নং", "Quote No")}: <b>{doc.no}</b>
        </p>
        <p className="text-right">
          {L("তারিখ", "Date")}: <b>{date(doc.date)}</b>
        </p>
        {doc.customer && (
          <p className="col-span-2">
            {L("নাম", "Name")}: <b>{doc.customer.name}</b>
            {doc.customer.phone && <> · {doc.customer.phone}</>}
          </p>
        )}
        {doc.customer?.address && (
          <p className="col-span-2">
            {L("ঠিকানা", "Address")}: {doc.customer.address}
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
          {doc.items.map((it, i) => (
            <tr key={i} className="border-b border-dashed border-gray-400 align-top">
              <td className="py-1 pr-1">{num(i + 1)}</td>
              <td className="py-1">
                {it.name}
                {it.variant && ` (${it.variant})`}
                {it.disc_amount > 0 && (
                  <span className="block text-[0.85em] text-gray-600">
                    {L("আসল দর", "List")} {money(it.list_price)} · {L("ছাড়", "Disc")} {money(it.disc_amount)}
                  </span>
                )}
              </td>
              <td className="py-1 text-right whitespace-nowrap">
                {num(it.qty)} {B(UNITS[it.unit]) || it.unit}
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
            {L("কথায়", "In words")}: <b>{amountInWords(doc.total, lang)}</b>
          </p>
        </div>
        <table className="w-[48%]">
          <tbody>
            <tr>
              <td className="py-0.5">{L("মোট", "Subtotal")}</td>
              <td className="py-0.5 text-right">{money(doc.subtotal)}</td>
            </tr>
            {doc.discount !== 0 && (
              <tr>
                <td className="py-0.5">{L("ছাড়", "Discount")}</td>
                <td className="py-0.5 text-right">- {money(doc.discount)}</td>
              </tr>
            )}
            <tr className="border-t border-black font-bold">
              <td className="py-0.5">{L("সর্বমোট", "Grand total")}</td>
              <td className="py-0.5 text-right">{money(doc.total)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {doc.note && <p className="mt-3 text-[0.95em]">{L("নোট", "Note")}: {doc.note}</p>}
      <p className="mt-4 rounded border border-dashed border-gray-500 px-2 py-1 text-center text-[0.9em]">
        {L("এটি কোটেশন, বিক্রির মেমো নয়। দাম ৭ দিন পর্যন্ত প্রযোজ্য, স্টক থাকা সাপেক্ষে।", "This is a quotation, not a sales memo. Prices valid for 7 days, subject to stock.")}
        {anyItemDisc && ` ${L("ছাড় দেওয়া দাম দেখানো হয়েছে।", "Discounted prices shown.")}`}
      </p>
      <div className="mt-10 flex justify-end text-center text-[0.95em]">
        <span className="w-44 border-t border-black pt-1">{L("বিক্রেতার স্বাক্ষর", "Seller's signature")}</span>
      </div>
      {s.note && <p className="mt-4 border-t pt-1 text-center text-[0.9em]">{s.note}</p>}
      {doc.by_name && <p className="mt-1 text-center text-[0.75em] text-gray-500">{L("প্রস্তুতকারী", "Prepared by")}: {doc.by_name}</p>}
    </div>
  );
});
