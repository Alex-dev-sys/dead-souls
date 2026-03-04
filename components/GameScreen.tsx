"use client";

import { useSocket, CLASSES_INFO } from "@/context/SocketContext";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { Coins, Eye, Trophy, Skull, Clock, Zap, AlertTriangle, User, SendHorizonal } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import CityMap from "./CityMap";

const ITEMS_INFO = [
  { id: "cloak", name: "Плащ", icon: "🥷", cost: 150, desc: "-20% риска кражи" },
  { id: "dagger", name: "Нож", icon: "🔪", cost: 200, desc: "+15% к цене души" },
  { id: "intel_map", name: "Карта", icon: "🗺️", cost: 140, desc: "-10% риска кражи" },
  { id: "talisman", name: "Талисман", icon: "🧿", cost: 180, desc: "+20% трофея при успехе" },
  { id: "bribe", name: "Взятка", icon: "💰", cost: 100, desc: "-30% розыска мгновенно" },
];

type EncounterInfo = {
  text: string;
  opts: Array<{ id: string; text: string; color: string }>;
};

const ENCOUNTERS_INFO: Record<string, EncounterInfo> = {
  cop: {
    text: "👮 ПАТРУЛЬ! Вас остановили.",
    opts: [
      { id: "run", text: "Бежать (50/50)", color: "bg-red-500" },
      { id: "bribe", text: "Взятка (50$)", color: "bg-yellow-500" },
      { id: "talk", text: "Заговорить", color: "bg-cyan-600" },
    ],
  },
  rival: {
    text: "🕵️ КОНКУРЕНТ предлагает сделку.",
    opts: [
      { id: "accept", text: "Купить инфу (30$)", color: "bg-blue-500" },
      { id: "ignore", text: "Игнор", color: "bg-gray-500" },
      { id: "rob", text: "Ограбить его", color: "bg-rose-600" },
    ],
  },
};

