// Dating-agent prompt + lightweight reply checks. Pure; no model calls.

export const DEFENSIVE_PATTERNS: RegExp[] = [
  /\b(my|the) profile (doesn'?t|does not|didn'?t) (establish|say|mention|show|include|cover)/i,
  /\bnot (in|covered by|established by|mentioned in) my profile\b/i,
  /\b(i'?m|i am) not sure,? (it|that)('?s| is) not in my profile\b/i,
  /\b(my|the) (profile|evidence|data) (is silent|doesn'?t tell|does not tell)/i,
  /\bi (can'?t|cannot) (say|confirm) (from|based on) my profile\b/i,
];

/** Unsupported personal facts the agents must never assert. Heuristic: flags first-person claims. */
export const UNSUPPORTED_FACT_PATTERNS: RegExp[] = [
  /\bi'?m\s+(\d{2})\b|\bi am\s+(\d{2})\b|\b(\d{2}) years old\b/i,
  /\bi'?m (single|married|divorced|engaged|in a relationship|taken)\b/i,
  /\bi am (single|married|divorced|engaged|in a relationship|taken)\b/i,
  /\bi'?m (attracted|really into you|falling for you)\b/i,
  /\b(my type is|i'?m looking for (a|someone)|my ideal partner)\b/i,
];

export const isDefensive = (text: string) => DEFENSIVE_PATTERNS.some((r) => r.test(text));
export const hasUnsupportedFact = (text: string) => UNSUPPORTED_FACT_PATTERNS.some((r) => r.test(text));

export interface TurnContext {
  me: string;
  them: string;
  profileJson: string;
  turn: number;
  turnsPlanned: number;
}

export function buildDatingInstructions(c: TurnContext): string {
  const ending = c.turn >= c.turnsPlanned - 2 ? "\nThis is one of the last messages: wrap up warmly and naturally, without promising or implying a romantic outcome." : "";
  return `You are the PAIRWISE dating agent representing ${c.me}, on a first text-based "date" with the agent for ${c.them}.

How to talk:
- Speak in first person on ${c.me}'s behalf: warm, curious, relaxed. 1–3 sentences.
- Share something specific and supported from the profile below, then ask ONE natural, open-ended question that invites ${c.them} to share more (e.g. about a place, a project, a hobby they mentioned).
- Build on what ${c.them}'s agent just said. Keep it reciprocal.

Grounding rules (strict):
- Personal facts about ${c.me} must come from the profile below. Facts about ${c.them} only from what their agent said in this conversation.
- Never state or guess age, relationship status, dating preferences, attraction, protected attributes, or experiences not in the profile.
- Do not manufacture romantic interest or a positive outcome.
- When something isn't known, don't announce it. Instead, steer to a supported topic or simply ask the other person. Avoid phrases like "my profile doesn't establish…" or "that's not in my profile".${ending}

Profile (evidence-backed): ${c.profileJson.slice(0, 8000)}`;
}

export const RETRY_NUDGE =
  "Rewrite your last reply: drop any disclaimer about what your profile does or doesn't say and any unsupported personal fact (age, relationship status, preferences, attraction). Share a supported detail and ask a natural question instead.";

/**
 * Generates one turn; if the reply is defensive or asserts an unsupported personal fact, regenerates once with a nudge.
 * At most 2 model calls per turn.
 */
export async function composeTurn<M>(
  generate: (instructions: string, history: M[]) => Promise<string>,
  instructions: string,
  history: M[],
  mkUser: (content: string) => M,
  mkAssistant: (content: string) => M,
): Promise<{ text: string; regenerated: boolean; flags: string[] }> {
  const first = await generate(instructions, history);
  const flags = [isDefensive(first) && "defensive", hasUnsupportedFact(first) && "unsupported_fact"].filter(Boolean) as string[];
  if (!flags.length) return { text: first, regenerated: false, flags };
  const second = await generate(instructions, [...history, mkAssistant(first), mkUser(RETRY_NUDGE)]);
  const after = [isDefensive(second) && "defensive", hasUnsupportedFact(second) && "unsupported_fact"].filter(Boolean) as string[];
  // Keep the better of the two; never fabricate a replacement.
  return { text: after.length <= flags.length ? second : first, regenerated: true, flags: after };
}
