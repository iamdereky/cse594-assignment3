import { describe, expect, it } from "vitest";
import { decodeCursor, deriveStudyState, encodeCursor } from "@/lib/study";
import { labelSchema, normalizeUsername, usernameSchema } from "@/lib/validation";

describe("study state", () => {
  it.each([
    [0, "instructions"],
    [1, "labeling"],
    [4, "labeling"],
    [5, "complete"],
    [6, "complete"]
  ] as const)("maps %i completed labels to %s", (count, state) => {
    expect(deriveStudyState(count)).toBe(state);
  });

  it("round trips result cursors and rejects invalid ones", () => {
    expect(decodeCursor(encodeCursor(25))).toBe(25);
    expect(decodeCursor("not-a-cursor")).toBe(0);
    expect(decodeCursor(null)).toBe(0);
  });
});

describe("input validation", () => {
  it("normalizes usernames case-insensitively", () => {
    expect(normalizeUsername("  Thoughtful_User ")).toBe("thoughtful_user");
  });

  it("enforces username requirements", () => {
    expect(usernameSchema.safeParse({ username: "valid_user" }).success).toBe(true);
    expect(usernameSchema.safeParse({ username: "not valid" }).success).toBe(false);
    expect(usernameSchema.safeParse({ username: "ab" }).success).toBe(false);
  });

  it("accepts only the six configured emotion labels", () => {
    expect(labelSchema.safeParse({ label: "joy" }).success).toBe(true);
    expect(labelSchema.safeParse({ label: "neutral" }).success).toBe(false);
  });
});
