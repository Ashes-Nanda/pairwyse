import { describe, expect, it } from "vitest";
import { buildDatingInstructions, composeTurn, isRepetitive, turnPhase } from "./prompts";

describe("conversation quality pass", () => {
  it("gives each part of the date a different job", () => {
    const phases = new Set([0, 1, 4, 6, 7].map((t) => turnPhase(t, 8)));
    expect(phases.size).toBe(5);
    expect(turnPhase(7, 8)).toMatch(/No question needed/);
  });
  it("forbids generic questions and invented memories in the prompt", () => {
    const p = buildDatingInstructions({ me: "A", them: "B", profileJson: "{}", turn: 3, turnsPlanned: 8 });
    expect(p).toMatch(/never use "What about you\?"/);
    expect(p).toMatch(/Never invent memories/);
    expect(p).toMatch(/Message 4 of 8/);
  });
  it("flags generic and repeated openers", () => {
    expect(isRepetitive("I love hiking too. What about you?")).toBe(true);
    expect(isRepetitive("That sounds like a lot of fun honestly", ["That sounds like a lot of work"])).toBe(true);
    expect(isRepetitive("Which trail did you end up on?", ["Hey, I build robots for fun."])).toBe(false);
  });
  it("regenerates once on repetitive phrasing using prior own messages", async () => {
    const calls: number[] = [];
    const replies = ["That sounds amazing, I agree", "Wait, you restore old bikes? Which one was the hardest?"];
    const r = await composeTurn(async () => { calls.push(1); return replies[calls.length - 1]!; }, "i", [] as string[], (c) => c, (c) => c, ["That sounds amazing, tell me more"]);
    expect(calls.length).toBe(2);
    expect(r.text).toBe(replies[1]);
    expect(r.flags).toEqual([]);
  });
});
