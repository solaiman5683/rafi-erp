import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";
import { Loader2, LogIn, ShieldCheck, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BRAND, BrandMark } from "@/components/Brand";
import { Field } from "@/components/common";
import { isValidSecret, SecretInput } from "@/components/SecretInput";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import type { PublicUser } from "@/lib/types";

function Shell({ children }: { children: ReactNode }) {
  const { lang, setLang } = useI18n();
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-teal-50 p-4">
      <button type="button" onClick={() => setLang(lang === "bn" ? "en" : "bn")} className="absolute top-4 right-4 rounded-full border bg-white px-4 py-2 font-bold">
        {lang === "bn" ? "English" : "বাংলা"}
      </button>
      <Card className="w-full max-w-md shadow-xl">
        <CardContent className="p-6 sm:p-8">
          <div className="mb-6 flex flex-col items-center gap-2 text-center">
            <BrandMark className="size-16" />
            <p className="text-2xl font-bold">{lang === "bn" ? BRAND.bn : BRAND.en}</p>
          </div>
          {children}
        </CardContent>
      </Card>
    </div>
  );
}

function SetupForm() {
  const { L } = useI18n();
  const { setup } = useAuth();
  const [shop, setShop] = useState<string>(BRAND.bn);
  const [owner, setOwner] = useState("");
  const [secret, setSecret] = useState("");
  const [secret2, setSecret2] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!shop.trim() || !owner.trim()) return toast.error(L("দোকান ও মালিকের নাম লিখুন", "Enter shop and owner name"));
    if (!isValidSecret(secret)) return toast.error(L("পিন/পাসওয়ার্ড কমপক্ষে 4 অক্ষরের হতে হবে", "PIN/password must be at least 4 characters"));
    if (secret !== secret2) return toast.error(L("দুইবার একই পিন/পাসওয়ার্ড দিন", "PIN/passwords don't match"));
    setBusy(true);
    try {
      await setup(shop.trim(), owner.trim(), secret);
      toast.success(L("স্বাগতম! দোকান সেটআপ হয়ে গেছে", "Welcome! Your shop is ready"));
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="grid gap-4" onSubmit={(e) => void submit(e)}>
      <div className="text-center">
        <h1 className="text-xl font-bold">{L("প্রথমবার সেটআপ", "First-time setup")}</h1>
        <p className="text-muted-foreground">{L("দোকানের তথ্য দিয়ে শুরু করুন", "Start with your shop details")}</p>
      </div>
      <Field label={L("দোকানের নাম", "Shop name")}>
        <Input value={shop} onChange={(e) => setShop(e.target.value)} />
      </Field>
      <Field label={L("মালিকের নাম", "Owner name")}>
        <Input value={owner} onChange={(e) => setOwner(e.target.value)} autoComplete="username" />
      </Field>
      <Field label={L("পিন বা পাসওয়ার্ড", "PIN or password")} hint={L("কমপক্ষে 4 অক্ষর — সংখ্যা বা অক্ষর দুটোই চলবে", "At least 4 characters — digits or letters")}>
        <SecretInput value={secret} onChange={(e) => setSecret(e.target.value)} autoComplete="new-password" />
      </Field>
      <Field label={L("আবার একই পিন/পাসওয়ার্ড", "Repeat PIN/password")}>
        <SecretInput value={secret2} onChange={(e) => setSecret2(e.target.value)} autoComplete="new-password" />
      </Field>
      <Button type="submit" size="lg" className="h-13 text-lg" disabled={busy}>
        {busy ? <Loader2 className="animate-spin" /> : <ShieldCheck />} {L("শুরু করুন", "Get started")}
      </Button>
    </form>
  );
}

function LoginForm() {
  const { L } = useI18n();
  const { login, listUsers, expired } = useAuth();
  const [users, setUsers] = useState<PublicUser[] | null>(null);
  const [offline, setOffline] = useState(false);
  const [userId, setUserId] = useState("");
  const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void listUsers().then((r) => {
      setUsers(r.users);
      setOffline(r.offline);
      if (r.users.length === 1) setUserId(r.users[0].id);
    });
  }, [listUsers]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const user = users?.find((u) => u.id === userId);
    if (!user) return toast.error(L("ইউজার বাছাই করুন", "Choose a user"));
    if (!secret) return toast.error(L("পিন বা পাসওয়ার্ড লিখুন", "Enter PIN or password"));
    setBusy(true);
    try {
      await login(user, secret);
    } catch (err) {
      toast.error((err as Error).message);
      setSecret("");
    } finally {
      setBusy(false);
    }
  }

  if (!users) return <Loader2 className="mx-auto size-8 animate-spin text-primary" />;
  // সার্ভারে কোনো ইউজার নেই (নতুন ডাটাবেস) — সেটআপ দেখাও
  if (!offline && users.length === 0) return <SetupForm />;

  return (
    <form className="grid gap-4" onSubmit={(e) => void submit(e)}>
      <h1 className="text-center text-xl font-bold">{L("লগইন করুন", "Log in")}</h1>
      {expired && <p className="rounded-xl bg-amber-50 p-3 text-center text-amber-900">{L("নিরাপত্তার জন্য আবার লগইন করুন", "Please log in again")}</p>}
      {offline && (
        <p className="flex items-center justify-center gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
          <WifiOff className="size-4 shrink-0" /> {L("ইন্টারনেট নেই — এই ডিভাইসে আগে ঢোকা ইউজাররা ঢুকতে পারবেন", "Offline — users who logged in here before can enter")}
        </p>
      )}
      {users.length === 0 ? (
        <p className="text-center text-muted-foreground">{L("প্রথমবার ঢুকতে ইন্টারনেট লাগবে", "Internet needed for first login")}</p>
      ) : (
        <>
          <Field label={L("ইউজার", "User")}>
            <Select value={userId} onValueChange={setUserId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={L("নাম বাছাই করুন", "Choose your name")} />
              </SelectTrigger>
              <SelectContent>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name} <span className="text-muted-foreground">· {u.role === "owner" ? L("মালিক", "Owner") : L("স্টাফ", "Staff")}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label={L("পিন / পাসওয়ার্ড", "PIN / password")}>
            <SecretInput autoFocus value={secret} onChange={(e) => setSecret(e.target.value)} />
          </Field>
          <Button type="submit" size="lg" className="h-13 text-lg" disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : <LogIn />} {L("লগইন", "Log in")}
          </Button>
        </>
      )}
    </form>
  );
}

export default function LoginPage({ setup }: { setup?: boolean }) {
  return <Shell>{setup ? <SetupForm /> : <LoginForm />}</Shell>;
}
