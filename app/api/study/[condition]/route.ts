import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { getDatabase } from "@/lib/supabase-admin";
import { isSameOrigin, jsonError, readJson } from "@/lib/http";
import { NUM_TRIALS, parseCondition } from "@/lib/calorie-config";
import { calorieActionSchema } from "@/lib/calorie-validation";
import { loadStudyTrials } from "@/lib/calorie-study";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ condition: string }> };
async function handle(request: NextRequest, context: Context, mutate: boolean) {
  if (mutate && !isSameOrigin(request)) return jsonError("Request rejected.", 403);
  const condition = parseCondition((await context.params).condition);
  if (!condition) return jsonError("Unknown condition.", 404);
  try {
    const user = await getSessionUser(request);
    if (!user) return jsonError("Please sign in to continue.", 401);
    if (mutate) {
      const parsed = calorieActionSchema.safeParse(await readJson(request));
      if (!parsed.success) return jsonError("Enter a non-negative calorie estimate and select confidence, or check your requested action.", 400);
      const action = parsed.data;
      const { error } = await getDatabase().rpc("calorie_action", {
        p_user_id: user.id, p_condition: condition, p_action: action.action, p_num_trials: NUM_TRIALS,
        p_response_id: "responseId" in action ? action.responseId : null,
        p_answer: "answer" in action ? action.answer : null,
        p_estimate: "estimate" in action ? action.estimate : null,
        p_confidence: "confidence" in action ? action.confidence : null
      });
      if (error) {
        console.error("Calorie study action:", error.code, error.message);
        return jsonError("The action could not be saved. Reload the study to check your progress, then try again.", 409);
      }
    }
    return NextResponse.json(await loadStudyTrials(user.id, user.publicId, condition), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Calorie study unavailable:", error);
    return jsonError("Study unavailable. Please try again or contact the researcher.", 503);
  }
}
export const GET = (request: NextRequest, context: Context) => handle(request, context, false);
export const POST = (request: NextRequest, context: Context) => handle(request, context, true);
