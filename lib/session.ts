import "server-only";
import type { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/supabase-admin";
import { createSessionToken, hashSessionToken } from "@/lib/security";

export const SESSION_COOKIE = "calorie_study_session";
const SESSION_DAYS = 30;

export type SessionUser = {
  id: string;
  username: string;
  publicId: string;
  sessionId: string;
};

export async function issueSession(userId: string) {
  const database = getDatabase();
  const token = createSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  const { data, error } = await database
    .from("sessions")
    .insert({ user_id: userId, token_hash: hashSessionToken(token), expires_at: expiresAt.toISOString() })
    .select("id")
    .single();

  if (error || !data) throw new Error("Could not create a session.");
  return { token, sessionId: data.id as string, expiresAt };
}

export function attachSessionCookie(response: NextResponse, token: string, expiresAt: Date) {
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
    priority: "high"
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0
  });
}

export async function getSessionUser(request: NextRequest): Promise<SessionUser | null> {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const { data, error } = await getDatabase()
    .from("sessions")
    .select("id, expires_at, users!inner(id, username, public_id)")
    .eq("token_hash", hashSessionToken(token))
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (error || !data) return null;
  const joined = data.users as unknown as { id: string; username: string; public_id: string };
  return { id: joined.id, username: joined.username, publicId: joined.public_id, sessionId: data.id as string };
}
