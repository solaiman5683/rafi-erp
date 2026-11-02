import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

export const PAGE_SIZE = 20;

/**
 * লম্বা তালিকা পাতায় পাতায় দেখানো। resetKey বদলালে (ফিল্টার/খোঁজ বদলালে) আবার ১ম পাতায় যায়।
 */
export function usePaged<T>(items: T[] | undefined, resetKey: unknown, size = PAGE_SIZE) {
  const [page, setPage] = useState(1);
  const key = JSON.stringify(resetKey);
  useEffect(() => setPage(1), [key]);
  const total = items?.length ?? 0;
  const pages = Math.max(1, Math.ceil(total / size));
  const current = Math.min(page, pages);
  const rows = useMemo(() => (items ?? []).slice((current - 1) * size, current * size), [items, current, size]);
  return { rows, page: current, pages, total, setPage, offset: (current - 1) * size };
}

export function Pager({ page, pages, total, setPage, size = PAGE_SIZE }: { page: number; pages: number; total: number; setPage: (p: number) => void; size?: number }) {
  const { L, num } = useI18n();
  if (total <= size) return null;
  const from = (page - 1) * size + 1;
  const to = Math.min(page * size, total);
  const go = (p: number) => {
    setPage(p);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  return (
    <div className="no-print mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-white p-2 pl-4">
      <span className="tabular text-sm text-muted-foreground">
        {L(`${num(total)}টির মধ্যে ${num(from)}–${num(to)}`, `${num(from)}–${num(to)} of ${num(total)}`)}
      </span>
      <div className="flex items-center gap-2">
        <Button variant="outline" disabled={page <= 1} onClick={() => go(page - 1)}>
          <ChevronLeft /> {L("আগের", "Prev")}
        </Button>
        <span className="tabular min-w-16 text-center font-semibold">
          {num(page)} / {num(pages)}
        </span>
        <Button variant="outline" disabled={page >= pages} onClick={() => go(page + 1)}>
          {L("পরের", "Next")} <ChevronRight />
        </Button>
      </div>
    </div>
  );
}
