import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/supabase-admin";
import { getSessionUser } from "@/lib/session";
import { deriveStudyState } from "@/lib/study";
import { jsonError } from "@/lib/http";

export async function GET(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) return jsonError("Please sign in to continue.", 401);

  const { count, error } = await getDatabase()
    .from("assignments")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .not("selected_label", "is", null);
  if (error) return jsonError("Progress is temporarily unavailable.", 503);

  const completedCount = count ?? 0;
  return NextResponse.json({
    publicId: user.publicId,
    username: user.username,
    completedCount,
    state: deriveStudyState(completedCount)
  });
}
