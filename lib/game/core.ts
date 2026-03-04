import crypto from "node:crypto";

export function createReconnectToken(): string {
  return crypto.randomBytes(16).toString("hex");
}

export function sanitizeChatText(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, 100);
}

export function shouldRemoveDisconnected(
  disconnectedAt: number | null,
  nowMs: number,
  graceMs: number
): boolean {
  if (disconnectedAt === null) return false;
  return nowMs - disconnectedAt >= graceMs;
}

export function getNextActivePlayerIndex(
  players: Array<{ isEliminated: boolean }>,
  currentIndex: number
): number {
  if (players.length === 0) return 0;
  let idx = currentIndex;
  let attempts = 0;
  do {
    idx = (idx + 1) % players.length;
    attempts += 1;
    if (attempts > players.length * 2) break;
  } while (players[idx].isEliminated);
  return idx;
}

export function computeStealRisk(params: {
  districtRisk: number;
  eventRiskMultiplier: number;
  hasCloak: boolean;
  hasShadowWalk: boolean;
}): number {
  if (params.hasShadowWalk) return 0;
  const withEvent = params.districtRisk * params.eventRiskMultiplier;
  return params.hasCloak ? withEvent * 0.8 : withEvent;
}

export function isStealSuccess(roll0to100: number, risk: number): boolean {
  return roll0to100 > risk;
}
