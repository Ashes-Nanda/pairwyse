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

/** Conversation arc: each turn has a different job so the date progresses instead of looping on the same topics. */
export function turnPhase(turn: number, turnsPlanned: number): string {
  if (turn === 0) return "Open the date: say hi in a relaxed way and mention ONE specific, supported thing about yourself that's fun to talk about. Ask something easy.";
  if (turn >= turnsPlanned - 1) return "Final message: respond to what they just said, then close warmly. No question needed. Don't promise or imply a romantic outcome.";
  if (turn >= turnsPlanned - 2) return "Start winding down: pick the most interesting thread so far and reflect on it. A question is optional.";
  if (turn <= 2) return "React to their last message first (a genuine reaction, not 'That's great!'). Dig into a detail THEY gave you with a concrete follow-up.";
  return "Move somewhere new: connect something they said to a different supported part of your life (a hobby, a place, a value) rather than repeating earlier topics. Vary your structure — a story-like detail, a playful aside, or a short opinion.";
}

export const GENERIC_QUESTIONS = [/what about you\??\s*$/i, /how about you\??\s*$/i, /what do you (like|enjoy) to do\b/i, /tell me (more )?about yourself/i];

export function buildDatingInstructions(c: TurnContext): string {
  return `You are the PAIRWISE dating agent representing ${c.me}, texting on a first "date" with the agent for ${c.them}. Message ${c.turn + 1} of ${c.turnsPlanned}.

This turn's job: ${turnPhase(c.turn, c.turnsPlanned)}

How to talk:
- Sound like a real person texting: casual, curious, socially aware. First person as ${c.me}.
- Respond to what they actually said before changing direction. Pick up a concrete detail and run with it.
- Vary length: sometimes one short line, sometimes 2–3 sentences. Never more than 3.
- Ask at most one question, and make it specific ("Which trail was it?" beats "What do you enjoy?"). Don't end every message with a question, and never use "What about you?" or "Tell me about yourself".
- Don't repeat topics, openers, or phrasing from your earlier messages.
- Light humour only if it fits. No forced slang, flirting or emojis.

Grounding rules (strict):
- Personal facts about ${c.me} must come from the profile below. Facts about ${c.them} only from what their agent said in this conversation.
- Never invent memories, anecdotes, trips, opinions-as-facts, age, relationship status, dating preferences, attraction, protected attributes or intentions.
- If something isn't known, ask about it or talk about something supported — never narrate what the profile does or doesn't say.
- Don't manufacture romantic interest or a positive outcome.

Profile (evidence-backed): ${c.profileJson.slice(0, 8000)}`;
}

/** Flags a reply that copies the opener of an earlier own message or falls back to a generic question. */
export function isRepetitive(text: string, priorOwn: string[] = []): boolean {
  if (GENERIC_QUESTIONS.some((r) => r.test(text))) return true;
  const opener = (t: string) => t.toLowerCase().replace(/[^a-z\s]/g, "").split(/\s+/).filter(Boolean).slice(0, 4).join(" ");
  const o = opener(text);
  return o.split(" ").length >= 4 && priorOwn.some((p) => opener(p) === o);
}

export const RETRY_NUDGE =
  "Rewrite your last reply: drop any disclaimer about what your profile does or doesn't say, any unsupported personal fact (age, relationship status, preferences, attraction), and any generic or repeated phrasing. React to what they said and, if you ask something, make it specific.";

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
  priorOwn: string[] = [],
): Promise<{ text: string; regenerated: boolean; flags: string[] }> {
  const first = await generate(instructions, history);
  const check = (t: string) => [isDefensive(t) && "defensive", hasUnsupportedFact(t) && "unsupported_fact", isRepetitive(t, priorOwn) && "repetitive"].filter(Boolean) as string[];
  const flags = check(first);
  void [.filter(Boolean) as string[];
  if (!flags.length) return { text: first, regenerated: false, flags };
  const second = await generate(instructions, [...history, mkAssistant(first), mkUser(RETRY_NUDGE)]);
  const after = check(second);
  // Keep the better of the two; never fabricate a replacement.
  return { text: after.length <= flags.length ? second : first, regenerated: true, flags: after };
}
