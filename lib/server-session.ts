import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { AppRole } from "@/types/app";

export interface ServerActor {
  userId: string;
  role: AppRole;
  fullName: string | null;
  issuedAt: number;
}

const SESSION_COOKIE = "sfm_actor_sig_v1";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12h

function keyBytes(): Buffer {
  const raw =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "shiftmaster-pro-dev-fallback-secret-please-override";
  // Derive a 32-byte key deterministically so cookie survives restarts in dev
  const h = createHmac("sha256", "shiftmaster-pro-session-key-v1");
  h.update(raw);
  return h.digest();
}

function hmacHex(payload: string): string {
  const h = createHmac("sha256", keyBytes());
  h.update(payload);
  return h.digest("hex");
}

export function encodeSession(actor: Omit<ServerActor, "issuedAt"> & { issuedAt?: number }): string {
  const payload = JSON.stringify({
    userId: actor.userId,
    role: actor.role,
    fullName: actor.fullName ?? null,
    issuedAt: actor.issuedAt ?? Date.now(),
  } satisfies ServerActor);
  const b64 = Buffer.from(payload, "utf-8").toString("base64url");
  return `${b64}.${hmacHex(b64)}`;
}

export function decodeSession(token: string | undefined): ServerActor | null {
  if (!token || typeof token !== "string") return null;
  const dot = token.indexOf(".");
  if (dot < 0) return null;
  const b64 = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = hmacHex(b64);
  try {
    const ok = timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"));
    if (!ok) return null;
  } catch {
    return null;
  }
  try {
    const obj = JSON.parse(Buffer.from(b64, "base64url").toString("utf-8")) as ServerActor;
    if (!obj.userId || !obj.role) return null;
    if (Date.now() - (obj.issuedAt ?? 0) > SESSION_TTL_MS) return null;
    return obj;
  } catch {
    return null;
  }
}

export async function setActorSession(actor: Omit<ServerActor, "issuedAt">): Promise<void> {
  const token = encodeSession(actor);
  const c = await cookies();
  c.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
}

export async function clearActorSession(): Promise<void> {
  const c = await cookies();
  c.delete(SESSION_COOKIE);
}

export async function getCurrentActor(): Promise<ServerActor | null> {
  if ((global as any).__mockActor !== undefined) {
    return (global as any).__mockActor;
  }
  const c = await cookies();
  const token = c.get(SESSION_COOKIE)?.value;
  return decodeSession(token);
}