export default function GameScreen() {
  const {
    currentRoom,
    playerId,
    gameLogs,
    chatMessages,
    turnDeadline,
    sellSoul,
    buyItem,
    activateAbility,
    waitTurn,
    resolveEncounter,
    sendChat,
    errorMsg,
  } = useSocket();

  const [tab, setTab] = useState<"map" | "market">("map");
  const [mobilePanel, setMobilePanel] = useState<"players" | "logs" | "inventory" | "chat">("players");
  const [nowTs, setNowTs] = useState(() => Date.now());
  const [chatInput, setChatInput] = useState("");

  useEffect(() => {
    const timer = window.setInterval(() => setNowTs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  if (!currentRoom) return null;

  const me = currentRoom.players.find((p) => p.socketId === playerId);
  if (!me) return null;

  const activeP = currentRoom.players[currentRoom.activePlayerIndex];
  const isMyTurn = activeP?.socketId === playerId;
  const countdownSec = Math.max(0, Math.ceil((turnDeadline - nowTs) / 1000));
  const canSendChat = chatInput.trim().length > 0;

  const myEncounter = currentRoom.activeEncounter?.playerId === playerId ? currentRoom.activeEncounter : null;
  const encounterData = myEncounter ? ENCOUNTERS_INFO[myEncounter.encounterId] : null;

  const onSendChat = () => {
    const text = chatInput.trim();
    if (!text) return;
    sendChat(text);
    setChatInput("");
  };

  if (currentRoom.status === "ended") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-black/90">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="bg-card border border-white/10 p-8 rounded-2xl text-center space-y-6 max-w-md w-full">
          {currentRoom.winner === me.nickname ? <Trophy className="w-24 h-24 text-yellow-400 mx-auto animate-bounce" /> : <Skull className="w-24 h-24 text-gray-500 mx-auto" />}
          <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-yellow-400 to-orange-500">
            {currentRoom.winner === me.nickname ? "ТЫ ПОБЕДИЛ!" : "ИГРА ОКОНЧЕНА"}
          </h1>
          {currentRoom.winner && (
            <p className="text-xl text-gray-400">
              Победитель: <span className="text-white font-bold">{currentRoom.winner}</span>
            </p>
          )}

          <div className="space-y-2 pt-4 border-t border-white/10">
            {[...currentRoom.players]
              .sort((a, b) => b.money - a.money)
              .map((p, i) => (
                <div key={p.socketId} className="flex justify-between items-center bg-white/5 p-3 rounded">
                  <span className={cn(p.isEliminated && "line-through text-red-500")}>
                    {i + 1}. {p.nickname}
                  </span>
                  <span className="font-mono text-emerald-400">{p.money} 💎</span>
                </div>
              ))}
          </div>
          <button onClick={() => location.reload()} className="w-full py-4 bg-primary text-black font-bold rounded-xl hover:opacity-90">
            В ЛОББИ
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen max-w-6xl mx-auto p-2 gap-2 overflow-hidden relative game-shell">
      <AnimatePresence>
        {myEncounter && encounterData && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div initial={{ y: 50 }} animate={{ y: 0 }} className="bg-card border border-rose-500/50 p-6 rounded-2xl w-full max-w-md shadow-2xl shadow-rose-900/20">
              <AlertTriangle className="w-12 h-12 text-rose-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-center mb-6">{encounterData.text}</h2>
              <div className="space-y-3">
                {encounterData.opts.map((opt) => (
                  <button key={opt.id} onClick={() => resolveEncounter(opt.id)} className={cn("w-full py-4 rounded-xl font-bold text-white transition-transform active:scale-95", opt.color)}>
                    {opt.text}
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <header className="grid grid-cols-3 md:grid-cols-6 gap-2 bg-card/60 backdrop-blur border border-white/5 p-3 rounded-xl">
        <div className="flex items-center gap-2 text-cyan-400 font-mono">
          <Clock className="w-4 h-4" /> {countdownSec}s
        </div>
        <div className="flex items-center gap-2 text-emerald-400 font-bold">
          <Coins className="w-4 h-4" /> {me.money}
        </div>
        <div className={cn("flex items-center gap-2 font-bold", me.wantedLevel > 50 ? "text-rose-500 animate-pulse" : "text-gray-400")}>
          <Eye className="w-4 h-4" /> {me.wantedLevel}%
        </div>
        <div className="hidden md:flex items-center gap-2 text-purple-400 text-sm">
          <User className="w-4 h-4" /> {CLASSES_INFO[me.role as keyof typeof CLASSES_INFO]?.name}
        </div>
        <div className="col-span-2 flex gap-1 justify-end">
          {me.activeBuffs.map((b) => (
            <span key={b} className="text-[10px] bg-purple-500/20 text-purple-300 px-2 py-1 rounded border border-purple-500/30 uppercase">
              {b}
            </span>
          ))}
          {me.items.map((i) => (
            <span key={i} className="text-lg" title={i}>
              {ITEMS_INFO.find((x) => x.id === i)?.icon}
            </span>
          ))}
        </div>
      </header>

      <div className={cn("text-center py-2 rounded-lg font-bold text-sm transition-colors", isMyTurn ? "bg-emerald-900/30 text-emerald-400 border border-emerald-500/30" : "bg-black/40 text-gray-600")}>
        {isMyTurn ? "⚡ ВАШ ХОД" : `Ходит ${activeP?.nickname}...`}
      </div>

      <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-2 min-h-0 overflow-hidden">
        <div className="md:col-span-8 flex flex-col gap-2 min-h-0">
          <div className="flex gap-2">
            <button onClick={() => setTab("map")} className={cn("flex-1 py-3 rounded-lg font-medium text-sm transition-all", tab === "map" ? "bg-purple-600 text-white" : "bg-white/5 hover:bg-white/10")}>
              🗺️ КАРТА ГОРОДА
            </button>
            <button onClick={() => setTab("market")} className={cn("flex-1 py-3 rounded-lg font-medium text-sm transition-all", tab === "market" ? "bg-amber-600 text-white" : "bg-white/5 hover:bg-white/10")}>
              🛒 ЧЁРНЫЙ РЫНОК
            </button>
          </div>

          <div className="flex-1 bg-black/20 rounded-xl border border-white/5 overflow-hidden relative">
            {tab === "map" && (
              <div className="absolute inset-0 flex items-center justify-center">
                <CityMap />
              </div>
            )}

            {tab === "market" && (
              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 overflow-y-auto h-full">
                {ITEMS_INFO.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => isMyTurn && buyItem(item.id)}
                    disabled={!isMyTurn || me.money < item.cost}
                    className="bg-card/80 p-4 rounded-xl border border-white/10 flex flex-col items-center gap-2 hover:border-amber-500/50 disabled:opacity-50 disabled:hover:border-white/10 transition-colors"
                  >
                    <span className="text-4xl">{item.icon}</span>
                    <div className="text-center">
                      <div className="font-bold text-amber-100">{item.name}</div>
                      <div className="text-xs text-gray-400">{item.desc}</div>
                    </div>
                    <div className="mt-auto px-3 py-1 bg-amber-500/10 text-amber-400 rounded text-sm font-mono font-bold">{item.cost}$</div>
                  </button>
                ))}

                <div className="col-span-full border-t border-white/10 pt-4 mt-2">
                  <h3 className="text-gray-400 text-sm mb-2 uppercase tracking-widest">Способность класса</h3>
                  <button
                    onClick={() => isMyTurn && activateAbility()}
                    disabled={!isMyTurn || me.abilityCooldown > 0}
                    className="w-full py-4 bg-purple-900/30 border border-purple-500/30 rounded-xl hover:bg-purple-900/50 disabled:opacity-50 flex items-center justify-center gap-3"
                  >
                    <Zap className={cn("w-5 h-5", me.abilityCooldown === 0 ? "text-yellow-400" : "text-gray-500")} />
                    <div className="text-left">
                      <div className="font-bold text-purple-200">{CLASSES_INFO[me.role as keyof typeof CLASSES_INFO]?.name} Ability</div>
                      <div className="text-xs text-purple-400">{me.abilityCooldown > 0 ? `Перезарядка ${me.abilityCooldown} ход.` : "ГОТОВО К ИСПОЛЬЗОВАНИЮ"}</div>
                    </div>
                  </button>
                  <button
                    onClick={() => isMyTurn && waitTurn()}
                    disabled={!isMyTurn}
                    className="w-full mt-2 py-3 bg-cyan-900/30 border border-cyan-500/30 rounded-xl hover:bg-cyan-900/50 disabled:opacity-50 text-cyan-200 font-semibold"
                  >
                    Залечь на дно (пас хода)
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="hidden md:flex md:col-span-4 flex-col gap-2 min-h-0">
          <div className="bg-card/50 border border-white/5 rounded-xl p-3 max-h-[30%] overflow-y-auto">
            <div className="space-y-1">
              {currentRoom.players.map((p) => (
                <div
                  key={p.socketId}
                  className={cn(
                    "flex justify-between items-center text-xs p-2 rounded",
                    p.socketId === currentRoom.players[currentRoom.activePlayerIndex]?.socketId ? "bg-white/10" : "bg-black/20",
                    p.isEliminated && "opacity-40 italic"
                  )}
                >
                  <span className={cn("flex items-center gap-2", p.socketId === playerId && "text-primary")}>
                    {p.nickname}
                    {p.isDisconnected && <span className="text-[10px] px-1 py-0.5 rounded bg-amber-900/40 text-amber-300">off</span>}
                  </span>
                  <div className="flex gap-2 text-gray-400">
                    <span>👁{p.wantedLevel}%</span>
                    <span className="text-emerald-500">{p.money}$</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex-1 bg-black/40 rounded-xl border border-white/5 p-3 overflow-y-auto flex flex-col-reverse custom-scrollbar text-xs space-y-reverse space-y-1">
            {gameLogs.map((l) => (
              <div key={l.id} className={cn("p-2 rounded border-l-2", l.type === "success" ? "border-emerald-500 bg-emerald-900/20" : l.type === "danger" ? "border-rose-500 bg-rose-900/20" : "border-gray-600 bg-white/5")}>
                {l.text}
              </div>
            ))}
          </div>

          <div className="h-[24%] bg-card/50 border border-white/5 rounded-xl p-2 flex flex-col">
            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1 text-[11px]">
              {chatMessages.map((m, idx) => (
                <p key={`${m.time}-${idx}`} className="bg-black/30 rounded px-2 py-1">
                  <span className="text-cyan-300">{m.nickname}:</span> <span className="text-gray-200">{m.text}</span>
                </p>
              ))}
              {chatMessages.length === 0 && <p className="text-gray-600">Чат пока пуст.</p>}
            </div>
            <div className="mt-2 flex gap-2">
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && onSendChat()}
                maxLength={100}
                placeholder="Написать в чат..."
                className="flex-1 bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-primary"
              />
              <button onClick={onSendChat} disabled={!canSendChat} className="px-3 py-1.5 rounded-lg bg-primary text-black disabled:opacity-40">
                <SendHorizonal size={14} />
              </button>
            </div>
          </div>

          <div className="h-[16%] bg-card/50 border border-white/5 rounded-xl p-2 overflow-y-auto">
            <h4 className="text-[10px] uppercase text-gray-500 mb-1">Души ({me.inventory.length})</h4>
            <div className="flex flex-wrap gap-1">
              {me.inventory.map((s, i) => (
                <button
                  key={s.id}
                  onClick={() => isMyTurn && sellSoul(i)}
                  disabled={!isMyTurn}
                  className="bg-purple-900/40 border border-purple-500/20 text-purple-200 px-2 py-1 rounded text-[10px] hover:bg-purple-900/60 truncate max-w-full"
                >
                  {s.name} ({s.value}$)
                </button>
              ))}
              {me.inventory.length === 0 && <span className="text-gray-600 text-[10px]">Пусто</span>}
            </div>
          </div>
        </div>
      </div>

      <section className="md:hidden bg-card/50 border border-white/10 rounded-xl p-2 space-y-2 mobile-panel">
        <div className="grid grid-cols-4 gap-2">
          <button onClick={() => setMobilePanel("players")} className={cn("py-2 rounded-lg text-xs font-semibold", mobilePanel === "players" ? "bg-primary text-black" : "bg-black/30 text-gray-300")}>
            Игроки
          </button>
          <button onClick={() => setMobilePanel("logs")} className={cn("py-2 rounded-lg text-xs font-semibold", mobilePanel === "logs" ? "bg-primary text-black" : "bg-black/30 text-gray-300")}>
            Логи
          </button>
          <button onClick={() => setMobilePanel("inventory")} className={cn("py-2 rounded-lg text-xs font-semibold", mobilePanel === "inventory" ? "bg-primary text-black" : "bg-black/30 text-gray-300")}>
            Инвентарь
          </button>
          <button onClick={() => setMobilePanel("chat")} className={cn("py-2 rounded-lg text-xs font-semibold", mobilePanel === "chat" ? "bg-primary text-black" : "bg-black/30 text-gray-300")}>
            Чат
          </button>
        </div>

        {mobilePanel === "players" && (
          <div className="max-h-42 overflow-y-auto space-y-1 custom-scrollbar">
            {currentRoom.players.map((p) => (
              <div
                key={p.socketId}
                className={cn(
                  "flex justify-between items-center text-xs p-2 rounded",
                  p.socketId === currentRoom.players[currentRoom.activePlayerIndex]?.socketId ? "bg-white/10" : "bg-black/20",
                  p.isEliminated && "opacity-40 italic"
                )}
              >
                <span className={cn("flex items-center gap-1", p.socketId === playerId && "text-primary")}>
                  {p.nickname}
                  {p.isDisconnected && <span className="text-[10px] px-1 py-0.5 rounded bg-amber-900/40 text-amber-300">off</span>}
                </span>
                <div className="flex gap-2 text-gray-400">
                  <span>👁{p.wantedLevel}%</span>
                  <span className="text-emerald-500">{p.money}$</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {mobilePanel === "logs" && (
          <div className="max-h-42 overflow-y-auto flex flex-col-reverse custom-scrollbar text-xs space-y-reverse space-y-1">
            {gameLogs.map((l) => (
              <div key={l.id} className={cn("p-2 rounded border-l-2", l.type === "success" ? "border-emerald-500 bg-emerald-900/20" : l.type === "danger" ? "border-rose-500 bg-rose-900/20" : "border-gray-600 bg-white/5")}>
                {l.text}
              </div>
            ))}
          </div>
        )}

        {mobilePanel === "inventory" && (
          <div className="max-h-42 overflow-y-auto custom-scrollbar">
            <h4 className="text-[10px] uppercase text-gray-500 mb-2">Души ({me.inventory.length})</h4>
            <div className="flex flex-wrap gap-1">
              {me.inventory.map((s, i) => (
                <button
                  key={s.id}
                  onClick={() => isMyTurn && sellSoul(i)}
                  disabled={!isMyTurn}
                  className="bg-purple-900/40 border border-purple-500/20 text-purple-200 px-2 py-1 rounded text-[10px] hover:bg-purple-900/60 truncate max-w-full"
                >
                  {s.name} ({s.value}$)
                </button>
              ))}
              {me.inventory.length === 0 && <span className="text-gray-600 text-[10px]">Пусто</span>}
            </div>
          </div>
        )}

        {mobilePanel === "chat" && (
          <div className="max-h-42 overflow-y-auto custom-scrollbar">
            <div className="space-y-1 text-[11px] mb-2">
              {chatMessages.map((m, idx) => (
                <p key={`${m.time}-${idx}`} className="bg-black/30 rounded px-2 py-1">
                  <span className="text-cyan-300">{m.nickname}:</span> <span className="text-gray-200">{m.text}</span>
                </p>
              ))}
              {chatMessages.length === 0 && <p className="text-gray-600">Чат пока пуст.</p>}
            </div>
            <div className="flex gap-2">
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && onSendChat()}
                maxLength={100}
                placeholder="Сообщение..."
                className="flex-1 bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-primary"
              />
              <button onClick={onSendChat} disabled={!canSendChat} className="px-3 py-1.5 rounded-lg bg-primary text-black disabled:opacity-40">
                <SendHorizonal size={14} />
              </button>
            </div>
          </div>
        )}
      </section>

      {errorMsg && <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-rose-900/80 border border-rose-400/40 text-rose-100 text-xs px-3 py-2 rounded-lg z-50">{errorMsg}</div>}
    </div>
  );
}
