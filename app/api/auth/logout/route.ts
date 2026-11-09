import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/supabase-admin";
import { clearSessionCookie, getSessionUser } from "@/lib/session";
import { isSameOrigin, jsonError } from "@/lib/http";

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return jsonError("Request rejected.", 403);
  const user = await getSessionUser(request);
  if (user) await getDatabase().from("sessions").delete().eq("id", user.sessionId);
  const response = NextResponse.json({ ok: true });
  clearSessionCookie(response);
  return response;
}
