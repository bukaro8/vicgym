import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import type { PrismaClient, UserRole } from "@/generated/prisma/client";
import { AUTH_COOKIE_NAME } from "@/lib/auth-constants";
import { getPrisma } from "@/lib/prisma";

export { AUTH_COOKIE_NAME } from "@/lib/auth-constants";
export const MAGIC_LINK_TTL_MS = 15 * 60 * 1000;
export const MAGIC_LINK_REQUEST_COOLDOWN_MS = 60 * 1000;
export const AUTH_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type AuthenticatedUser = { id: string; email: string; role: UserRole };
export class AuthenticationRequiredError extends Error {}
export class AdminRequiredError extends Error {}
export class MagicLinkRateLimitError extends Error {}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function createOpaqueToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashOpaqueToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function magicLinkExpired(expiresAt: Date, now = new Date()): boolean {
  return expiresAt.getTime() <= now.getTime();
}

export async function createMagicLinkToken(prisma: PrismaClient, email: string, now = new Date()) {
  const normalizedEmail = normalizeEmail(email);
  const token = createOpaqueToken();
  const tokenHash = hashOpaqueToken(token);
  const expiresAt = new Date(now.getTime() + MAGIC_LINK_TTL_MS);
  await prisma.$transaction(async (tx) => {
    const recent = await tx.magicLinkToken.findFirst({ where: { email: normalizedEmail, createdAt: { gt: new Date(now.getTime() - MAGIC_LINK_REQUEST_COOLDOWN_MS) } }, select: { id: true } });
    if (recent) throw new MagicLinkRateLimitError("A sign-in link was requested recently");
    await tx.magicLinkToken.updateMany({ where: { email: normalizedEmail, usedAt: null }, data: { usedAt: now } });
    await tx.magicLinkToken.create({ data: { email: normalizedEmail, tokenHash, expiresAt } });
  });
  return { token, tokenHash, expiresAt, email: normalizedEmail };
}

export async function consumeMagicLinkToken(prisma: PrismaClient, token: string, now = new Date()) {
  const tokenHash = hashOpaqueToken(token);
  return prisma.$transaction(async (tx) => {
    const link = await tx.magicLinkToken.findUnique({ where: { tokenHash } });
    if (!link || link.usedAt || magicLinkExpired(link.expiresAt, now)) return null;
    const consumed = await tx.magicLinkToken.updateMany({ where: { id: link.id, usedAt: null, expiresAt: { gt: now } }, data: { usedAt: now } });
    if (consumed.count !== 1) return null;
    const user = await tx.user.upsert({ where: { email: link.email }, create: { email: link.email, settings: { create: {} } }, update: {}, select: { id: true, email: true, role: true } });
    const sessionToken = createOpaqueToken();
    const expiresAt = new Date(now.getTime() + AUTH_SESSION_TTL_MS);
    await tx.authSession.create({ data: { userId: user.id, tokenHash: hashOpaqueToken(sessionToken), expiresAt } });
    return { user, sessionToken, expiresAt };
  });
}

export async function findAuthenticatedUser(prisma: PrismaClient, token: string | undefined, now = new Date()): Promise<AuthenticatedUser | null> {
  if (!token) return null;
  const session = await prisma.authSession.findUnique({ where: { tokenHash: hashOpaqueToken(token) }, select: { expiresAt: true, user: { select: { id: true, email: true, role: true } } } });
  if (!session || session.expiresAt <= now) return null;
  return session.user;
}

export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
  return findAuthenticatedUser(getPrisma(), (await cookies()).get(AUTH_COOKIE_NAME)?.value);
}

export async function requireCurrentUser(): Promise<AuthenticatedUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireApiUser(): Promise<AuthenticatedUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthenticationRequiredError("Authentication required");
  return user;
}

export function assertAdminUser(user: AuthenticatedUser): AuthenticatedUser {
  if (user.role !== "ADMIN") throw new AdminRequiredError("Administrator access required");
  return user;
}

export async function requireAdminUser(): Promise<AuthenticatedUser> {
  return assertAdminUser(await requireApiUser());
}

export async function deleteCurrentAuthSession(prisma = getPrisma()): Promise<void> {
  const token = (await cookies()).get(AUTH_COOKIE_NAME)?.value;
  if (token) await deleteAuthSessionByToken(prisma, token);
}

export async function deleteAuthSessionByToken(prisma: PrismaClient, token: string): Promise<void> {
  await prisma.authSession.deleteMany({ where: { tokenHash: hashOpaqueToken(token) } });
}

export function sessionCookieOptions(expiresAt: Date, secure: boolean) {
  return { httpOnly: true, secure, sameSite: "lax" as const, path: "/", expires: expiresAt, priority: "high" as const };
}
