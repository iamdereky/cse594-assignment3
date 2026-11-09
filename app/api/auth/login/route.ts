import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/supabase-admin";
import { isSameOrigin, jsonError, readJson } from "@/lib/http";
import { attachSessionCookie, issueSession } from "@/lib/session";
import { usernameSchema, normalizeUsername } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return jsonError("Request rejected.", 403);
  const parsed = usernameSchema.safeParse(await readJson(request));
  if (!parsed.success) return jsonError("Enter a valid username.", 400);

  const { data: user } = await getDatabase()
    .from("users")
    .select("id, username, public_id")
    .eq("normalized_username", normalizeUsername(parsed.data.username))
    .maybeSingle();

  if (!user) return jsonError("We could not find that username.", 404);

  const session = await issueSession(user.id as string);
  const response = NextResponse.json({ publicId: user.public_id, username: user.username });
  attachSessionCookie(response, session.token, session.expiresAt);
  return response;
}
