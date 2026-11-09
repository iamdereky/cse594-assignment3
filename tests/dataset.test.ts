import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const seed = readFileSync(path.join(process.cwd(), "supabase/seed.sql"), "utf8");

describe("curated Emotion dataset seed", () => {
  it("contains exactly 60 task tweets and 6 excluded examples", () => {
    expect(seed.match(/'task',null\)/g)).toHaveLength(60);
    expect(seed.match(/'example','/g)).toHaveLength(6);
  });

  it.each(["anger", "fear", "joy", "love", "sadness", "surprise"])("contains ten task rows for %s", (label) => {
    const pattern = new RegExp(`'${label}','task',null\\)`, "g");
    expect(seed.match(pattern)).toHaveLength(10);
  });
});
