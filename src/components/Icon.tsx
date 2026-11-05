import type { ComponentType } from "react";
import {
  Axe,
  Banknote,
  Bath,
  Bike,
  Bolt,
  Box,
  Boxes,
  BrickWall,
  Cable,
  Calendar,
  CircleHelp,
  CircuitBoard,
  Coffee,
  Cog,
  Cone,
  Construction,
  Cpu,
  Cylinder,
  Disc3,
  DraftingCompass,
  Drill,
  Droplets,
  Factory,
  Fan,
  FileText,
  Flame,
  Fuel,
  Gauge,
  Gem,
  Gift,
  GlassWater,
  Hammer,
  HandCoins,
  Handshake,
  HardHat,
  Hexagon,
  Landmark,
  Layers,
  Lightbulb,
  LoaderPinwheel,
  Lock,
  Magnet,
  Megaphone,
  Nut,
  Package,
  PaintBucket,
  PaintRoller,
  Paintbrush,
  Percent,
  Pickaxe,
  Plug,
  PlugZap,
  PocketKnife,
  Printer,
  Receipt,
  Ruler,
  Scissors,
  Settings2,
  Shield,
  Shovel,
  ShowerHead,
  Smartphone,
  Sparkles,
  SprayCan,
  Stethoscope,
  Store,
  Toolbox,
  Trash2,
  Truck,
  Users,
  Utensils,
  Wallet,
  Warehouse,
  Wifi,
  Wind,
  Wrench,
  Zap,
  type LucideProps,
} from "lucide-react";
import { SHOP_ICONS } from "@/components/ShopIcons";
import { cn } from "@/lib/utils";

const ICONS: Record<string, ComponentType<LucideProps>> = {
  ...SHOP_ICONS,
  Axe, Banknote, Bath, Bike, Bolt, Box, Boxes, BrickWall, Cable, Calendar, CircleHelp, CircuitBoard, Coffee, Cog, Cone, Construction, Cpu, Cylinder, Disc3, DraftingCompass, Drill, Droplets, Factory, Fan, FileText, Flame, Fuel, Gauge, Gem, Gift, GlassWater, Hammer, HandCoins, Handshake, HardHat, Hexagon, Landmark, Layers, Lightbulb, LoaderPinwheel, Lock, Magnet, Megaphone, Nut, Package, PaintBucket, PaintRoller, Paintbrush, Percent, Pickaxe, Plug, PlugZap, PocketKnife, Printer, Receipt, Ruler, Scissors, Settings2, Shield, Shovel, ShowerHead, Smartphone, Sparkles, SprayCan, Stethoscope, Store, Toolbox, Trash2, Truck, Users, Utensils, Wallet, Warehouse, Wifi, Wind, Wrench, Zap,
};

