import { matchRanges } from "@/lib/search";

/** খোঁজার সাথে যে অংশটুকু মিলেছে সেটা বোল্ড করে দেখায় */
export function Highlight({ text, q }: { text: string; q: string }) {
  if (!q.trim() || !text) return <>{text}</>;
  const { source, ranges } = matchRanges(text, q);
  if (!ranges.length) return <>{text}</>;
  const parts: React.ReactNode[] = [];
  let at = 0;
  ranges.forEach(([s, e], i) => {
    if (s > at) parts.push(source.slice(at, s));
    parts.push(
      <mark key={i} className="rounded-sm bg-amber-200/70 px-0.5 font-extrabold text-inherit">
        {source.slice(s, e)}
      </mark>,
    );
    at = e;
  });
  if (at < source.length) parts.push(source.slice(at));
  return <>{parts}</>;
}
