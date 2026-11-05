import type { ReactNode } from "react";
import type { LucideProps } from "lucide-react";

/**
 * দোকানের মালের জন্য নিজে আঁকা আইকন (lucide-এর মতো একই ধাঁচে: 24×24, গোল কোণার রেখা)।
 * lucide-এ রাউটার বিট, ব্লেড, বেয়ারিং ইত্যাদি নেই, তাই এগুলো এখানে।
 */
function make(children: ReactNode) {
  return function ShopIcon({ size = 24, color = "currentColor", strokeWidth = 2, className, style }: LucideProps) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        style={style}
        aria-hidden
      >
        {children}
      </svg>
    );
  };
}

/** রাউটার বিট — শ্যাঙ্ক, নকশা কাটার আর নিচে বেয়ারিং */
export const RouterBit = make(
  <>
    <rect x="10" y="2" width="4" height="9" rx="1" />
    <path d="M7 11h10v2.5c-2 0-3 1.5-3 3.5h-4c0-2-1-3.5-3-3.5z" />
    <circle cx="12" cy="20" r="2" />
  </>,
);

/** সোজা বিট */
export const StraightBit = make(
  <>
    <rect x="10" y="2" width="4" height="10" rx="1" />
    <path d="M8 12h8v8a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2z" />
    <path d="M12 12v10" />
  </>,
);

/** ভি বিট */
export const VBit = make(
  <>
    <rect x="10" y="2" width="4" height="10" rx="1" />
    <path d="M7 12h10l-5 10z" />
    <path d="M12 12v10" />
  </>,
);

/** বল নোজ / গোল মাথার বিট */
export const BallNoseBit = make(
  <>
    <rect x="10" y="2" width="4" height="9" rx="1" />
    <path d="M8 11h8v6a4 4 0 0 1-8 0z" />
    <path d="M8 14l8 2.5" />
  </>,
);

/** এন্ড মিল / সিএনসি বিট (প্যাঁচানো খাঁজ) */
export const EndMill = make(
  <>
    <rect x="10" y="2" width="4" height="8" rx="1" />
    <path d="M9 10h6v10.5a1.5 1.5 0 0 1-1.5 1.5h-3A1.5 1.5 0 0 1 9 20.5z" />
    <path d="M9 12.5l6 2.5M9 16.5l6 2.5" />
  </>,
);

/** ড্রিল বিট (টুইস্ট) */
export const DrillBit = make(
  <>
    <rect x="10.5" y="2" width="3" height="7" rx="0.5" />
    <path d="M10.5 9h3v10l-1.5 3-1.5-3z" />
    <path d="M10.5 11.5l3 2M10.5 15l3 2" />
  </>,
);

/** সার্কুলার / উড ব্লেড (দাঁতওয়ালা চাকতি) */
export const CircularBlade = make(
  <>
    <path d="M12 4L15.5 2.6L15.5 4.8L19.2 5.1L18.3 7L21.5 8.9L19.8 10.2L21.9 13.3L19.8 13.8L20.3 17.5L18.3 17L17.1 20.6L15.5 19.2L12.9 22L12 20L8.5 21.4L8.5 19.2L4.8 18.9L5.7 17L2.5 15.1L4.2 13.8L2.1 10.7L4.2 10.2L3.7 6.5L5.7 7L6.9 3.4L8.5 4.8L11.1 2Z" />
    <circle cx="12" cy="12" r="2.5" />
  </>,
);

/** ডায়মন্ড ডিস্ক / হুইল (খাঁজ কাটা সেগমেন্ট) */
export const DiamondDisc = make(
  <>
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="12" r="7" />
    <circle cx="12" cy="12" r="2" />
    <path d="M18.5 14.7L21.2 15.8M14.7 18.5L15.8 21.2M9.3 18.5L8.2 21.2M5.5 14.7L2.8 15.8M5.5 9.3L2.8 8.2M9.3 5.5L8.2 2.8M14.7 5.5L15.8 2.8M18.5 9.3L21.2 8.2" />
  </>,
);

/** ফ্ল্যাপ ডিস্ক (একটার ওপর একটা পাতা) */
export const FlapDisc = make(
  <>
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="12" r="2.5" />
    <path d="M12 2c2 3 2 5.5 0 7.5M20.7 7c-3.4.3-5.3 1.7-6.2 4M20.7 17c-2.1-2.6-4.1-3.4-6.3-3M12 22c-1.6-3.1-1.6-5.4.1-7.5M3.3 17c3.3-.6 5.1-2 5.9-4.4M3.3 7c2.3 2.5 4.3 3.3 6.4 2.9" />
  </>,
);

/** জিক স ব্লেড */
export const JigsawBlade = make(
  <>
    <path d="M9 2h6v4H9z" />
    <path d="M14 6v13l-2 3-2-2.5 1-1.5-1-1.5 1-1.5-1-1.5 1-1.5-1-1.5 1-1.5-1-1.5V6" />
  </>,
);

/** হোল স (কাপের মতো, নিচে দাঁত) */
export const HoleSaw = make(
  <>
    <path d="M12 9V2M10 4.5h4" />
    <path d="M5 19V9h14v10" />
    <path d="M5 19l1.4 2 1.4-2 1.4 2 1.4-2 1.4 2 1.4-2 1.4 2 1.4-2 1.4 2 1.4-2" />
  </>,
);

