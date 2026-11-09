import "server-only";
import { getDatabase } from "@/lib/supabase-admin";
import { NUM_TRIALS, type CalorieStudyView, type Condition, type Ingredient } from "@/lib/calorie-config";

// A single projection boundary: reference labels/errors never leave the server.
export async function loadStudyTrials(userId: string, participantId: string, condition: Condition): Promise<CalorieStudyView> {
  const db = getDatabase();
  const { data: run, error } = await db.from("calorie_runs")
    .select("id,num_trials,attention_passed,completed_at").eq("user_id", userId).eq("condition", condition).maybeSingle();
  if (error) throw error;
  const view: CalorieStudyView = { participantId, runId: run?.id ?? null, total: run?.num_trials ?? NUM_TRIALS,
    attentionPassed: run?.attention_passed ?? false, complete: !!run?.completed_at, completed: 0, current: null };
  if (!run?.attention_passed) return view;
  const { data: rows, error: rowsError } = await db.from("calorie_responses")
    .select("id,trial_id,position,trial_started_at,ai_consulted_at,initial_estimate,final_estimate")
    .eq("run_id", run.id).order("position");
  if (rowsError || !rows) throw rowsError ?? new Error("Missing trials");
  view.completed = rows.filter(row => row.final_estimate !== null).length;
  const current = rows.find(row => row.final_estimate === null);
  if (!current) return view;
  // Even AI predictions are only fetched after consultation has been persisted.
  const reveal = condition === "ai" && current.ai_consulted_at !== null;
  const columns = reveal ? "trial_id,dish_id,image_path,model_total_kcal,ingredients" : "trial_id,dish_id,image_path";
  const { data: meal, error: mealError } = await db.from("meal_trials").select(columns).eq("trial_id", current.trial_id).single();
  if (mealError || !meal) throw mealError ?? new Error("Missing meal");
  const m = meal as unknown as { trial_id: string; dish_id: string; image_path: string; model_total_kcal?: number; ingredients?: Ingredient[] };
  view.current = { id: current.id, trialId: m.trial_id, dishId: m.dish_id, image: m.image_path, position: current.position,
    startedAt: current.trial_started_at, consultedAt: current.ai_consulted_at, initialEstimate: current.initial_estimate,
    ...(reveal ? { assistant: { total: m.model_total_kcal!, ingredients: m.ingredients! } } : {}) };
  return view;
}
