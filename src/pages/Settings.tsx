import { useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { toast } from "sonner";
import {
  Database,
  Download,
  KeyRound,
  Languages,
  LogOut,
  Pencil,
  RefreshCw,
  Save,
  Settings as SettingsIcon,
  ShieldCheck,
  Sparkles,
  Store,
  Upload,
  UserPlus,
  UserRound,
  Users,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmAction, Field, PageHeader } from "@/components/common";
import { NumInput } from "@/components/NumInput";
import { Chips } from "@/components/PartyForms";
import { DEFAULT_LOW_STOCK } from "@/lib/constants";
import { isValidSecret, SecretInput } from "@/components/SecretInput";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { exportBackup, importBackup } from "@/lib/backup";
import { db, getMeta } from "@/lib/db";
import { seedDemo } from "@/lib/demo";
import { usePendingCount, useSettings } from "@/lib/hooks";
import { useI18n } from "@/lib/i18n";
import { deviceCode, rebuildDerived, saveSettings } from "@/lib/ops";
import { resetSyncCursor, syncNow, useSyncState } from "@/lib/sync";
import type { Role, Settings } from "@/lib/types";

export default function SettingsPage() {
  const { L } = useI18n();
  const { isOwner, logout, user } = useAuth();
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader icon={SettingsIcon} color="#475569" title={L("সেটিংস", "Settings")} subtitle={`${user?.name} · ${isOwner ? L("মালিক", "Owner") : L("স্টাফ", "Staff")}`} />
      <div className="grid gap-5">
        {isOwner && <ShopCard />}
        <LanguageCard />
        {isOwner && <UsersCard />}
        <DataCard />
        <Button variant="outline" size="lg" className="text-red-600" onClick={() => void logout()}>
          <LogOut /> {L("লগআউট", "Log out")}
        </Button>
      </div>
    </div>
  );
}

function ShopCard() {
  const { L } = useI18n();
  const settings = useSettings();
  const [f, setF] = useState<Partial<Settings>>({});
  useEffect(() => {
    if (settings) setF(settings);
  }, [settings]);
  const set = (k: keyof Settings, v: string) => setF((p) => ({ ...p, [k]: v }));
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Store className="size-5 text-emerald-600" /> {L("দোকানের তথ্য (মেমোতে ছাপা হবে)", "Shop info (printed on memo)")}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <Field label={L("দোকানের নাম", "Shop name")}>
          <Input value={f.shop_name ?? ""} onChange={(e) => set("shop_name", e.target.value)} />
        </Field>
        <Field label={L("কী বিক্রি হয় (এক লাইনে)", "Tagline")}>
          <Input value={f.tagline ?? ""} onChange={(e) => set("tagline", e.target.value)} placeholder={L("যেমন: সকল প্রকার হার্ডওয়্যার, পাইপ ও স্যানিটারি সামগ্রী বিক্রেতা", "e.g. All kinds of hardware & sanitary")} />
        </Field>
        <Field label={L("ঠিকানা", "Address")}>
          <Input value={f.address ?? ""} onChange={(e) => set("address", e.target.value)} placeholder={L("যেমন: 123, নবাবপুর রোড, ঢাকা-1100", "e.g. 123 Nawabpur Road, Dhaka-1100")} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={L("মোবাইল", "Phone")}>
            <Input value={f.phone ?? ""} onChange={(e) => set("phone", e.target.value)} />
          </Field>
          <Field label={L("আরেকটি মোবাইল", "Phone 2")}>
            <Input value={f.phone2 ?? ""} onChange={(e) => set("phone2", e.target.value)} />
          </Field>
        </div>
        <Field label={L("মেমোর নিচের লেখা", "Memo footer note")}>
          <Textarea rows={2} value={f.invoice_note ?? ""} onChange={(e) => set("invoice_note", e.target.value)} placeholder={L("যেমন: বিক্রিত মাল ফেরত নেওয়া হয় না। ধন্যবাদ।", "e.g. Thank you for your business")} />
        </Field>
        <Field label={L("কম স্টক সতর্কতা (সব পণ্যের জন্য)", "Low stock alert (all products)")} hint={L("স্টক এই সংখ্যা বা তার কম হলে লাল দেখাবে", "Shown in red when stock is at or below this")}>
          <NumInput className="max-w-40" value={f.low_stock ?? DEFAULT_LOW_STOCK} allowEmpty={false} onValueChange={(n) => setF((p) => ({ ...p, low_stock: Math.max(0, n) }))} />
        </Field>
        <Field label={L("মেমোর কাগজ", "Memo paper size")}>
          <Chips value={f.paper ?? "A5"} onChange={(v) => setF((p) => ({ ...p, paper: v }))} options={[{ id: "A5", label: "A5" }, { id: "A4", label: "A4" }]} />
        </Field>
        <Button
          size="lg"
          onClick={async () => {
            await saveSettings({ ...f, shop_name: (f.shop_name ?? "").trim() });
            toast.success(L("সেভ হয়েছে", "Saved"));
          }}
        >
          <Save /> {L("সেভ করুন", "Save")}
        </Button>
      </CardContent>
    </Card>
  );
}

