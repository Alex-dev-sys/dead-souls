import { describe, expect, it } from "vitest";
import {
  computeStealRisk,
  createReconnectToken,
  getNextActivePlayerIndex,
  isStealSuccess,
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

  it("applies cloak reduction", () => {
    const risk = computeStealRisk({
      districtRisk: 50,
      eventRiskMultiplier: 1,
      hasCloak: true,
      hasShadowWalk: false,
    });
    expect(risk).toBe(40);
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
