import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { useI18n } from "@/lib/i18n";

/** একটি সিরিজের কলাম চার্ট (দিনভিত্তিক) — শিরোনামই সিরিজের নাম, তাই লেজেন্ড নেই */
export function DailyBarChart({
  data,
  dataKey,
  label,
  color,
  height = 240,
}: {
  data: { date: string; [k: string]: number | string }[];
  dataKey: string;
  label: string;
  color: string;
  height?: number;
}) {
  const { shortDate, money, num, lang } = useI18n();
  // "YYYY-MM" হলে মাসের নাম, নইলে দিন
  const dateLabel = (d: string) => (d.length === 7 ? shortDate(`${d}-01`).split(" ").slice(1).join(" ") + ` ${d.slice(2, 4)}` : shortDate(d));
  const config: ChartConfig = { [dataKey]: { label, color } };
  const compact = (v: number) => {
    const a = Math.abs(v);
    if (a >= 100000) return `${num(v / 100000, 1)}${lang === "bn" ? "লা" : "L"}`;
    if (a >= 1000) return `${num(v / 1000, 1)}${lang === "bn" ? "হা" : "K"}`;
    return num(v);
  };
  return (
    <ChartContainer config={config} className="w-full" style={{ height }}>
      <BarChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }} barCategoryGap="20%">
        <CartesianGrid vertical={false} stroke="var(--border)" strokeWidth={1} />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={12}
          tickFormatter={(d: string) => dateLabel(d)}
          tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
        />
        <YAxis width={48} tickLine={false} axisLine={false} tickFormatter={compact} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
        <ChartTooltip
          cursor={{ fill: "var(--muted)", opacity: 0.6 }}
          content={
            <ChartTooltipContent
              labelFormatter={(_, p) => dateLabel(String(p?.[0]?.payload?.date ?? ""))}
              formatter={(v) => (
                <span className="flex w-full justify-between gap-4">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="tabular font-semibold text-foreground">{money(Number(v))}</span>
                </span>
              )}
            />
          }
        />
        <Bar dataKey={dataKey} fill={`var(--color-${dataKey})`} radius={[4, 4, 0, 0]} maxBarSize={24} />
      </BarChart>
    </ChartContainer>
  );
}
