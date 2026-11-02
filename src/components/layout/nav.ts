import {
  ChartColumn,
  Boxes,
  Factory,
  LayoutDashboard,
  ReceiptText,
  Settings,
  ShoppingCart,
  Truck,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { BiText } from "@/lib/constants";

export interface NavItem {
  to: string;
  label: BiText;
  icon: LucideIcon;
  color: string;
  ownerOnly?: boolean;
  /** মোবাইলের নিচের বারে দেখাবে */
  mobile?: boolean;
}

export const NAV: NavItem[] = [
  { to: "/", label: ["হোম", "Home"], icon: LayoutDashboard, color: "#0f766e", mobile: true },
  { to: "/sell", label: ["বিক্রি করুন", "Sell"], icon: ShoppingCart, color: "#16a34a", mobile: true },
  { to: "/sales", label: ["বিক্রির খাতা", "Sales"], icon: ReceiptText, color: "#0d9488" },
  { to: "/purchase", label: ["মাল কেনা", "Purchase"], icon: Truck, color: "#2563eb", ownerOnly: true },
  { to: "/products", label: ["পণ্য ও স্টক", "Products"], icon: Boxes, color: "#ea580c", mobile: true },
  { to: "/customers", label: ["কাস্টমার ও বাকি", "Customers"], icon: Users, color: "#7c3aed", mobile: true },
  { to: "/suppliers", label: ["সাপ্লায়ার", "Suppliers"], icon: Factory, color: "#0891b2", ownerOnly: true },
  { to: "/expenses", label: ["খরচ", "Expenses"], icon: Wallet, color: "#e11d48" },
  { to: "/reports", label: ["হিসাব ও রিপোর্ট", "Reports"], icon: ChartColumn, color: "#4f46e5", ownerOnly: true },
  { to: "/settings", label: ["সেটিংস", "Settings"], icon: Settings, color: "#475569" },
];
