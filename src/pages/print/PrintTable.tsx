import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { ALL_FROM } from "@/components/DateRange";
import { todayISO } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { buildReport, buildSales, rangeText, type CellKind, type ReportTab, type TableData } from "@/lib/tables";
import { cn } from "@/lib/utils";
import { PrintLayout, ShopHeader } from "./PrintLayout";

/** /print/table?kind=sales|report&tab=…&from=…&to=…&q=… — রিপোর্ট ও বিক্রির তালিকার প্রিন্ট */
export default function PrintTable() {
  const [params] = useSearchParams();
  const i18n = useI18n();
  const { L, money, num } = i18n;
  const kind = params.get("kind") ?? "report";
  const tab = (params.get("tab") ?? "summary") as ReportTab;
  const from = params.get("from") ?? todayISO();
  const to = params.get("to") ?? todayISO();
  const q = params.get("q") ?? "";
  const [data, setData] = useState<TableData | null>(null);

  useEffect(() => {
    void (kind === "sales" ? buildSales(from, to, q, i18n) : buildReport(tab, from, to, i18n)).then(setData);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, tab, from, to, q, i18n.lang]);

  const cell = (v: string | number, k?: CellKind) => (typeof v === "number" ? (k === "money" ? money(v) : num(v)) : v);
  const showRange = !(kind === "report" && (tab === "stock" || tab === "dues"));

  return (
    <PrintLayout ready={!!data} title={data?.title ?? "Report"} defaultPaper="A4">
      {(s) =>
        data && (
          <div>
            <ShopHeader s={s} title={data.title} />
            <div className="mb-3 flex flex-wrap justify-between gap-2 text-[0.95em]">
              <span>{showRange ? `${L("সময়", "Period")}: ${rangeText(from, to, i18n, ALL_FROM)}` : `${L("তারিখ", "Date")}: ${i18n.date(todayISO())}`}</span>
              {q && (
                <span>
                  {L("খোঁজ", "Search")}: “{q}”
                </span>
              )}
            </div>
            {data.notes && (
              <div className="mb-2 flex flex-wrap gap-x-6 font-semibold">
                {data.notes.map((n) => (
                  <span key={n}>{n}</span>
                ))}
              </div>
            )}
            <table className="w-full border-collapse text-[0.92em]">
              <thead>
                <tr className="border-y-2 border-black">
                  {data.columns.map((c) => (
                    <th key={c.label} className={cn("px-1 py-1 text-left", c.kind && "text-right")}>
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.rows.length === 0 && (
                  <tr>
                    <td colSpan={data.columns.length} className="py-6 text-center">
                      {L("কিছু নেই", "Nothing")}
                    </td>
                  </tr>
                )}
                {data.rows.map((r, i) => (
                  <tr key={i} className="border-b border-dashed border-gray-400 align-top break-inside-avoid">
                    {r.map((v, j) => (
                      <td key={j} className={cn("px-1 py-1", data.columns[j]?.kind && "text-right whitespace-nowrap")}>
                        {cell(v, data.columns[j]?.kind)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
              {data.footer && (
                <tfoot>
                  <tr className="border-t-2 border-black font-bold">
                    {data.footer.map((v, j) => (
                      <td key={j} className={cn("px-1 py-1", data.columns[j]?.kind && "text-right whitespace-nowrap")}>
                        {v === "" ? "" : cell(v, data.columns[j]?.kind)}
                      </td>
                    ))}
                  </tr>
                </tfoot>
              )}
            </table>
            <p className="mt-4 text-right text-[0.8em] text-gray-500">
              {L("প্রিন্টের সময়", "Printed")}: {i18n.date(todayISO())} {i18n.time(Date.now())}
            </p>
          </div>
        )
      }
    </PrintLayout>
  );
}
