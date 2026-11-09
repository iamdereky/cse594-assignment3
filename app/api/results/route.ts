import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/supabase-admin";
import { getSessionUser } from "@/lib/session";
import { decodeCursor, encodeCursor } from "@/lib/study";
import { jsonError } from "@/lib/http";

const PAGE_SIZE = 25;

export async function GET(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) return jsonError("Please sign in to continue.", 401);
  const database = getDatabase();
  const { count } = await database
    .from("assignments")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .not("selected_label", "is", null);
  if ((count ?? 0) < 5) return jsonError("Complete all five labels to view study results.", 403);

  const offset = decodeCursor(request.nextUrl.searchParams.get("cursor"));
  const { data, error } = await database
    .from("assignments")
    .select("id, selected_label, submitted_at, users!inner(public_id), tweets!inner(id, text)")
    .not("selected_label", "is", null)
    .order("submitted_at", { ascending: false })
    .range(offset, offset + PAGE_SIZE);
  if (error) return jsonError("Study results are temporarily unavailable.", 503);

  const hasMore = (data?.length ?? 0) > PAGE_SIZE;
  const rows = (data ?? []).slice(0, PAGE_SIZE).map((row) => {
    const participant = row.users as unknown as { public_id: string };
    const tweet = row.tweets as unknown as { id: string; text: string };
    return {
      assignmentId: row.id,
      participantId: participant.public_id,
      tweetId: tweet.id,
      text: tweet.text,
      selectedLabel: row.selected_label,
      submittedAt: row.submitted_at
    };
  });

  return NextResponse.json({ rows, nextCursor: hasMore ? encodeCursor(offset + PAGE_SIZE) : null });
}
