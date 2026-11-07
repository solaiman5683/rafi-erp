import { Hono } from "hono";
import type { Context, Next } from "hono";
import { hashPin, isValidSecret, issueToken, randomB64, readToken, safeEqual } from "./auth";
import { OWNER_ONLY_TABLES, SYNC_TABLES, type PublicUser, type Role, type SyncChange, type SyncTable } from "../shared/tables";

type AppEnv = { Bindings: Env; Variables: { user: PublicUser } };

interface UserRow {
  id: string;
  name: string;
  role: Role;
  pin_hash: string;
  salt: string;
  active: number;
  failed: number;
  locked_until: number;
}

const MAX_FAILED = 5;
const LOCK_MS = 5 * 60 * 1000;
const MAX_PUSH = 500;
const MAX_RECORD_BYTES = 200_000;
/** টাকার এন্ট্রি মোছার অনুমতি শুধু মালিকের */
const OWNER_ONLY_DELETE: readonly string[] = ["sales", "sale_returns", "payments", "expenses"];

const app = new Hono<AppEnv>().basePath("/api");

const err = (c: Context, status: 400 | 401 | 403 | 404 | 409 | 423, code: string, message: string) =>
  c.json({ error: code, message }, status);

const publicUser = (u: Pick<UserRow, "id" | "name" | "role">): PublicUser => ({ id: u.id, name: u.name, role: u.role });

async function userCount(env: Env): Promise<number> {
  const row = await env.DB.prepare("SELECT COUNT(*) AS n FROM users").first<{ n: number }>();
  return row?.n ?? 0;
}

function cleanName(name: unknown): string | null {
  if (typeof name !== "string") return null;
  const n = name.trim().slice(0, 60);
  return n.length ? n : null;
}

// ---------- পাবলিক ----------

app.get("/health", (c) => c.json({ ok: true, time: Date.now() }));

app.get("/auth/status", async (c) => c.json({ needsSetup: (await userCount(c.env)) === 0 }));

app.post("/auth/setup", async (c) => {
  const body = await c.req.json<{ shopName?: string; ownerName?: string; pin?: string }>().catch(() => ({}) as Record<string, never>);
  const shopName = cleanName(body.shopName);
  const ownerName = cleanName(body.ownerName);
  if (!shopName || !ownerName) return err(c, 400, "invalid", "দোকান ও মালিকের নাম দিন");
  if (!isValidSecret(body.pin)) return err(c, 400, "invalid_pin", "পিন/পাসওয়ার্ড 4 থেকে 64 অক্ষরের হতে হবে");
  if ((await userCount(c.env)) > 0) return err(c, 409, "already_setup", "সেটআপ আগেই করা হয়েছে");

  const now = Date.now();
  const id = crypto.randomUUID();
  const salt = randomB64();
  const pinHash = await hashPin(body.pin, salt);
  const settings = { id: "shop", shop_name: shopName, created_at: now, updated_at: now, deleted: 0 };
  await c.env.DB.batch([
    c.env.DB.prepare(
      "INSERT INTO users (id, name, role, pin_hash, salt, active, created_at, updated_at) VALUES (?, ?, 'owner', ?, ?, 1, ?, ?)",
    ).bind(id, ownerName, pinHash, salt, now, now),
    upsertStmt(c.env, { tbl: "settings", id: "shop", data: settings, updated_at: now, deleted: 0 }, id),
  ]);
  const user: PublicUser = { id, name: ownerName, role: "owner" };
  return c.json({ token: await issueToken(c.env, user), user });
});

app.get("/auth/users", async (c) => {
  const { results } = await c.env.DB.prepare("SELECT id, name, role FROM users WHERE active = 1 ORDER BY role DESC, name").all<UserRow>();
  return c.json({ users: results.map(publicUser) });
});

app.post("/auth/login", async (c) => {
  const body = await c.req.json<{ userId?: string; pin?: string }>().catch(() => ({}) as Record<string, never>);
  if (typeof body.userId !== "string" || typeof body.pin !== "string") return err(c, 400, "invalid", "ভুল তথ্য");
  const u = await c.env.DB.prepare("SELECT * FROM users WHERE id = ? AND active = 1").bind(body.userId).first<UserRow>();
  if (!u) return err(c, 401, "bad_login", "ইউজার পাওয়া যায়নি");
  const now = Date.now();
  if (u.locked_until > now) {
    const mins = Math.ceil((u.locked_until - now) / 60000);
    return err(c, 423, "locked", `অনেকবার ভুল পিন/পাসওয়ার্ড। ${mins} মিনিট পরে চেষ্টা করুন`);
  }
  const ok = safeEqual(await hashPin(body.pin, u.salt), u.pin_hash);
  if (!ok) {
    const failed = u.failed + 1;
    const lockedUntil = failed >= MAX_FAILED ? now + LOCK_MS : 0;
    await c.env.DB.prepare("UPDATE users SET failed = ?, locked_until = ? WHERE id = ?")
      .bind(failed >= MAX_FAILED ? 0 : failed, lockedUntil, u.id)
      .run();
    return err(c, 401, "bad_login", "পিন/পাসওয়ার্ড ভুল হয়েছে");
  }
  if (u.failed) await c.env.DB.prepare("UPDATE users SET failed = 0, locked_until = 0 WHERE id = ?").bind(u.id).run();
  const user = publicUser(u);
  return c.json({ token: await issueToken(c.env, user), user });
});

