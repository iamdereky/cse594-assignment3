import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/supabase-admin";
import { getSessionUser } from "@/lib/session";
import { isSameOrigin, jsonError, readJson } from "@/lib/http";
import { labelSchema } from "@/lib/validation";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request)) return jsonError("Request rejected.", 403);
  const user = await getSessionUser(request);
  if (!user) return jsonError("Please sign in to continue.", 401);
  const parsed = labelSchema.safeParse(await readJson(request));
  if (!parsed.success) return jsonError("Choose one of the six emotion labels.", 400);
  const { id } = await context.params;

  const { data, error } = await getDatabase().rpc("submit_assignment_label", {
    p_user_id: user.id,
    p_assignment_id: id,
    p_label: parsed.data.label
  });

  if (error) return jsonError("That response could not be saved.", 409);
  if (!data) return jsonError("This response is no longer editable.", 409);
  return NextResponse.json({ ok: true });
}
