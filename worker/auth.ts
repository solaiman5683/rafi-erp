import { sign, verify } from "hono/jwt";
import type { PublicUser, Role } from "../shared/tables";

const enc = new TextEncoder();
const PBKDF2_ITERATIONS = 100_000; // Workers এ সর্বোচ্চ ১,০০,০০০

function toB64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function fromB64(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function randomB64(bytes = 16): string {
  return toB64(crypto.getRandomValues(new Uint8Array(bytes)));
}

export async function hashPin(pin: string, saltB64: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: fromB64(saltB64), iterations: PBKDF2_ITERATIONS },
    key,
    256,
  );
  return toB64(bits);
}

/** টাইমিং-সেফ তুলনা */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function getSecret(env: Env): Promise<string> {
  const fromEnv = (env as unknown as { JWT_SECRET?: string }).JWT_SECRET;
  if (fromEnv) return fromEnv;
  const row = await env.DB.prepare("SELECT value FROM meta WHERE key = 'jwt_secret'").first<{ value: string }>();
  if (row) return row.value;
  const secret = randomB64(48);
  await env.DB.prepare("INSERT OR IGNORE INTO meta (key, value) VALUES ('jwt_secret', ?)").bind(secret).run();
  const again = await env.DB.prepare("SELECT value FROM meta WHERE key = 'jwt_secret'").first<{ value: string }>();
  return again!.value;
}

const TOKEN_DAYS = 60;

export async function issueToken(env: Env, user: PublicUser): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return sign({ sub: user.id, name: user.name, role: user.role, iat: now, exp: now + TOKEN_DAYS * 86400 }, await getSecret(env), "HS256");
}

export async function readToken(env: Env, token: string): Promise<{ sub: string; role: Role } | null> {
  try {
    const payload = await verify(token, await getSecret(env), "HS256");
    return { sub: String(payload.sub), role: payload.role as Role };
  } catch {
    return null;
  }
}

/** পিন (সংখ্যা) বা পাসওয়ার্ড (যেকোনো অক্ষর) — ৪ থেকে ৬৪ অক্ষর */
export function isValidSecret(secret: unknown): secret is string {
  return typeof secret === "string" && secret.length >= 4 && secret.length <= 64;
}
