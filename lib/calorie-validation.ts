import { z } from "zod";
const estimate = z.number().finite().nonnegative();
export const calorieActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("attention"), answer: z.enum(["Protein", "Price", "Calories", "Cooking time"]) }),
  z.object({ action: z.literal("start"), responseId: z.uuid() }),
  z.object({ action: z.literal("consult"), responseId: z.uuid(), estimate: estimate.nullable() }),
  z.object({ action: z.literal("submit"), responseId: z.uuid(), estimate, confidence: z.number().int().min(1).max(5) })
]);