/** বাছাইয়ের তালিকা — "shop" = দোকানের মাল (আগে), "general" = খরচ ও অন্যান্য */
export const ICON_LIST: { name: string; keywords: string; group: "shop" | "general" }[] = [
  { name: "RouterBit", keywords: "router bit design bit রাউটার বিট ডিজাইন বিট নকশা", group: "shop" },
  { name: "StraightBit", keywords: "straight bit সোজা বিট জমিন", group: "shop" },
  { name: "VBit", keywords: "v bit v groove ভি বিট", group: "shop" },
  { name: "BallNoseBit", keywords: "ball nose ball bit 3d বল বিট গোল", group: "shop" },
  { name: "EndMill", keywords: "end mill cnc bit taper সিএনসি বিট এন্ড মিল", group: "shop" },
  { name: "FingerBit", keywords: "finger joint jointer bit ফিঙ্গার জয়েন্টার বিট", group: "shop" },
  { name: "DrillBit", keywords: "drill bit boring bit ড্রিল বিট বোরিং বিট", group: "shop" },
  { name: "CircularBlade", keywords: "circular blade wood blade saw সার্কুলার ব্লেড উড ব্লেড করাত", group: "shop" },
  { name: "DiamondDisc", keywords: "diamond disk wheel cutting ডায়মন্ড ডিস্ক হুইল", group: "shop" },
  { name: "FlapDisc", keywords: "flap disc velcro grinding ফ্ল্যাপ ডিস্ক ভেলক্রো", group: "shop" },
  { name: "JigsawBlade", keywords: "jigsaw jic saw blade জিক স জিগস ব্লেড", group: "shop" },
  { name: "HoleSaw", keywords: "hole saw cutter হোল স কাটার", group: "shop" },
  { name: "Bearing", keywords: "bearing block bearing বেয়ারিং", group: "shop" },
  { name: "PlanerBlade", keywords: "planer blade randa রানদা প্লেনার ব্লেড", group: "shop" },
  { name: "Chisel", keywords: "chisel সিজেল বাটাল", group: "shop" },
  { name: "Sandpaper", keywords: "sand paper sandpaper স্যান্ড পেপার শিরিষ কাগজ", group: "shop" },
  { name: "TrySquare", keywords: "try square matam মাটাম স্কয়ার", group: "shop" },
  { name: "CncMachine", keywords: "cnc machine সিএনসি মেশিন", group: "shop" },
  { name: "RouterMachine", keywords: "router trimmer machine রাউটার ট্রিমার মেশিন", group: "shop" },
  { name: "Collet", keywords: "collet coupling head কলেট কাপলিং", group: "shop" },
  { name: "ScrewDriver", keywords: "screw driver air screw machine স্ক্রু ড্রাইভার মেশিন", group: "shop" },
  { name: "NailGun", keywords: "nail gun shooter nailing machine নেইল শুটার মেশিন", group: "shop" },
  { name: "Blower", keywords: "blower ব্লোয়ার", group: "shop" },
  { name: "DustCollector", keywords: "dust collector ডাস্ট কালেক্টর", group: "shop" },
  { name: "WoodPlank", keywords: "wood timber plank কাঠ তক্তা", group: "shop" },
  { name: "SpareParts", keywords: "spare parts nut bolt parts স্পেয়ার পার্টস যন্ত্রাংশ", group: "shop" },
  { name: "Drill", keywords: "drill machine ড্রিল মেশিন", group: "shop" },
  { name: "Hammer", keywords: "hammer hand tools হাতুড়ি হ্যান্ড টুলস", group: "shop" },
  { name: "Wrench", keywords: "wrench spanner repair রেঞ্চ স্প্যানার", group: "shop" },
  { name: "Toolbox", keywords: "toolbox tools set টুলবক্স সেট", group: "shop" },
  { name: "Ruler", keywords: "ruler measure scale মাপ স্কেল", group: "shop" },
  { name: "DraftingCompass", keywords: "compass measure কম্পাস", group: "shop" },
  { name: "Scissors", keywords: "cutter scissors কাটার কাঁচি", group: "shop" },
  { name: "PocketKnife", keywords: "knife blade ছুরি", group: "shop" },
  { name: "Axe", keywords: "axe কুড়াল", group: "shop" },
  { name: "Pickaxe", keywords: "pickaxe গাঁইতি", group: "shop" },
  { name: "Shovel", keywords: "shovel কোদাল", group: "shop" },
  { name: "Cog", keywords: "machine gear parts মেশিন গিয়ার", group: "shop" },
  { name: "Settings2", keywords: "parts adjust পার্টস", group: "shop" },
  { name: "Bolt", keywords: "bolt nut বোল্ট নাট", group: "shop" },
  { name: "Nut", keywords: "nut নাট", group: "shop" },
  { name: "Hexagon", keywords: "hex nut হেক্স", group: "shop" },
  { name: "Magnet", keywords: "magnet চুম্বক", group: "shop" },
  { name: "Gem", keywords: "diamond ডায়মন্ড", group: "shop" },
  { name: "Disc3", keywords: "disc wheel ডিস্ক চাকা", group: "shop" },
  { name: "LoaderPinwheel", keywords: "blade wheel ব্লেড", group: "shop" },
  { name: "Fan", keywords: "fan blade পাখা", group: "shop" },
  { name: "Wind", keywords: "blower air বাতাস ব্লোয়ার", group: "shop" },
  { name: "Cpu", keywords: "cnc driver controller চিপ ড্রাইভার", group: "shop" },
  { name: "CircuitBoard", keywords: "circuit board electronic সার্কিট", group: "shop" },
  { name: "Plug", keywords: "plug প্লাগ", group: "shop" },
  { name: "Cable", keywords: "cable wire তার", group: "shop" },
  { name: "Zap", keywords: "electric power বিদ্যুৎ", group: "shop" },
  { name: "Gauge", keywords: "meter gauge মিটার", group: "shop" },
  { name: "Droplets", keywords: "moisture oil water ময়েশ্চার তেল", group: "shop" },
  { name: "Layers", keywords: "sheet layers শিট", group: "shop" },
  { name: "Cylinder", keywords: "cylinder pipe piston সিলিন্ডার পিস্টন", group: "shop" },
  { name: "Cone", keywords: "cone কোন", group: "shop" },
  { name: "PaintRoller", keywords: "paint roller রং রোলার", group: "shop" },
  { name: "Paintbrush", keywords: "brush রং তুলি", group: "shop" },
  { name: "SprayCan", keywords: "spray স্প্রে", group: "shop" },
  { name: "Construction", keywords: "construction নির্মাণ", group: "shop" },
  { name: "HardHat", keywords: "safety helmet হেলমেট", group: "shop" },
  { name: "Factory", keywords: "factory কারখানা", group: "shop" },
  { name: "Box", keywords: "box বক্স", group: "shop" },
  { name: "Package", keywords: "package others অন্যান্য প্যাকেট", group: "shop" },
  { name: "Boxes", keywords: "boxes stock স্টক", group: "shop" },
  { name: "Receipt", keywords: "bill receipt memo বিল রসিদ", group: "general" },
  { name: "Store", keywords: "shop rent দোকান ভাড়া", group: "general" },
  { name: "Warehouse", keywords: "godown warehouse গুদাম", group: "general" },
  { name: "Users", keywords: "staff salary কর্মচারী বেতন", group: "general" },
  { name: "HandCoins", keywords: "salary payment বেতন টাকা", group: "general" },
  { name: "Banknote", keywords: "cash টাকা নগদ", group: "general" },
  { name: "Wallet", keywords: "wallet মানিব্যাগ", group: "general" },
  { name: "Landmark", keywords: "bank ব্যাংক", group: "general" },
  { name: "Percent", keywords: "tax vat ভ্যাট কর", group: "general" },
  { name: "FileText", keywords: "document কাগজ দলিল", group: "general" },
  { name: "Lightbulb", keywords: "electricity light বিদ্যুৎ বাতি", group: "general" },
  { name: "PlugZap", keywords: "electric bill বিদ্যুৎ বিল", group: "general" },
  { name: "Flame", keywords: "gas fire গ্যাস", group: "general" },
  { name: "Fuel", keywords: "fuel petrol তেল পেট্রোল", group: "general" },
  { name: "GlassWater", keywords: "drinking water পানি", group: "general" },
  { name: "Wifi", keywords: "internet ইন্টারনেট", group: "general" },
  { name: "Smartphone", keywords: "mobile recharge মোবাইল রিচার্জ", group: "general" },
  { name: "Printer", keywords: "print প্রিন্ট", group: "general" },
  { name: "Truck", keywords: "transport delivery van গাড়ি ভ্যান পরিবহন", group: "general" },
  { name: "Bike", keywords: "van rickshaw সাইকেল ভ্যান", group: "general" },
  { name: "Coffee", keywords: "tea চা নাস্তা", group: "general" },
  { name: "Utensils", keywords: "food lunch খাবার", group: "general" },
  { name: "Wrench", keywords: "repair মেরামত", group: "general" },
  { name: "Sparkles", keywords: "cleaning পরিষ্কার", group: "general" },
  { name: "Trash2", keywords: "garbage ময়লা", group: "general" },
  { name: "Shield", keywords: "security guard পাহারা", group: "general" },
  { name: "Megaphone", keywords: "advertisement বিজ্ঞাপন", group: "general" },
  { name: "Gift", keywords: "gift donation উপহার দান", group: "general" },
  { name: "Stethoscope", keywords: "medical ডাক্তার চিকিৎসা", group: "general" },
  { name: "Calendar", keywords: "monthly মাসিক", group: "general" },
  { name: "Handshake", keywords: "commission কমিশন", group: "general" },
  { name: "CircleHelp", keywords: "other অন্যান্য", group: "general" },
];

