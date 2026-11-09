import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/supabase-admin";
import { getSessionUser } from "@/lib/session";
import { jsonError } from "@/lib/http";

export async function GET(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) return jsonError("Please sign in to continue.", 401);

  const { data, error } = await getDatabase()
    .from("assignments")
    .select("id, position, assigned_at, selected_label, submitted_at, tweets!inner(id, text)")
    .eq("user_id", user.id)
    .order("position", { ascending: true });
  if (error) return jsonError("Your assigned messages are temporarily unavailable.", 503);

  const assignments = (data ?? []).map((row) => {
    const tweet = row.tweets as unknown as { id: string; text: string };
    return {
      id: row.id,
      position: row.position,
      assignedAt: row.assigned_at,
      selectedLabel: row.selected_label,
      submittedAt: row.submitted_at,
      tweet: { id: tweet.id, text: tweet.text }
    };
  });
  return NextResponse.json({ assignments });
}
