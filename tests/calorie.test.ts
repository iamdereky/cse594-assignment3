import { describe, it, expect, vi, beforeEach } from "vitest";
import { calorieActionSchema } from "@/lib/calorie-validation";
import { parseCondition } from "@/lib/calorie-config";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("@/lib/supabase-admin", () => ({ getDatabase: () => ({ from: mocks.from }) }));
import { loadStudyTrials } from "@/lib/calorie-study";

it("accepts zero and rejects missing, negative, infinite, string estimates and invalid confidence", () => {
  const valid = { action: "submit", responseId: "11111111-1111-4111-8111-111111111111", estimate: 0, confidence: 3 };
  expect(calorieActionSchema.safeParse(valid).success).toBe(true);
  for (const estimate of [undefined, null, -1, NaN, Infinity, "600"]) expect(calorieActionSchema.safeParse({ ...valid, estimate }).success).toBe(false);
  for (const confidence of [undefined, null, 0, 6, 1.5]) expect(calorieActionSchema.safeParse({ ...valid, confidence }).success).toBe(false);
});
it("recognizes only the two study condition routes", () => {
  expect(parseCondition("ai")).toBe("ai"); expect(parseCondition("no-ai")).toBe("no_ai"); expect(parseCondition("other")).toBeNull();
});
describe("participant data boundary", () => {
  beforeEach(() => mocks.from.mockReset());
  it.each([['no_ai', false], ['ai', false], ['ai', true]] as const)("filters labels and gates assistance for %s, consulted=%s", async (condition, consulted) => {
    const selections: string[] = [];
    const run = { id: "run", num_trials: 10, attention_passed: true, completed_at: null };
    const rows = [{ id: "response", trial_id: "trial", position: 1, trial_started_at: null, ai_consulted_at: consulted ? "now" : null, initial_estimate: null, final_estimate: null }];
    const meal = { trial_id: "trial", dish_id: "dish", image_path: "/study_images/dish.jpg", ground_truth_kcal: 9876, absolute_error: 9875, model_total_kcal: 500, ingredients: [{ name: "Rice", kcal: 500 }] };
    mocks.from.mockImplementation((table: string) => {
      const data = table === "calorie_runs" ? run : table === "calorie_responses" ? rows : meal;
      const q: Record<string, unknown> = {};
      q.select = (columns: string) => { selections.push(columns); return q; };
      q.eq = () => q;
      q.order = q.single = q.maybeSingle = () => Promise.resolve({ data, error: null });
      return q;
    });
    const result = await loadStudyTrials("user", "P-TESTAA", condition);
    expect(JSON.stringify(result)).not.toMatch(/ground_truth|absolute_error|9876/);
    expect(selections.join()).not.toMatch(/ground_truth|absolute_error/);
    expect(!!result.current?.assistant).toBe(consulted);
    if (!consulted) { expect(selections.join()).not.toMatch(/model_total|ingredients/); expect(JSON.stringify(result)).not.toContain('500'); }
  });
});
