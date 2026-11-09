import { describe, expect, it } from "vitest";
import { createPublicId, createSessionToken, hashSessionToken } from "@/lib/security";

describe("session security", () => {
  it("creates opaque tokens and fixed-length token hashes", () => {
    const token = createSessionToken();
    expect(token.length).toBeGreaterThan(30);
    expect(hashSessionToken(token)).toMatch(/^[a-f0-9]{64}$/);
  });

  it("creates a non-identifying public participant id", () => {
    expect(createPublicId()).toMatch(/^P-[A-Z2-9]{6}$/);
  });
});
