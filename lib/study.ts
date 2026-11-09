import type { StudyState } from "@/lib/types";

export function deriveStudyState(completedCount: number): StudyState {
  if (completedCount >= 5) return "complete";
  if (completedCount > 0) return "labeling";
  return "instructions";
}

export function encodeCursor(offset: number) {
  return Buffer.from(String(offset), "utf8").toString("base64url");
}

export function decodeCursor(cursor: string | null) {
  if (!cursor) return 0;
  const decoded = Number.parseInt(Buffer.from(cursor, "base64url").toString("utf8"), 10);
  return Number.isSafeInteger(decoded) && decoded >= 0 ? decoded : 0;
}
