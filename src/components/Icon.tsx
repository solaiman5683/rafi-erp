import {
  Bath,
  Bolt,
  Box,
  BrickWall,
  Cable,
  Coffee,
  Cog,
  Construction,
  Cylinder,
  Drill,
  Droplets,
  Fan,
  Flame,
  Fuel,
  Gauge,
  Hammer,
  HardHat,
  Layers,
  Lightbulb,
  Lock,
  Package,
  PaintBucket,
  Paintbrush,
  Pickaxe,
  Plug,
  Receipt,
  Ruler,
  Scissors,
  Shovel,
  ShowerHead,
  Smartphone,
  Store,
  Truck,
  Users,
  Wrench,
  Zap,
  type LucideIcon,
  type LucideProps,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  Bath, Bolt, Box, BrickWall, Cable, Coffee, Cog, Construction, Cylinder, Drill, Droplets, Fan, Flame, Fuel, Gauge,
  Hammer, HardHat, Layers, Lightbulb, Lock, Package, PaintBucket, Paintbrush, Pickaxe, Plug, Receipt, Ruler,
  Scissors, Shovel, ShowerHead, Smartphone, Store, Truck, Users, Wrench, Zap,
};

/** নাম দিয়ে আইকন (ক্যাটাগরি ও খরচের জন্য) */
export function NamedIcon({ name, ...props }: { name?: string } & LucideProps) {
  const C = (name && ICONS[name]) || Package;
  return <C {...props} />;
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
