import { useId } from "react";
import { cn } from "@/lib/utils";

export const BRAND = { bn: "জমাদ্দার ট্রেডার্স", en: "Jomoddar Traders" } as const;

/** জমাদ্দার ট্রেডার্সের লোগো: নাটের (হেক্স নাট) ভেতরে "J", উপরের দাগটা "T"-এর মতো */
export function BrandMark({ className }: { className?: string }) {
  const id = useId();
  return (
    <svg viewBox="0 0 64 64" className={cn("size-10 shrink-0 drop-shadow-sm", className)} role="img" aria-label={BRAND.en}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#10b981" />
          <stop offset="1" stopColor="#065f46" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="14" fill={`url(#${id})`} />
      <path d="M21.5 13.8h21L53 32 42.5 50.2h-21L11 32z" fill="#fff" />
      <path d="M28.5 22h11M35 22v13.5a6 6 0 0 1-12 0" fill="none" stroke="#065f46" strokeWidth={5.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