/**
 * আইকনের নাম তিন রকম হতে পারে:
 *  - lucide আইকনের নাম ("Wrench")
 *  - "emoji:🔧" — নিজের পছন্দের ইমোজি
 *  - "img:data:image/…" — নিজের আপলোড করা ছোট ছবি
 */
export function NamedIcon({ name, className, style, ...props }: { name?: string } & LucideProps) {
  if (name?.startsWith("emoji:")) {
    return (
      // ইমোজি আইকনের ঘর যত বড়, তত বড় দেখায়
      <span className={cn("grid place-items-center leading-none", className)} style={{ ...style, containerType: "size" }} aria-hidden>
        <span style={{ fontSize: "88cqh" }}>{name.slice(6)}</span>
      </span>
    );
  }
  if (name?.startsWith("img:")) {
    return <img src={name.slice(4)} alt="" className={cn("object-contain", className)} style={style} draggable={false} />;
  }
  const C = (name && ICONS[name]) || Package;
  return <C className={className} style={style} {...props} />;
}

/** রঙিন গোল আইকন টাইল */
export function IconTile({ name, color, size = "md" }: { name?: string; color?: string; size?: "sm" | "md" | "lg" }) {
  const box = { sm: "size-9 rounded-lg", md: "size-11 rounded-xl", lg: "size-14 rounded-2xl" }[size];
  const icon = { sm: "size-5", md: "size-6", lg: "size-7" }[size];
  return (
    <span className={`${box} grid shrink-0 place-items-center`} style={{ backgroundColor: `${color ?? "#64748b"}1f`, color: color ?? "#64748b" }}>
      <NamedIcon name={name} className={icon} strokeWidth={2.2} />
    </span>
  );
}