function LanguageCard() {
  const { L, lang, setLang } = useI18n();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Languages className="size-5 text-blue-600" /> {L("ভাষা", "Language")}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <Chips value={lang} onChange={setLang} options={[{ id: "bn", label: "বাংলা" }, { id: "en", label: "English" }]} />
      </CardContent>
    </Card>
  );
}

interface UserRow {
  id: string;
  name: string;
  role: Role;
  active: number;
}

function UsersCard() {
  const { L } = useI18n();
  const { user: me, updateLocalSecret } = useAuth();
  const [users, setUsers] = useState<UserRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<{ id?: string; name: string; role: Role; secret: string; secret2: string } | null>(null);
  const [secretFor, setSecretFor] = useState<UserRow | null>(null);
  const [secret, setSecret] = useState("");
  const [secret2, setSecret2] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const r = await api<{ users: UserRow[] }>("/users");
      setUsers(r.users);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    void load();
  }, []);

  const badSecret = () => toast.error(L("পিন/পাসওয়ার্ড কমপক্ষে 4 অক্ষরের হতে হবে", "PIN/password must be at least 4 characters"));
  const mismatch = () => toast.error(L("দুইবার একই পিন/পাসওয়ার্ড দিন", "PIN/passwords don't match"));

  async function saveUser() {
    if (!form) return;
    if (!form.name.trim()) return toast.error(L("নাম লিখুন", "Enter a name"));
    if (!form.id) {
      if (!isValidSecret(form.secret)) return badSecret();
      if (form.secret !== form.secret2) return mismatch();
    }
    setBusy(true);
    try {
      if (form.id) await api(`/users/${form.id}`, { method: "PATCH", json: { name: form.name, role: form.role } });
      else await api("/users", { method: "POST", json: { name: form.name, role: form.role, pin: form.secret } });
      toast.success(L("সেভ হয়েছে", "Saved"));
      setForm(null);
      void load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function openSecret(u: UserRow) {
    setSecretFor(u);
    setSecret("");
    setSecret2("");
  }

  async function saveSecret() {
    if (!secretFor) return;
    if (!isValidSecret(secret)) return badSecret();
    if (secret !== secret2) return mismatch();
    setBusy(true);
    try {
      await api(`/users/${secretFor.id}`, { method: "PATCH", json: { pin: secret } });
      // নিজের হলে এই ডিভাইসের অফলাইন লগইনও নতুনটায়; অন্যের হলে পুরনোটা মুছে দিই
      await updateLocalSecret(secretFor.id, secretFor.id === me?.id ? secret : null);
      toast.success(L(`${secretFor.name}-এর পিন/পাসওয়ার্ড বদলানো হয়েছে`, `PIN/password changed for ${secretFor.name}`));
      setSecretFor(null);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Users className="size-5 text-violet-600" /> {L("ইউজার ও পাসওয়ার্ড", "Users & passwords")}
        </CardTitle>
        <Button size="sm" onClick={() => setForm({ name: "", role: "staff", secret: "", secret2: "" })} disabled={!!error}>
          <UserPlus /> {L("নতুন ইউজার", "Add user")}
        </Button>
      </CardHeader>
      <CardContent className="grid gap-2">
        {error && <p className="rounded-xl bg-amber-50 p-3 text-amber-900">{L("ইউজার দেখতে ইন্টারনেট লাগবে", "Internet needed to manage users")}</p>}
        {users?.map((u) => (
          <div key={u.id} className="flex flex-wrap items-center gap-3 rounded-xl border p-3">
            <span className={`grid size-10 place-items-center rounded-full ${u.role === "owner" ? "bg-emerald-100 text-emerald-700" : "bg-violet-100 text-violet-700"}`}>
              <UserRound className="size-5" />
            </span>
            <div className="min-w-40 flex-1">
              <p className="font-semibold">
                {u.name} {u.id === me?.id && <span className="text-sm text-muted-foreground">({L("আপনি", "you")})</span>}
              </p>
              <p className="text-sm text-muted-foreground">
                {u.role === "owner" ? L("মালিক — সব দেখতে পারবে", "Owner — full access") : L("স্টাফ — কেনা দাম, লাভ, রিপোর্ট দেখবে না", "Staff — no cost, profit or reports")}
                {!u.active && ` · ${L("বন্ধ", "disabled")}`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => openSecret(u)}>
                <KeyRound /> {L("পিন/পাসওয়ার্ড বদলান", "Change PIN/password")}
              </Button>
              <Button variant="outline" size="icon-sm" onClick={() => setForm({ id: u.id, name: u.name, role: u.role, secret: "", secret2: "" })} aria-label={L("এডিট", "Edit")}>
                <Pencil />
              </Button>
              {u.id !== me?.id && (
                <Switch
                  checked={!!u.active}
                  onCheckedChange={async (v) => {
                    await api(`/users/${u.id}`, { method: "PATCH", json: { active: v } }).catch((e) => toast.error(e.message));
                    void load();
                  }}
                  aria-label="active"
                />
              )}
            </div>
          </div>
        ))}
      </CardContent>

      <Dialog open={!!form} onOpenChange={(v) => !v && setForm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-xl">{form?.id ? L("ইউজার এডিট", "Edit user") : L("নতুন ইউজার", "New user")}</DialogTitle>
          </DialogHeader>
          {form && (
            <form id="user-form" className="grid gap-4" onSubmit={(e) => (e.preventDefault(), void saveUser())}>
              <Field label={L("নাম", "Name")}>
                <Input autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </Field>
              <Field label={L("ভূমিকা", "Role")}>
                <Chips value={form.role} onChange={(v) => setForm({ ...form, role: v })} options={[{ id: "staff", label: L("স্টাফ / সেলসম্যান", "Staff") }, { id: "owner", label: L("মালিক", "Owner") }]} />
              </Field>
              {!form.id && (
                <>
                  <Field label={L("পিন বা পাসওয়ার্ড", "PIN or password")} hint={L("কমপক্ষে 4 অক্ষর — সংখ্যা বা অক্ষর দুটোই চলবে", "At least 4 characters — digits or letters")}>
                    <SecretInput value={form.secret} onChange={(e) => setForm({ ...form, secret: e.target.value })} autoComplete="new-password" />
                  </Field>
                  <Field label={L("আবার একই পিন/পাসওয়ার্ড", "Repeat PIN/password")}>
                    <SecretInput value={form.secret2} onChange={(e) => setForm({ ...form, secret2: e.target.value })} autoComplete="new-password" />
                  </Field>
                </>
              )}
            </form>
          )}
          <DialogFooter>
            <Button type="submit" form="user-form" size="lg" className="w-full" disabled={busy}>
              <Save /> {L("সেভ করুন", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!secretFor} onOpenChange={(v) => !v && setSecretFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <KeyRound className="size-6 text-amber-600" /> {L("পিন/পাসওয়ার্ড বদলান", "Change PIN/password")}
            </DialogTitle>
            <p className="text-muted-foreground">{secretFor?.name}</p>
          </DialogHeader>
          <form id="secret-form" className="grid gap-4" onSubmit={(e) => (e.preventDefault(), void saveSecret())}>
            <Field label={L("নতুন পিন বা পাসওয়ার্ড", "New PIN or password")} hint={L("কমপক্ষে 4 অক্ষর — সংখ্যা বা অক্ষর দুটোই চলবে", "At least 4 characters — digits or letters")}>
              <SecretInput autoFocus value={secret} onChange={(e) => setSecret(e.target.value)} autoComplete="new-password" />
            </Field>
            <Field label={L("আবার একই পিন/পাসওয়ার্ড", "Repeat PIN/password")}>
              <SecretInput value={secret2} onChange={(e) => setSecret2(e.target.value)} autoComplete="new-password" />
            </Field>
          </form>
          <DialogFooter>
            <Button type="submit" form="secret-form" size="lg" className="w-full" disabled={busy}>
              <KeyRound /> {L("বদলান", "Change")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function DataCard() {
  const { L, num, time } = useI18n();
  const { isOwner } = useAuth();
  const sync = useSyncState();
  const pending = usePendingCount();
  const fileRef = useRef<HTMLInputElement>(null);
  const [code, setCode] = useState("");
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const productCount = useLiveQuery(() => db.products.count(), []) ?? 0;
  const lastSeq = useLiveQuery(() => getMeta<number>("sync.lastSeq"), []);

  useEffect(() => {
    void deviceCode().then(setCode);
    void navigator.storage?.persisted?.().then(setPersisted);
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="size-5 text-teal-600" /> {L("ডাটা, সিঙ্ক ও ব্যাকআপ", "Data, sync & backup")}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-2 rounded-2xl bg-muted/60 p-4 text-base sm:grid-cols-2">
          <p>
            {L("অবস্থা", "Status")}: <b>{sync.online ? L("অনলাইন", "Online") : L("অফলাইন", "Offline")}</b>
          </p>
          <p>
            {L("পাঠানো বাকি", "Waiting to send")}: <b className="tabular">{num(pending)}</b>
          </p>
          <p>
            {L("শেষ সিঙ্ক", "Last sync")}: <b>{sync.lastSync ? time(sync.lastSync) : "—"}</b>
          </p>
          <p>
            {L("এই ডিভাইসের কোড", "Device code")}: <b>{code}</b>
          </p>
          <p className="flex items-center gap-1 sm:col-span-2">
            <ShieldCheck className={persisted ? "size-4 text-emerald-600" : "size-4 text-amber-600"} />
            {persisted
              ? L("ব্রাউজার এই ডাটা নিজে থেকে মুছবে না", "Browser will keep this data permanently")
              : L("স্থায়ী স্টোরেজ চালু হয়নি — অ্যাপটি ইনস্টল করে নিন (Add to Home screen)", "Persistent storage off — install the app for safety")}
          </p>
          {sync.error && sync.phase === "error" && <p className="text-red-600 sm:col-span-2">{sync.error}</p>}
          {lastSeq !== undefined && <p className="text-xs text-muted-foreground sm:col-span-2">seq {lastSeq ?? 0}</p>}
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <Button size="lg" onClick={() => void syncNow().then(() => toast.success(L("সিঙ্ক শেষ", "Sync done")))}>
            <RefreshCw /> {L("এখনই সিঙ্ক করুন", "Sync now")}
          </Button>
          <Button size="lg" variant="outline" onClick={() => void exportBackup()}>
            <Download /> {L("ব্যাকআপ ফাইল নামান", "Download backup")}
          </Button>
          {isOwner && (
            <>
              <Button size="lg" variant="outline" onClick={() => fileRef.current?.click()} disabled={busy}>
                <Upload /> {L("ব্যাকআপ থেকে ফেরত আনুন", "Restore from backup")}
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (!f) return;
                  setBusy(true);
                  try {
                    const n = await importBackup(f);
                    toast.success(L(`${num(n)}টি এন্ট্রি ফেরত আনা হয়েছে`, `${num(n)} records restored`));
                  } catch (err) {
                    toast.error((err as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              />
            </>
          )}
          <ConfirmAction
            title={L("হিসাব আবার মেলাবেন?", "Recalculate totals?")}
            description={L("স্টক, বাকি ও ক্যাশ সব এন্ট্রি থেকে নতুন করে হিসাব হবে। কোনো ডাটা মুছবে না।", "Stock, dues and cash will be recalculated from all entries. Nothing is deleted.")}
            onConfirm={async () => {
              await rebuildDerived();
              toast.success(L("হিসাব মিলানো হয়েছে", "Recalculated"));
            }}
            trigger={
              <Button size="lg" variant="outline">
                <Wrench /> {L("হিসাব আবার মেলান", "Recalculate")}
              </Button>
            }
          />
          <ConfirmAction
            title={L("সার্ভার থেকে সব ডাটা আবার নামাবেন?", "Re-download everything?")}
            description={L("এই ডিভাইসের কোনো এন্ট্রি হারাবে না।", "Nothing on this device will be lost.")}
            onConfirm={async () => {
              await resetSyncCursor();
              await syncNow();
              await rebuildDerived();
              toast.success(L("সম্পূর্ণ সিঙ্ক শেষ", "Full sync done"));
            }}
            trigger={
              <Button size="lg" variant="outline">
                <RefreshCw /> {L("পুরো ডাটা আবার নামান", "Full re-sync")}
              </Button>
            }
          />
          {isOwner && productCount === 0 && (
            <Button
              size="lg"
              variant="secondary"
              className="sm:col-span-2"
              onClick={async () => {
                await seedDemo();
                toast.success(L("নমুনা পণ্য যোগ হয়েছে", "Sample products added"));
              }}
            >
              <Sparkles /> {L("নমুনা পণ্য দিয়ে চেষ্টা করুন", "Try with sample products")}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
