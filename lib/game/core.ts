import crypto from "node:crypto";

export type DistrictId = "slums" | "business" | "park" | "residential";
export type ContractId = "runner" | "broker" | "district_hopper" | "quartermaster";

export type ContractProgress = {
  id: ContractId;
  title: string;
  description: string;
  reward: number;
  goal: number;
  progress: number;
  completed: boolean;
};

export type DistrictHeatMap = Record<DistrictId, number>;

type ContractTemplate = Omit<ContractProgress, "progress" | "completed">;

const CONTRACT_LIBRARY: ContractTemplate[] = [
  {
    id: "runner",
    title: "Забег по крышам",
    description: "Проведи 2 успешные кражи за матч.",
    reward: 90,
    goal: 2,
  },
  {
    id: "broker",
    title: "Черный брокер",
    description: "Продай 2 души и закрой две сделки.",
    reward: 120,
    goal: 2,
  },
  {
    id: "district_hopper",
    title: "Городской призрак",
    description: "Проверни дела в 2 разных районах.",
    reward: 100,
    goal: 2,
  },
  {
    id: "quartermaster",
    title: "Снабженец",
    description: "Купи 1 предмет на черном рынке.",
    reward: 70,
    goal: 1,
  },
];

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
  heatBonus?: number;
  hasCloak: boolean;
  hasIntelMap?: boolean;
  hasShadowWalk: boolean;
}): number {
  if (params.hasShadowWalk) return 0;
  let risk = params.districtRisk * params.eventRiskMultiplier + (params.heatBonus ?? 0);
  if (params.hasCloak) risk *= 0.8;
  if (params.hasIntelMap) risk *= 0.9;
  return Math.max(0, Math.min(95, risk));
}

export function isStealSuccess(roll0to100: number, risk: number): boolean {
  return roll0to100 > risk;
}

export function isAllowedSocketOrigin(
  origin: string | undefined | null,
  staticOrigins: string[]
): boolean {
  if (!origin) return true;
  if (staticOrigins.includes(origin)) return true;
  return /^https:\/\/dead-souls-[a-z0-9-]+\.vercel\.app$/i.test(origin);
}

export function createDistrictHeatMap(): DistrictHeatMap {
  return {
    slums: 0,
    business: 0,
    park: 0,
    residential: 0,
  };
}

export function getDistrictHeatRiskBonus(heat: DistrictHeatMap, districtId: DistrictId): number {
  return Math.min(18, Math.floor((heat[districtId] || 0) / 10) * 3);
}

export function bumpDistrictHeat(
  heat: DistrictHeatMap,
  districtId: DistrictId,
  amount: number
): DistrictHeatMap {
  return {
    ...heat,
    [districtId]: Math.max(0, Math.min(100, (heat[districtId] || 0) + amount)),
  };
}

export function decayDistrictHeat(heat: DistrictHeatMap, amount: number): DistrictHeatMap {
  return {
    slums: Math.max(0, heat.slums - amount),
    business: Math.max(0, heat.business - amount),
    park: Math.max(0, heat.park - amount),
    residential: Math.max(0, heat.residential - amount),
  };
}

export function pickRotatingMarket<T>(
  items: T[],
  count: number,
  randomFn: () => number = Math.random
): T[] {
  const pool = [...items];
  const picked: T[] = [];
  while (pool.length > 0 && picked.length < count) {
    const index = Math.floor(randomFn() * pool.length);
    picked.push(pool[index]);
    pool.splice(index, 1);
  }
  return picked;
}

export function createContracts(
  count = 2,
  randomFn: () => number = Math.random
): ContractProgress[] {
  return pickRotatingMarket(CONTRACT_LIBRARY, count, randomFn).map((contract) => ({
    ...contract,
    progress: 0,
    completed: false,
  }));
}

export function applyContractProgress(
  contracts: ContractProgress[],
  updates: Array<{ id: ContractId; amount?: number; value?: number }>
): number {
  let reward = 0;

  for (const update of updates) {
    for (const contract of contracts) {
      if (contract.id !== update.id || contract.completed) continue;

      const nextProgress =
        typeof update.value === "number"
          ? Math.max(contract.progress, update.value)
          : contract.progress + (update.amount ?? 0);

      contract.progress = Math.min(contract.goal, nextProgress);

      if (contract.progress >= contract.goal) {
        contract.completed = true;
        reward += contract.reward;
      }
    }
  }

  return reward;
}
