import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/supabase-admin";
import { createPublicId } from "@/lib/security";
import { attachSessionCookie, issueSession } from "@/lib/session";
import { getValidationMessage, usernameSchema, normalizeUsername } from "@/lib/validation";
import { isSameOrigin, jsonError, readJson } from "@/lib/http";

export const runtime = "nodejs";

type CreatedUser = { id: string; username: string; public_id: string };

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return jsonError("Request rejected.", 403);
  const parsed = usernameSchema.safeParse(await readJson(request));
  if (!parsed.success) return jsonError(getValidationMessage(parsed.error), 400);

  const database = getDatabase();
  const { username } = parsed.data;
  const normalized = normalizeUsername(username);

  let user: CreatedUser | null = null;
  let lastError: { code?: string } | null = null;

  for (let attempt = 0; attempt < 4 && !user; attempt += 1) {
    const result = await database
      .from("users")
      .insert({
        username,
        normalized_username: normalized,
        public_id: createPublicId()
      })
      .select("id, username, public_id")
      .single();
    user = result.data as CreatedUser | null;
    lastError = result.error;
    if (result.error?.code === "23505" && result.error.message.includes("public_id")) continue;
    break;
  }

  if (!user) {
    if (lastError?.code === "23505") return jsonError("That username is already in use.", 409);
    return jsonError("We could not create the account. Please try again.", 500);
  }

  try {
    const session = await issueSession(user.id);
    const response = NextResponse.json({ publicId: user.public_id, username: user.username }, { status: 201 });
    attachSessionCookie(response, session.token, session.expiresAt);
    return response;
  } catch {
    await database.from("users").delete().eq("id", user.id);
    return jsonError("We could not create the account. Please try again.", 500);
  }
}
