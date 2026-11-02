import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, ApiError, onUnauthorized, setApiToken } from "./api";
import { DEFAULT_CATEGORIES } from "./constants";
import { db, getMeta, requestPersistentStorage, setMeta } from "./db";
import { seedDefaultCategories, setOpsUser } from "./ops";
import { startSync, stopSync, syncNow } from "./sync";
import type { LocalUser, PublicUser, Session } from "./types";

type Status = "loading" | "setup" | "login" | "ready";

interface AuthCtx {
  status: Status;
  user: PublicUser | null;
  isOwner: boolean;
  /** লগইন থাকা অবস্থায় সার্ভার টোকেন বাতিল করলে */
  expired: boolean;
  login: (u: PublicUser, pin: string) => Promise<void>;
  setup: (shopName: string, ownerName: string, pin: string) => Promise<void>;
  logout: () => Promise<void>;
  listUsers: () => Promise<{ users: PublicUser[]; offline: boolean }>;
  /** পিন/পাসওয়ার্ড বদলালে এই ডিভাইসের অফলাইন লগইন কপি ঠিক করা (null = মুছে ফেলা) */
  updateLocalSecret: (userId: string, secret: string | null) => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);
const enc = new TextEncoder();

async function localHash(pin: string, salt: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: enc.encode(salt), iterations: 100_000 },
    key,
    256,
  );
  return btoa(String.fromCharCode(...new Uint8Array(bits)));
}

function randomSalt(): string {
  return btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [user, setUser] = useState<PublicUser | null>(null);
  const [expired, setExpired] = useState(false);

  const activate = useCallback(async (s: Session) => {
    await setMeta("session", s);
    setApiToken(s.token);
    setOpsUser(s.user);
    setUser(s.user);
    setExpired(false);
    setStatus("ready");
    startSync();
  }, []);

  useEffect(() => {
    void requestPersistentStorage();
    const off = onUnauthorized(() => {
      setExpired(true);
      stopSync();
      setStatus("login");
    });
    (async () => {
      const s = await getMeta<Session>("session");
      if (s?.token) {
        await activate(s);
        // অনলাইনে থাকলে টোকেন নবায়ন
        api<{ user: PublicUser; token: string }>("/auth/me")
          .then((r) => activate({ token: r.token, user: r.user }))
          .catch(() => undefined);
        return;
      }
      try {
        const r = await api<{ needsSetup: boolean }>("/auth/status");
        setStatus(r.needsSetup ? "setup" : "login");
      } catch {
        setStatus("login");
      }
    })();
    return off;
  }, [activate]);

  const rememberLocally = useCallback(async (u: PublicUser, pin: string, token: string) => {
    const salt = randomSalt();
    const row: LocalUser = { id: u.id, name: u.name, role: u.role, salt, hash: await localHash(pin, salt), token };
    await db.local_users.put(row);
  }, []);

  const login = useCallback(
    async (u: PublicUser, pin: string) => {
      try {
        const r = await api<{ token: string; user: PublicUser }>("/auth/login", { method: "POST", json: { userId: u.id, pin } });
        await rememberLocally(r.user, pin, r.token);
        await activate(r);
      } catch (e) {
        // নেট না থাকলে এই ডিভাইসে আগে লগইন করা ইউজার অফলাইনে ঢুকতে পারবে
        if (e instanceof ApiError && e.status === 0) {
          const local = await db.local_users.get(u.id);
          if (!local) throw new Error("প্রথমবার লগইনের জন্য ইন্টারনেট লাগবে");
          if ((await localHash(pin, local.salt)) !== local.hash) throw new Error("পিন/পাসওয়ার্ড ভুল হয়েছে");
          await activate({ token: local.token, user: { id: local.id, name: local.name, role: local.role } });
          return;
        }
        throw e;
      }
    },
    [activate, rememberLocally],
  );

  const setup = useCallback(
    async (shopName: string, ownerName: string, pin: string) => {
      const r = await api<{ token: string; user: PublicUser }>("/auth/setup", { method: "POST", json: { shopName, ownerName, pin } });
      await rememberLocally(r.user, pin, r.token);
      await activate(r);
      await syncNow();
      await seedDefaultCategories(DEFAULT_CATEGORIES);
    },
    [activate, rememberLocally],
  );

  const logout = useCallback(async () => {
    // বের হওয়ার আগে জমে থাকা এন্ট্রি পাঠানোর চেষ্টা
    await syncNow().catch(() => undefined);
    stopSync();
    await db.meta.delete("session");
    setApiToken(null);
    setOpsUser(null);
    setUser(null);
    setStatus("login");
  }, []);

  const listUsers = useCallback(async () => {
    try {
      const r = await api<{ users: PublicUser[] }>("/auth/users", { timeoutMs: 8000 });
      return { users: r.users, offline: false };
    } catch {
      const local = await db.local_users.toArray();
      return { users: local.map(({ id, name, role }) => ({ id, name, role })), offline: true };
    }
  }, []);

  const updateLocalSecret = useCallback(async (userId: string, secret: string | null) => {
    const row = await db.local_users.get(userId);
    if (!row) return;
    if (secret === null) {
      await db.local_users.delete(userId);
      return;
    }
    const salt = randomSalt();
    await db.local_users.put({ ...row, salt, hash: await localHash(secret, salt) });
  }, []);

  const value = useMemo<AuthCtx>(
    () => ({ status, user, isOwner: user?.role === "owner", expired, login, setup, logout, listUsers, updateLocalSecret }),
    [status, user, expired, login, setup, logout, listUsers, updateLocalSecret],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used inside AuthProvider");
  return v;
}
