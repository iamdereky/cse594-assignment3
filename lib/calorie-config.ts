// Applied when a participant passes the attention check; existing runs keep their size.
export const NUM_TRIALS = 10;
export const CONDITIONS = ["no_ai", "ai"] as const;
export type Condition = (typeof CONDITIONS)[number];
export function parseCondition(route: string): Condition | null {
  return route === "no-ai" ? "no_ai" : route === "ai" ? "ai" : null;
}
export type Ingredient = { name: string; kcal: number; grams?: number };
export type Assistant = { total: number; ingredients: Ingredient[] };
export type MealView = {
  id: string; trialId: string; dishId: string; image: string; position: number;
  startedAt: string | null; consultedAt: string | null; initialEstimate: number | null;
  assistant?: Assistant;
};
export type CalorieStudyView = {
  participantId: string; runId: string | null; total: number; completed: number;
  attentionPassed: boolean; complete: boolean; current: MealView | null;
};
