import "server-only";

import { compare, hash } from "bcryptjs";
import { eq } from "drizzle-orm";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ensureAppReady } from "@/db/bootstrap";
import { getDb } from "@/db/client";
import { users } from "@/db/schema";
import type { SkillLevel, UserRole } from "./config";

const COOKIE_NAME = "rally_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 12;

export type SessionUser = { id: string; email: string; name: string; role: UserRole };

function sessionSecret() {
  const configured = process.env.SESSION_SECRET;
  if (configured) return new TextEncoder().encode(configured);
  if (process.env.NODE_ENV === "production") throw new Error("SESSION_SECRET is required in production.");
  return new TextEncoder().encode("pickleball-local-development-secret-change-me");
}

export async function hashPassword(password: string) {
  return hash(password, 10);
}

export async function verifyCredentials(email: string, password: string): Promise<SessionUser | null> {
  await ensureAppReady();
  const [user] = await getDb()
    .select()
    .from(users)
    .where(eq(users.email, email.trim().toLowerCase()))
    .limit(1);
  if (!user?.active || !(await compare(password, user.passwordHash))) return null;
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

export async function registerMember(input: {
  email: string;
  name: string;
  phone?: string | null;
  password: string;
  skillLevel: SkillLevel;
}): Promise<{ ok: true; user: SessionUser } | { ok: false; error: string }> {
  await ensureAppReady();
  const email = input.email.trim().toLowerCase();
  const [existing] = await getDb().select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing) return { ok: false, error: "That email already has an account. Try signing in." };

  const [created] = await getDb()
    .insert(users)
    .values({
      email,
      name: input.name.trim(),
      phone: input.phone?.trim() || null,
      passwordHash: await hashPassword(input.password),
      role: "player",
      skillLevel: input.skillLevel,
    })
    .returning();

  return { ok: true, user: { id: created.id, email: created.email, name: created.name, role: created.role } };
}

export async function createSessionToken(user: SessionUser) {
  return new SignJWT({ ...user })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(sessionSecret());
}

export async function setSessionCookie(user: SessionUser) {
  const token = await createSessionToken(user);
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.set(COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

/**
 * The cookie proves who signed in; the database decides whether they still
 * count. Re-reading the row means suspending a member or changing their role
 * takes effect on their next request instead of when the token expires.
 */
export async function getSession(): Promise<SessionUser | null> {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;

  let userId: string;
  try {
    const { payload } = await jwtVerify(token, sessionSecret());
    if (!payload.id) return null;
    userId = String(payload.id);
  } catch {
    return null;
  }

  await ensureAppReady();
  const [user] = await getDb().select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user?.active) return null;
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

/** Page guard. Members land on /play, admins may go anywhere. */
export async function requireSession(role?: UserRole): Promise<SessionUser> {
  const session = await getSession();
  if (!session) redirect("/login");
  if (role && session.role !== role) redirect(session.role === "admin" ? "/admin" : "/play");
  return session;
}

/** Server Actions are reachable by direct POST, so every one of them calls this. */
export async function requireActionUser(role?: UserRole): Promise<SessionUser> {
  const session = await getSession();
  if (!session) throw new Error("You need to sign in first.");
  if (role && session.role !== role) throw new Error("You do not have access to that.");
  return session;
}
