"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { ClassInfo, District, GameEvent, GameState, LogEntry, PlayerClass, Soul } from "../types/game";

const GAME_GOAL = 1000;
const MAX_WANTED = 100;

export const CLASSES: Record<string, ClassInfo> = {
  careerist: {
    id: "careerist",
    name: "Карьерист",
    description: "Профессионал своего дела.",
    bonusText: "+20% к цене продажи",
    malusText: "+10% скорости розыска",
    stats: { sellMultiplier: 1.2, wantedRate: 1.1, failReduction: 1.0, incomeMultiplier: 1.0, canRelease: false, eventImmunity: false },
  },
  idealist: {
    id: "idealist",
    name: "Идеалист",
    description: "Верит, что души можно спасти.",
    bonusText: "Может отпускать души за Карму",
    malusText: "-20% цены продажи в Банке",
    stats: { sellMultiplier: 0.8, wantedRate: 1.0, failReduction: 1.0, incomeMultiplier: 1.0, canRelease: true, eventImmunity: false },
  },
  quiet: {
    id: "quiet",
    name: "Тихий",
    description: "Тень в ночи.",
    bonusText: "-30% штраф при неудаче",
    malusText: "-10% доход",
    stats: { sellMultiplier: 1.0, wantedRate: 1.0, failReduction: 0.7, incomeMultiplier: 0.9, canRelease: false, eventImmunity: false },
  },
  cynic: {
    id: "cynic",
    name: "Циник",
    description: "Видел всё.",
    bonusText: "Игнорирует плохие события",
    malusText: "Нет бонусов",
    stats: { sellMultiplier: 1.0, wantedRate: 1.0, failReduction: 1.0, incomeMultiplier: 1.0, canRelease: false, eventImmunity: true },
  },
};

export const DISTRICTS: District[] = [
  { id: "slums", name: "Трущобы", risk: 10, reward: { min: 30, max: 80 }, description: "Низкий риск, малая награда." },
  { id: "business", name: "Деловой центр", risk: 40, reward: { min: 100, max: 250 }, description: "Высокий риск, куш обеспечен." },
  { id: "park", name: "Старый Парк", risk: 20, reward: { min: 50, max: 120 }, description: "Средний риск." },
  { id: "residential", name: "Жилой массив", risk: 25, reward: { min: 60, max: 150 }, description: "Обычные жители." },
];

const EVENTS: GameEvent[] = [
  { id: "calm", text: "Тихая ночь. В городе спокойно.", type: "neutral", value: 1, duration: 1 },
  { id: "raid", text: "Облава! Полиция усилила патрули.", type: "risk", value: 1.5, duration: 1 },
  { id: "fair", text: "Ярмарка душ. Цены выросли.", type: "price", value: 1.3, duration: 1 },
  { id: "rain", text: "Дождливая погода. Меньше свидетелей.", type: "risk", value: 0.7, duration: 1 },
];

interface GameContextType {
  state: GameState;
  startGame: (cls: PlayerClass) => void;
  stealSoul: (districtId: string) => void;
  sellSoul: (soulIndex: number) => void;
  waitTurn: () => void;
  resetGame: () => void;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

const createInitialState = (): GameState => ({
  money: 0,
  wantedLevel: 0,
  turn: 1,
  inventory: [],
  playerClass: null,
  currentEvent: EVENTS[0],
  history: [],
  isGameOver: false,
  gameResult: null,
});

function getNextEvent(): GameEvent {
  return EVENTS[Math.floor(Math.random() * EVENTS.length)];
}

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<GameState>(() => {
    const fallback = createInitialState();
    if (typeof window === "undefined") return fallback;
    const saved = localStorage.getItem("soulBrokerState_v2");
    if (!saved) return fallback;
    try {
      return JSON.parse(saved) as GameState;
    } catch {
      return fallback;
    }
  });

  useEffect(() => {
    localStorage.setItem("soulBrokerState_v2", JSON.stringify(state));
  }, [state]);

  const checkWinCondition = useCallback((currentState: GameState): "win" | "loss" | null => {
    if (currentState.money >= GAME_GOAL) return "win";
    if (currentState.wantedLevel >= MAX_WANTED) return "loss";
    return null;
  }, []);

