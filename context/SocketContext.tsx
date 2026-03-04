"use client";

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

interface Soul {
  id: string;
  name: string;
  value: number;
  origin: string;
}

interface Player {
  socketId: string;
  nickname: string;
  role: string;
  money: number;
  wantedLevel: number;
  inventory: Soul[];
  items: string[];
  abilityCooldown: number;
  activeBuffs: string[];
  isEliminated: boolean;
  isDisconnected?: boolean;
}

interface Room {
  id: string;
  players: Player[];
  status: "lobby" | "playing" | "ended";
  turn: number;
  activePlayerIndex: number;
  activeEncounter: { playerId: string; encounterId: string } | null;
  chat: ChatMessage[];
  turnDeadline: number;
  winner: string | null;
}

interface LogEntry {
  id: string;
  text: string;
  type: string;
  turn: number;
}

interface ChatMessage {
  nickname: string;
  text: string;
  time: number;
}

type OscType = OscillatorType;

interface JoinedRoomPayload {
  roomId: string;
  playerId: string;
  nickname: string;
  reconnectToken: string;
}

interface SessionData {
  roomId: string;
  reconnectToken: string;
}

export const CLASSES_INFO = {
  careerist: { name: "Карьерист", ability: "Инсайд (x2 цена)" },
  idealist: { name: "Идеалист", ability: "Проповедь (Снять розыск)" },
  quiet: { name: "Тихий", ability: "Тень (0% риск)" },
  cynic: { name: "Циник", ability: "Донос (+Розыск врагу)" },
};

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  currentRoom: Room | null;
  playerId: string | null;
  myNickname: string | null;
  gameLogs: LogEntry[];
  chatMessages: ChatMessage[];
  turnDeadline: number;
  errorMsg: string | null;
  lastLogId: string | null;

  createRoom: () => void;
  joinRoom: (id: string) => void;
  startGame: () => void;

  stealSoul: (distId: string) => void;
  sellSoul: (idx: number) => void;
  buyItem: (itemId: string) => void;
  activateAbility: () => void;
  resolveEncounter: (optId: string) => void;

  sendChat: (msg: string) => void;
  clearError: () => void;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [myNickname, setMyNickname] = useState<string | null>(null);
  const [gameLogs, setGameLogs] = useState<LogEntry[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [turnDeadline, setTurnDeadline] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastLogId, setLastLogId] = useState<string | null>(null);

  const roomIdRef = useRef<string | null>(null);

  const playSound = useCallback((freq: number, type: OscType = "sine") => {
    if (typeof window === "undefined") return;
    try {
      const AudioContextCtor = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextCtor) return;
      const ctx = new AudioContextCtor();
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = type;
      oscillator.frequency.value = freq;
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.3);
    } catch {
      // best-effort sound feedback
    }
  }, []);

  useEffect(() => {
    const socketBase = process.env.NEXT_PUBLIC_SOCKET_URL || undefined;
    const s = io(socketBase, { path: "/socket.io", autoConnect: true });

    s.on("connect", () => {
      setIsConnected(true);
      setSocket(s);
      setPlayerId(s.id || null);

      const rawSession = localStorage.getItem("sb_session");
      if (!rawSession) return;
      try {
        const session = JSON.parse(rawSession) as SessionData;
        if (!session.roomId || !session.reconnectToken) return;
        s.emit("rejoin_game", { roomId: session.roomId, reconnectToken: session.reconnectToken });
      } catch {
        localStorage.removeItem("sb_session");
      }
    });
    s.on("disconnect", () => setIsConnected(false));

    s.on("room_created", (id: string) => {
      s.emit("join_room", id);
    });

    s.on("joined_room", (payload: JoinedRoomPayload) => {
      setPlayerId(payload.playerId);
      setMyNickname(payload.nickname);
      roomIdRef.current = payload.roomId;
      localStorage.setItem("sb_session", JSON.stringify({ roomId: payload.roomId, reconnectToken: payload.reconnectToken }));
    });

    s.on("room_update", (room: Room) => setCurrentRoom(room));
    s.on("turn_deadline", (deadline: number) => setTurnDeadline(deadline));

    s.on("log", (entry: LogEntry) => {
      setGameLogs((prev) => [entry, ...prev].slice(0, 50));
      setLastLogId(entry.id);
      if (entry.type === "success") playSound(800, "sine");
      if (entry.type === "danger") playSound(300, "sawtooth");
      if (entry.type === "info") playSound(600, "sine");
    });

    s.on("chat_update", (message: ChatMessage) => {
      setChatMessages((prev) => [...prev, message].slice(-50));
    });

    s.on("error_msg", (message: string) => {
      setErrorMsg(message);
      setTimeout(() => setErrorMsg(null), 3000);

      if (message === "Комната не найдена" || message === "Игрок не найден") {
        setCurrentRoom(null);
        setPlayerId(null);
        setMyNickname(null);
        localStorage.removeItem("sb_session");
      }
    });

    return () => {
      s.disconnect();
      setSocket(null);
    };
  }, [playSound]);

  const emit = useCallback(
    (event: string, data?: Record<string, unknown>) => {
      if (!roomIdRef.current || !socket) return;
      socket.emit(event, data ? { ...data, roomId: roomIdRef.current } : roomIdRef.current);
    },
    [socket]
  );

  return (
    <SocketContext.Provider
      value={{
        socket,
        isConnected,
        currentRoom,
        playerId,
        myNickname,
        gameLogs,
        chatMessages,
        turnDeadline,
        errorMsg,
        lastLogId,
        createRoom: () => socket?.emit("create_room"),
        joinRoom: (id) => socket?.emit("join_room", id),
        startGame: () => emit("start_game"),
        stealSoul: (districtId) => emit("action_steal", { districtId }),
        sellSoul: (soulIndex) => emit("action_sell", { soulIndex }),
        buyItem: (itemId) => emit("action_buy", { itemId }),
        activateAbility: () => emit("action_ability", {}),
        resolveEncounter: (optionId) => emit("action_rub_encounter", { optionId }),
        sendChat: (text) => emit("chat_message", { text }),
        clearError: () => setErrorMsg(null),
      }}
    >
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const ctx = useContext(SocketContext);
  if (!ctx) {
    throw new Error("useSocket must be used within SocketProvider");
  }
  return ctx;
}