/** বেয়ারিং (ভেতরে বল) */
export const Bearing = make(
  <>
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="19" cy="12" r="1.2" />
    <circle cx="16.9" cy="16.9" r="1.2" />
    <circle cx="12" cy="19" r="1.2" />
    <circle cx="7.1" cy="16.9" r="1.2" />
    <circle cx="5" cy="12" r="1.2" />
    <circle cx="7.1" cy="7.1" r="1.2" />
    <circle cx="12" cy="5" r="1.2" />
    <circle cx="16.9" cy="7.1" r="1.2" />
  </>,
);

/** প্লেনার / রানদা ব্লেড */
export const PlanerBlade = make(
  <>
    <rect x="2" y="7" width="20" height="6" rx="1" />
    <path d="M2 13l2 4h16l2-4" />
    <circle cx="8" cy="10" r="1" />
    <circle cx="16" cy="10" r="1" />
  </>,
);

/** বাটাল / চিজেল */
export const Chisel = make(
  <>
    <path d="M15 3l6 6-2.5 2.5-6-6z" />
    <path d="M12.5 8.5l3 3L7 20H4v-3z" />
  </>,
);

/** স্যান্ড পেপার (দানাদার কাগজ) */
export const Sandpaper = make(
  <>
    <path d="M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12l-4 4H6a2 2 0 0 1-2-2z" />
    <path d="M16 21v-3a1 1 0 0 1 1-1h3" />
    <path d="M8 7h.01M12 7h.01M16 7h.01M10 10h.01M14 10h.01M8 13h.01M12 13h.01M10 16h.01" />
  </>,
);

/** মাটাম / ট্রাই স্কয়ার */
export const TrySquare = make(
  <>
    <path d="M3 3h5v13h13v5H3z" />
    <path d="M12 16v2M16 16v2M8 8H6M8 12H6" />
  </>,
);

/** সিএনসি মেশিন (গ্যান্ট্রি) */
export const CncMachine = make(
  <>
    <rect x="2" y="17" width="20" height="4" rx="1" />
    <path d="M5 17V5M19 17V5M4 5h16" />
    <rect x="10" y="5" width="4" height="6" rx="1" />
    <path d="M12 11v3M11 14h2" />
  </>,
);

/** ট্রিমার / রাউটার মেশিন (হাতে ধরা) */
export const RouterMachine = make(
  <>
    <rect x="8" y="2" width="8" height="12" rx="2" />
    <path d="M10 5.5h4M10 8.5h4" />
    <path d="M5 14h14v3H5z" />
    <path d="M12 17v4" />
  </>,
);

/** কলেট / কাপলিং */
export const Collet = make(
  <>
    <path d="M7 3h10l-1.5 18h-7z" />
    <path d="M10 3v8M14 3v8" />
    <path d="M7.8 13h8.4" />
  </>,
);

/** এয়ার / ইলেকট্রিক স্ক্রু ড্রাইভার */
export const ScrewDriver = make(
  <>
    <rect x="9" y="2" width="6" height="8" rx="2" />
    <path d="M10.5 10h3v2h-3z" />
    <path d="M12 12v7" />
    <path d="M11 19h2l-1 3z" />
  </>,
);

/** নেইল / শুটার মেশিন */
export const NailGun = make(
  <>
    <path d="M2 6h15a3 3 0 0 1 3 3v2H2z" />
    <path d="M13 11l-1 9h3.5l1-9" />
    <path d="M2 11v3h4" />
    <path d="M20 8h2" />
  </>,
);

/** ব্লোয়ার */
export const Blower = make(
  <>
    <circle cx="9" cy="14" r="6" />
    <path d="M9 8h12v5h-6" />
    <path d="M9 11a3 3 0 1 1-3 3" />
  </>,
);

/** ডাস্ট কালেক্টর (ড্রাম + ব্যাগ) */
export const DustCollector = make(
  <>
    <path d="M7 9c0-3.5 2.2-7 5-7s5 3.5 5 7" />
    <rect x="6" y="9" width="12" height="12" rx="1" />
    <path d="M18 14h4" />
    <path d="M9 21v1M15 21v1" />
  </>,
);

/** কাঠের তক্তা */
export const WoodPlank = make(
  <>
    <rect x="2" y="7" width="20" height="10" rx="1" />
    <path d="M5 11c3-1.5 6 1.5 9 0s4-1 6 0M5 14c2.5 1 5-1 8 0" />
    <circle cx="17" cy="14" r="1" />
  </>,
);

/** খুচরা যন্ত্রাংশ (নাট + বোল্ট) */
export const SpareParts = make(
  <>
    <path d="M7 2l4 2.3v4.6L7 11.2 3 8.9V4.3z" />
    <circle cx="7" cy="6.6" r="1.5" />
    <path d="M15 12h4v2.5h-4z" />
    <path d="M16 14.5V22M18 14.5V22M16 17h2M16 19.5h2" />
  </>,
);

/** ফিঙ্গার / জয়েন্টার বিট (কয়েকটা দাঁত একসাথে) */
export const FingerBit = make(
  <>
    <rect x="10" y="2" width="4" height="7" rx="1" />
    <path d="M7 9h10v13H7z" />
    <path d="M7 12h3M7 15h3M7 18h3M14 12h3M14 15h3M14 18h3" />
  </>,
);

export const SHOP_ICONS = {
  RouterBit,
  StraightBit,
  VBit,
  BallNoseBit,
  EndMill,
  FingerBit,
  DrillBit,
  CircularBlade,
  DiamondDisc,
  FlapDisc,
  JigsawBlade,
  HoleSaw,
  Bearing,
  PlanerBlade,
  Chisel,
  Sandpaper,
  TrySquare,
  CncMachine,
  RouterMachine,
  Collet,
  ScrewDriver,
  NailGun,
  Blower,
  DustCollector,
  WoodPlank,
  SpareParts,
};