  const processTurn = useCallback(
    (actionUpdates: Partial<GameState>, actionLog: LogEntry) => {
      setState((prev) => {
        if (prev.isGameOver) return prev;

        const nextState = { ...prev, ...actionUpdates };
        const result = checkWinCondition(nextState);
        if (result) {
          return {
            ...nextState,
            isGameOver: true,
            gameResult: result,
            history: [actionLog, ...prev.history],
          };
        }

        const event = getNextEvent();
        const newTurn = prev.turn + 1;
        const eventLog: LogEntry = {
          id: Math.random().toString(),
          text: `Ход ${newTurn}: ${event.text}`,
          type: event.type === "neutral" ? "info" : event.type === "price" ? "success" : "warning",
          turn: newTurn,
        };

        return {
          ...nextState,
          turn: newTurn,
          currentEvent: event,
          history: [eventLog, actionLog, ...prev.history].slice(0, 50),
        };
      });
    },
    [checkWinCondition]
  );

  const startGame = useCallback((cls: PlayerClass) => {
    setState({
      ...createInitialState(),
      playerClass: cls,
      history: [{ id: "start", text: `Вы начали игру за класс: ${CLASSES[cls].name}`, type: "info", turn: 1 }],
    });
  }, []);

  const stealSoul = useCallback(
    (districtId: string) => {
      if (state.isGameOver || !state.playerClass) return;
      const district = DISTRICTS.find((d) => d.id === districtId);
      if (!district) return;

      const cls = CLASSES[state.playerClass].stats;
      let risk = district.risk;
      if (state.currentEvent?.type === "risk" && !cls.eventImmunity) {
        risk *= state.currentEvent.value;
      }

      const roll = Math.random() * 100;
      if (roll > risk) {
        const value = Math.floor(Math.random() * (district.reward.max - district.reward.min + 1)) + district.reward.min;
        const soul: Soul = {
          id: Math.random().toString(36).slice(2, 11),
          name: `Душа ${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
          value,
          origin: district.name,
        };
        processTurn(
          { inventory: [...state.inventory, soul] },
          { id: Math.random().toString(), text: `Успех! Украдена ${soul.name} (${value}) из ${district.name}`, type: "success", turn: state.turn }
        );
      } else {
        let penalty = 15;
        if (state.playerClass === "careerist") penalty *= cls.wantedRate;
        if (state.playerClass === "quiet") penalty *= cls.failReduction;
        processTurn(
          { wantedLevel: Math.min(MAX_WANTED, state.wantedLevel + Math.floor(penalty)) },
          { id: Math.random().toString(), text: `Провал! Вас заметили. Розыск +${Math.floor(penalty)}%`, type: "danger", turn: state.turn }
        );
      }
    },
    [processTurn, state]
  );

  const sellSoul = useCallback(
    (soulIndex: number) => {
      if (state.isGameOver || !state.playerClass) return;
      const soul = state.inventory[soulIndex];
      if (!soul) return;

      const cls = CLASSES[state.playerClass].stats;
      let price = soul.value * cls.sellMultiplier * cls.incomeMultiplier;
      if (state.currentEvent?.type === "price" && !cls.eventImmunity) {
        price *= state.currentEvent.value;
      }
      const finalPrice = Math.floor(price);
      const newInventory = [...state.inventory];
      newInventory.splice(soulIndex, 1);

      processTurn(
        { inventory: newInventory, money: state.money + finalPrice },
        { id: Math.random().toString(), text: `Продана ${soul.name} за ${finalPrice} монет.`, type: "success", turn: state.turn }
      );
    },
    [processTurn, state]
  );

  const waitTurn = useCallback(() => {
    processTurn(
      { wantedLevel: Math.max(0, state.wantedLevel - 20) },
      { id: Math.random().toString(), text: "Вы залегли на дно. Розыск снижен на 20%.", type: "info", turn: state.turn }
    );
  }, [processTurn, state.turn, state.wantedLevel]);

  const resetGame = useCallback(() => {
    localStorage.removeItem("soulBrokerState_v2");
    setState(createInitialState());
  }, []);

  return <GameContext.Provider value={{ state, startGame, stealSoul, sellSoul, waitTurn, resetGame }}>{children}</GameContext.Provider>;
}

export function useGame() {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error("useGame must be used within a GameProvider");
  }
  return context;
}

