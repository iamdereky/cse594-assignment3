import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/supabase-admin";
import { getSessionUser } from "@/lib/session";
import { isSameOrigin, jsonError } from "@/lib/http";

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return jsonError("Request rejected.", 403);
  const user = await getSessionUser(request);
  if (!user) return jsonError("Please sign in to continue.", 401);

  const { error } = await getDatabase().rpc("start_assignments", { p_user_id: user.id });
  if (error) return jsonError("We could not prepare your messages. Please try again.", 503);
  return NextResponse.json({ ok: true });
}
