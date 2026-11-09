import { z } from "zod";
import { EMOTIONS } from "@/lib/types";

export const usernameSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "Username must be at least 3 characters.")
    .max(24, "Username must be 24 characters or fewer.")
    .regex(/^[A-Za-z0-9_]+$/, "Use only letters, numbers, and underscores.")
});

export const labelSchema = z.object({
  label: z.enum(EMOTIONS)
});

export function normalizeUsername(username: string) {
  return username.trim().toLowerCase();
}

export function getValidationMessage(error: z.ZodError) {
  return error.issues[0]?.message ?? "Please check the information you entered.";
}