// ---------- লগইন লাগবে ----------

async function requireAuth(c: Context<AppEnv>, next: Next) {
  const header = c.req.header("Authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const payload = token ? await readToken(c.env, token) : null;
  if (!payload) return err(c, 401, "unauthorized", "আবার লগইন করুন");
  const u = await c.env.DB.prepare("SELECT id, name, role, active FROM users WHERE id = ?").bind(payload.sub).first<UserRow>();
  if (!u || !u.active) return err(c, 401, "unauthorized", "এই ইউজার বন্ধ করা হয়েছে");
  c.set("user", publicUser(u));
  await next();
}

async function requireOwner(c: Context<AppEnv>, next: Next) {
  if (c.get("user").role !== "owner") return err(c, 403, "forbidden", "শুধু মালিক এটা করতে পারবেন");
  await next();
}

app.use("/auth/me", requireAuth);
app.use("/users/*", requireAuth, requireOwner);
app.use("/users", requireAuth, requireOwner);
app.use("/sync/*", requireAuth);
app.use("/quotes", requireAuth);

// ---------- কোটেশন শেয়ার ----------

const MAX_QUOTE_BYTES = 100_000;

/** কোটেশন সেভ করে একটা পাবলিক লিংকের id ফেরত দেয় */
app.post("/quotes", async (c) => {
  const user = c.get("user");
  const body = await c.req.json<{ doc?: unknown }>().catch(() => ({}) as { doc?: unknown });
  if (!body.doc || typeof body.doc !== "object") return err(c, 400, "invalid", "ভুল তথ্য");
  const data = JSON.stringify(body.doc);
  if (data.length > MAX_QUOTE_BYTES) return err(c, 400, "too_large", "কোটেশন অনেক বড়");
  const id = crypto.randomUUID();
  await c.env.DB.prepare("INSERT INTO quotes (id, data, created_at, created_by) VALUES (?, ?, ?, ?)").bind(id, data, Date.now(), user.id).run();
  return c.json({ id });
});

/** লিংক থেকে কোটেশন দেখা — লগইন লাগে না */
app.get("/public/quotes/:id", async (c) => {
  const id = c.req.param("id");
  if (!/^[0-9a-f-]{36}$/.test(id)) return err(c, 404, "not_found", "কোটেশন পাওয়া যায়নি");
  const row = await c.env.DB.prepare("SELECT data, created_at FROM quotes WHERE id = ?").bind(id).first<{ data: string; created_at: number }>();
  if (!row) return err(c, 404, "not_found", "কোটেশন পাওয়া যায়নি");
  c.header("Cache-Control", "public, max-age=300");
  return c.json({ doc: JSON.parse(row.data), created_at: row.created_at });
});

app.get("/auth/me", async (c) => {
  const user = c.get("user");
  return c.json({ user, token: await issueToken(c.env, user) });
});

app.get("/users", async (c) => {
  const { results } = await c.env.DB.prepare("SELECT id, name, role, active, created_at FROM users ORDER BY created_at").all();
  return c.json({ users: results });
});

app.post("/users", async (c) => {
  const body = await c.req.json<{ name?: string; role?: Role; pin?: string }>().catch(() => ({}) as Record<string, never>);
  const name = cleanName(body.name);
  if (!name) return err(c, 400, "invalid", "নাম দিন");
  if (!isValidSecret(body.pin)) return err(c, 400, "invalid_pin", "পিন/পাসওয়ার্ড 4 থেকে 64 অক্ষরের হতে হবে");
  const role: Role = body.role === "owner" ? "owner" : "staff";
  const now = Date.now();
  const id = crypto.randomUUID();
  const salt = randomB64();
  await c.env.DB.prepare(
    "INSERT INTO users (id, name, role, pin_hash, salt, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?)",
  )
    .bind(id, name, role, await hashPin(body.pin, salt), salt, now, now)
    .run();
  return c.json({ user: { id, name, role, active: 1, created_at: now } });
});

app.patch("/users/:id", async (c) => {
  const id = c.req.param("id");
  const me = c.get("user");
  const body = await c.req.json<{ name?: string; role?: Role; pin?: string; active?: boolean }>().catch(() => ({}) as Record<string, never>);
  const u = await c.env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(id).first<UserRow>();
  if (!u) return err(c, 404, "not_found", "ইউজার পাওয়া যায়নি");
  if (id === me.id && (body.active === false || body.role === "staff")) {
    return err(c, 400, "self", "নিজেকে বন্ধ বা স্টাফ করা যাবে না");
  }
  const name = body.name !== undefined ? cleanName(body.name) : u.name;
  if (!name) return err(c, 400, "invalid", "নাম দিন");
  const role: Role = body.role === "owner" || body.role === "staff" ? body.role : u.role;
  const active = body.active === undefined ? u.active : body.active ? 1 : 0;
  let { pin_hash, salt } = u;
  if (body.pin !== undefined) {
    if (!isValidSecret(body.pin)) return err(c, 400, "invalid_pin", "পিন/পাসওয়ার্ড 4 থেকে 64 অক্ষরের হতে হবে");
    salt = randomB64();
    pin_hash = await hashPin(body.pin, salt);
  }
  await c.env.DB.prepare(
    "UPDATE users SET name = ?, role = ?, active = ?, pin_hash = ?, salt = ?, failed = 0, locked_until = 0, updated_at = ? WHERE id = ?",
  )
    .bind(name, role, active, pin_hash, salt, Date.now(), id)
    .run();
  return c.json({ ok: true });
});

// ---------- সিঙ্ক ----------

/** Last-write-wins upsert; প্রতিটি পরিবর্তন নতুন seq পায় যাতে অন্য ডিভাইস টেনে নিতে পারে */
function upsertStmt(env: Env, ch: SyncChange, userId: string) {
  return env.DB.prepare(
    `INSERT INTO records (tbl, id, data, updated_at, deleted, seq, updated_by)
     VALUES (?1, ?2, ?3, ?4, ?5, (SELECT COALESCE(MAX(seq), 0) + 1 FROM records), ?6)
     ON CONFLICT (tbl, id) DO UPDATE SET
       data = excluded.data,
       updated_at = excluded.updated_at,
       deleted = excluded.deleted,
       seq = (SELECT COALESCE(MAX(seq), 0) + 1 FROM records),
       updated_by = excluded.updated_by
     WHERE excluded.updated_at >= records.updated_at`,
  ).bind(ch.tbl, ch.id, JSON.stringify(ch.data), ch.updated_at, ch.deleted ? 1 : 0, userId);
}

const TABLE_SET = new Set<string>(SYNC_TABLES);

app.post("/sync/push", async (c) => {
  const user = c.get("user");
  const body = await c.req.json<{ changes?: SyncChange[] }>().catch(() => ({}) as { changes?: SyncChange[] });
  const changes = Array.isArray(body.changes) ? body.changes : [];
  if (changes.length > MAX_PUSH) return err(c, 400, "too_many", `একবারে সর্বোচ্চ ${MAX_PUSH}টি`);

  const accepted: SyncChange[] = [];
  const rejected: { tbl: string; id: string; reason: string }[] = [];
  for (const ch of changes) {
    const bad = (reason: string) => rejected.push({ tbl: String(ch?.tbl), id: String(ch?.id), reason });
    if (!ch || !TABLE_SET.has(ch.tbl)) { bad("unknown_table"); continue; }
    if (typeof ch.id !== "string" || !ch.id || ch.id.length > 64) { bad("bad_id"); continue; }
    if (!ch.data || typeof ch.data !== "object" || Array.isArray(ch.data)) { bad("bad_data"); continue; }
    if (typeof ch.updated_at !== "number" || !Number.isFinite(ch.updated_at)) { bad("bad_time"); continue; }
    if (user.role !== "owner" && OWNER_ONLY_TABLES.includes(ch.tbl as SyncTable)) { bad("forbidden"); continue; }
    if (user.role !== "owner" && ch.deleted && OWNER_ONLY_DELETE.includes(ch.tbl)) { bad("forbidden"); continue; }
    if (JSON.stringify(ch.data).length > MAX_RECORD_BYTES) { bad("too_large"); continue; }
    accepted.push(ch);
  }

  if (accepted.length) await c.env.DB.batch(accepted.map((ch) => upsertStmt(c.env, ch, user.id)));
  return c.json({ ok: true, accepted: accepted.length, rejected });
});

/** সার্ভারের ডাটা রিসেট হলে এই মান বদলায়; ডিভাইস তখন নিজের পুরনো কপি ফেলে নতুন করে নামায় */
app.get("/sync/epoch", async (c) => {
  const row = await c.env.DB.prepare("SELECT value FROM meta WHERE key = 'data_epoch'").first<{ value: string }>();
  return c.json({ epoch: row?.value ?? null });
});

app.get("/sync/pull", async (c) => {
  const since = Math.max(0, Number(c.req.query("since") ?? 0) || 0);
  const limit = Math.min(2000, Math.max(1, Number(c.req.query("limit") ?? 1000) || 1000));
  const { results } = await c.env.DB.prepare(
    "SELECT tbl, id, data, updated_at, deleted, seq FROM records WHERE seq > ? ORDER BY seq LIMIT ?",
  )
    .bind(since, limit)
    .all<{ tbl: SyncTable; id: string; data: string; updated_at: number; deleted: number; seq: number }>();
  const changes: SyncChange[] = results.map((r) => ({
    tbl: r.tbl,
    id: r.id,
    data: JSON.parse(r.data),
    updated_at: r.updated_at,
    deleted: r.deleted ? 1 : 0,
    seq: r.seq,
  }));
  const lastSeq = changes.length ? changes[changes.length - 1].seq! : since;
  return c.json({ changes, lastSeq, hasMore: changes.length === limit });
});

app.all("*", (c) => err(c, 404, "not_found", "পাওয়া যায়নি"));

export default app;
