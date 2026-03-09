import { describe, expect, it } from "vitest";
import {
  applyContractProgress,
  bumpDistrictHeat,
  computeStealRisk,
  createContracts,
  createDistrictHeatMap,
  createReconnectToken,
  decayDistrictHeat,
  getDistrictHeatRiskBonus,
  getNextActivePlayerIndex,
  isAllowedSocketOrigin,
  isStealSuccess,
  pickRotatingMarket,
  sanitizeChatText,
  shouldRemoveDisconnected,
} from "../lib/game/core";

describe("createReconnectToken", () => {
  it("creates 32-char hex token", () => {
    const token = createReconnectToken();
    expect(token).toMatch(/^[a-f0-9]{32}$/);
  });

  it("creates unique tokens", () => {
    const first = createReconnectToken();
    const second = createReconnectToken();
    expect(first).not.toBe(second);
  });
});

describe("sanitizeChatText", () => {
  it("trims leading/trailing spaces", () => {
    expect(sanitizeChatText("   hello   ")).toBe("hello");
  });

  it("collapses internal whitespace", () => {
    expect(sanitizeChatText("a   b\t\tc\n\n d")).toBe("a b c d");
  });

  it("cuts to 100 chars", () => {
    const text = "x".repeat(120);
    expect(sanitizeChatText(text)).toHaveLength(100);
  });

  it("returns empty string for spaces-only message", () => {
    expect(sanitizeChatText("     ")).toBe("");
  });
});

describe("shouldRemoveDisconnected", () => {
  it("returns false when disconnectedAt is null", () => {
    expect(shouldRemoveDisconnected(null, 1000, 500)).toBe(false);
  });

  it("returns false before grace timeout", () => {
    expect(shouldRemoveDisconnected(1000, 1400, 500)).toBe(false);
  });

  it("returns true on grace timeout", () => {
    expect(shouldRemoveDisconnected(1000, 1500, 500)).toBe(true);
  });

  it("returns true after grace timeout", () => {
    expect(shouldRemoveDisconnected(1000, 1700, 500)).toBe(true);
  });
});

describe("getNextActivePlayerIndex", () => {
  it("returns 0 for empty players", () => {
    expect(getNextActivePlayerIndex([], 3)).toBe(0);
  });

  it("moves to next alive player", () => {
    const players = [{ isEliminated: false }, { isEliminated: false }, { isEliminated: false }];
    expect(getNextActivePlayerIndex(players, 0)).toBe(1);
  });

  it("skips eliminated players", () => {
    const players = [{ isEliminated: false }, { isEliminated: true }, { isEliminated: false }];
    expect(getNextActivePlayerIndex(players, 0)).toBe(2);
  });

  it("wraps around", () => {
    const players = [{ isEliminated: false }, { isEliminated: false }, { isEliminated: false }];
    expect(getNextActivePlayerIndex(players, 2)).toBe(0);
  });

  it("returns current-cycled index when all eliminated", () => {
    const players = [{ isEliminated: true }, { isEliminated: true }, { isEliminated: true }];
    const next = getNextActivePlayerIndex(players, 1);
    expect(next >= 0 && next <= 2).toBe(true);
  });
});

describe("computeStealRisk", () => {
  it("applies event multiplier", () => {
    const risk = computeStealRisk({
      districtRisk: 20,
      eventRiskMultiplier: 1.5,
      hasCloak: false,
      hasShadowWalk: false,
    });
    expect(risk).toBe(30);
  });

  it("applies district heat bonus", () => {
    const risk = computeStealRisk({
      districtRisk: 20,
      eventRiskMultiplier: 1,
      heatBonus: 9,
      hasCloak: false,
      hasShadowWalk: false,
    });
    expect(risk).toBe(29);
  });

  it("applies cloak reduction", () => {
    const risk = computeStealRisk({
      districtRisk: 50,
      eventRiskMultiplier: 1,
      hasCloak: true,
      hasShadowWalk: false,
    });
    expect(risk).toBe(40);
  });

  it("applies intel map reduction", () => {
    const risk = computeStealRisk({
      districtRisk: 50,
      eventRiskMultiplier: 1,
      hasCloak: false,
      hasIntelMap: true,
      hasShadowWalk: false,
    });
    expect(risk).toBe(45);
  });

  it("shadow walk sets risk to zero", () => {
    const risk = computeStealRisk({
      districtRisk: 50,
      eventRiskMultiplier: 2,
      hasCloak: true,
      hasShadowWalk: true,
    });
    expect(risk).toBe(0);
  });
});

describe("district heat helpers", () => {
  it("creates empty district heat map", () => {
    expect(createDistrictHeatMap()).toEqual({ slums: 0, business: 0, park: 0, residential: 0 });
  });

  it("bumps heat with clamp", () => {
    const heat = bumpDistrictHeat(createDistrictHeatMap(), "business", 14);
    expect(heat.business).toBe(14);
  });

  it("decays heat without going below zero", () => {
    const heated = bumpDistrictHeat(createDistrictHeatMap(), "park", 12);
    expect(decayDistrictHeat(heated, 20).park).toBe(0);
  });

  it("converts heat into risk bonus", () => {
    const heated = bumpDistrictHeat(createDistrictHeatMap(), "residential", 35);
    expect(getDistrictHeatRiskBonus(heated, "residential")).toBe(9);
  });
});

describe("contract helpers", () => {
  it("creates unique contracts", () => {
    const contracts = createContracts(2, () => 0.2);
    expect(contracts).toHaveLength(2);
    expect(new Set(contracts.map((contract) => contract.id)).size).toBe(2);
  });

  it("advances contract progress and returns reward on completion", () => {
    const [contract] = createContracts(1, () => 0);
    const reward = applyContractProgress([contract], [{ id: contract.id, value: contract.goal }]);
    expect(reward).toBe(contract.reward);
    expect(contract.completed).toBe(true);
  });
});

describe("market helpers", () => {
  it("picks unique rotating market items", () => {
    const picked = pickRotatingMarket(["a", "b", "c", "d"], 3, () => 0.1);
    expect(picked).toHaveLength(3);
    expect(new Set(picked).size).toBe(3);
  });
});

describe("isStealSuccess", () => {
  it("returns true when roll is greater than risk", () => {
    expect(isStealSuccess(60, 40)).toBe(true);
  });

  it("returns false when roll equals risk", () => {
    expect(isStealSuccess(40, 40)).toBe(false);
  });

  it("returns false when roll is below risk", () => {
    expect(isStealSuccess(10, 40)).toBe(false);
  });
});

describe("isAllowedSocketOrigin", () => {
  const staticOrigins = ["https://vibestudy.ru", "https://dead-souls-omega.vercel.app"];

  it("allows undefined origin", () => {
    expect(isAllowedSocketOrigin(undefined, staticOrigins)).toBe(true);
  });

  it("allows explicitly configured origins", () => {
    expect(isAllowedSocketOrigin("https://vibestudy.ru", staticOrigins)).toBe(true);
  });

  it("allows vercel preview origins for dead-souls project", () => {
    expect(isAllowedSocketOrigin("https://dead-souls-c3ot3n2os-alexeys-projects-2260f6f3.vercel.app", staticOrigins)).toBe(true);
  });

  it("rejects unrelated origins", () => {
    expect(isAllowedSocketOrigin("https://example.com", staticOrigins)).toBe(false);
  });
});
