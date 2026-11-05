import { useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router";
import { Languages, LogOut, Menu, UserRound, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { BRAND, BrandMark } from "@/components/Brand";
import { useAuth } from "@/lib/auth";
import { useSettings } from "@/lib/hooks";
import { useI18n } from "@/lib/i18n";
import { useSyncState } from "@/lib/sync";
import { cn } from "@/lib/utils";
import { NAV } from "./nav";
import { SyncBadge } from "./SyncBadge";

function Logo({ name }: { name?: string }) {
  const { lang } = useI18n();
  return (
    // লোগো বা নামে চাপ দিলে হোম পেজে
    <Link to="/" className="flex min-w-0 items-center gap-2.5 rounded-xl" aria-label="Home">
      <BrandMark />
      <span className="truncate text-lg leading-tight font-bold">{name || (lang === "bn" ? BRAND.bn : BRAND.en)}</span>
    </Link>
  );
}

export function AppShell() {
  const { L, B, lang, setLang } = useI18n();
  const { user, isOwner, logout } = useAuth();
  const settings = useSettings();
  const sync = useSyncState();
  const [moreOpen, setMoreOpen] = useState(false);
  const loc = useLocation();
  const items = NAV.filter((n) => isOwner || !n.ownerOnly);
  const mobileItems = items.filter((n) => n.mobile);

  const isActive = (to: string) => (to === "/" ? loc.pathname === "/" : loc.pathname.startsWith(to));

  return (
    <div className="min-h-dvh lg:pl-64">
      {/* ডেস্কটপ সাইডবার */}
      <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r bg-sidebar lg:flex">
        <div className="flex h-16 items-center border-b px-4">
          <Logo name={settings?.shop_name} />
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {items.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === "/"}
              className={({ isActive: a }) =>
                cn(
                  "flex h-12 items-center gap-3 rounded-xl px-2 text-[15px] font-semibold transition",
                  a ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-xs ring-1 ring-primary/15" : "text-foreground/75 hover:bg-muted",
                )
              }
            >
              <span className="grid size-9 place-items-center rounded-lg text-white" style={{ backgroundColor: n.color }}>
                <n.icon className="size-5" strokeWidth={2.2} />
              </span>
              {B(n.label)}
            </NavLink>
          ))}
        </nav>
        <div className="border-t p-3">
          <div className="flex items-center gap-2 rounded-xl bg-muted/60 p-2">
            <span className="grid size-9 place-items-center rounded-full bg-violet-100 text-violet-700">
              <UserRound className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{user?.name}</p>
              <p className="text-xs text-muted-foreground">{isOwner ? L("মালিক", "Owner") : L("স্টাফ", "Staff")}</p>
            </div>
            <Button variant="ghost" size="icon-sm" onClick={() => void logout()} aria-label="logout">
              <LogOut />
            </Button>
          </div>
        </div>
      </aside>

      {/* উপরের বার */}
      <header className="no-print sticky top-0 z-20 flex h-16 items-center gap-2 border-b bg-white/90 px-4 backdrop-blur lg:px-6">
        <div className="min-w-0 flex-1 lg:hidden">
          <Logo name={settings?.shop_name} />
        </div>
        <div className="hidden flex-1 lg:block" />
        <SyncBadge />
        <Button variant="outline" size="sm" onClick={() => setLang(lang === "bn" ? "en" : "bn")} className="font-bold">
          <Languages /> {lang === "bn" ? "EN" : "বাং"}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon-sm" className="lg:hidden" aria-label="user">
              <UserRound />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel>
              {user?.name} · {isOwner ? L("মালিক", "Owner") : L("স্টাফ", "Staff")}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => void logout()} className="text-base">
              <LogOut /> {L("লগআউট", "Log out")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {!sync.online && (
        <div className="no-print flex items-center justify-center gap-2 bg-amber-100 px-4 py-2 text-center text-sm font-medium text-amber-900">
          <WifiOff className="size-4 shrink-0" />
          {L("ইন্টারনেট নেই — চিন্তা নেই, সব এন্ট্রি এই ডিভাইসে সেভ হচ্ছে। নেট এলে নিজে থেকে সিঙ্ক হবে।", "No internet — everything is saved on this device and will sync automatically.")}
        </div>
      )}

      <main className="mx-auto max-w-7xl px-4 pt-5 pb-28 lg:px-6 lg:pb-10">
        <Outlet />
      </main>

      {/* মোবাইলের নিচের বার */}
      <nav className="no-print fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t bg-white pb-[env(safe-area-inset-bottom)] lg:hidden">
        {mobileItems.slice(0, 4).map((n) => (
          <NavLink key={n.to} to={n.to} end={n.to === "/"} className="flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold">
            <span
              className={cn("grid size-9 place-items-center rounded-xl transition", isActive(n.to) ? "text-white shadow" : "text-foreground/60")}
              style={isActive(n.to) ? { backgroundColor: n.color } : undefined}
            >
              <n.icon className="size-5" />
            </span>
            <span className={cn("truncate", isActive(n.to) ? "text-foreground" : "text-foreground/60")}>{B(n.label).split(" ")[0]}</span>
          </NavLink>
        ))}
        <button type="button" onClick={() => setMoreOpen(true)} className="flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold text-foreground/60">
          <span className="grid size-9 place-items-center rounded-xl">
            <Menu className="size-5" />
          </span>
          {L("আরো", "More")}
        </button>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl pb-[calc(env(safe-area-inset-bottom)+1rem)]">
          <SheetHeader>
            <SheetTitle className="text-xl">{L("সব মেনু", "All menu")}</SheetTitle>
          </SheetHeader>
          <div className="grid grid-cols-3 gap-3 px-4">
            {items.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                onClick={() => setMoreOpen(false)}
                className="flex flex-col items-center gap-2 rounded-2xl border bg-white p-3 text-center text-sm font-semibold"
              >
                <span className="grid size-12 place-items-center rounded-2xl text-white" style={{ backgroundColor: n.color }}>
                  <n.icon className="size-6" />
                </span>
                {B(n.label)}
              </NavLink>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
