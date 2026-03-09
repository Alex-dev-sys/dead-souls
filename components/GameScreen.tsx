"use client";

import { useSocket, CLASSES_INFO } from "@/context/SocketContext";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { Coins, Eye, Trophy, Skull, Clock, Zap, AlertTriangle, User, SendHorizonal, ChevronDown, ChevronUp } from "lucide-react";
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
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false);
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
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="panel p-8 text-center space-y-6 max-w-md w-full">
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
          <button
            onClick={() => {
              localStorage.removeItem("sb_session");
              location.reload();
            }}
            className="w-full btn btn-primary"
          >
            В ЛОББИ
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="ui-shell flex flex-col h-[100dvh] md:h-screen overflow-y-auto md:overflow-hidden relative game-shell pb-24 md:pb-0">
      <AnimatePresence>
        {myEncounter && encounterData && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div initial={{ y: 50 }} animate={{ y: 0 }} className="panel border-rose-500/50 p-6 w-full max-w-md shadow-2xl shadow-rose-900/20">
              <AlertTriangle className="w-12 h-12 text-rose-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-center mb-6">{encounterData.text}</h2>
              <div className="space-y-3">
                {encounterData.opts.map((opt) => (
                  <button key={opt.id} onClick={() => resolveEncounter(opt.id)} className={cn("w-full h-11 rounded-xl font-bold text-white transition-transform active:scale-95", opt.color)}>
                    {opt.text}
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <header className="grid grid-cols-2 md:grid-cols-7 gap-2 panel p-2 md:p-4">
        <div className="stat-pill gap-2 text-cyan-300 font-mono text-sm">
          <Clock className="w-4 h-4" /> {countdownSec}s
        </div>
        <div className="stat-pill gap-2 text-emerald-300 font-bold text-sm">
          <Coins className="w-4 h-4" /> {me.money}
        </div>
        <div className={cn("stat-pill gap-2 font-bold text-sm", me.wantedLevel > 50 ? "text-rose-400 animate-pulse" : "text-gray-300")}>
          <Eye className="w-4 h-4" /> {me.wantedLevel}%
        </div>
        <div className="stat-pill gap-2 text-amber-200 font-semibold text-xs md:text-sm">
          🔥 x{me.stealStreak}
        </div>
        <div className="stat-pill gap-2 text-sky-300 text-sm col-span-2 md:col-span-1">
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

      <div className={cn("text-center h-10 md:h-11 rounded-xl font-bold text-sm transition-colors flex items-center justify-center border", isMyTurn ? "bg-emerald-900/30 text-emerald-300 border-emerald-500/35 shadow-[0_0_18px_rgba(30,180,140,0.18)]" : "bg-black/40 text-gray-500 border-slate-700/40")}>
        {isMyTurn ? "⚡ ВАШ ХОД" : `Ходит ${activeP?.nickname}...`}
      </div>

      <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-2 min-h-0 md:overflow-hidden overflow-visible">
        <div className="md:col-span-8 flex flex-col gap-2 min-h-0">
          <div className="flex gap-2">
            <button onClick={() => setTab("map")} className={cn("btn flex-1 text-sm", tab === "map" ? "btn-secondary" : "btn-ghost")}>
              🗺️ КАРТА ГОРОДА
            </button>
            <button onClick={() => setTab("market")} className={cn("btn flex-1 text-sm", tab === "market" ? "btn-primary" : "btn-ghost")}>
              🛒 ЧЁРНЫЙ РЫНОК
            </button>
          </div>

          <div className="flex-1 panel overflow-hidden relative min-h-[430px] md:min-h-0">
            <div className="absolute top-2 left-3 z-10 text-[9px] uppercase tracking-[0.18em] text-slate-400">
              {tab === "map" ? "Оперативная карта" : "Торговый модуль"}
            </div>
            {tab === "map" && (
              <div className="absolute inset-0 flex items-center justify-center p-1.5 md:p-0">
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
                    className="panel min-h-[176px] p-4 flex flex-col items-center gap-2 hover:border-amber-500/50 disabled:opacity-50 disabled:hover:border-white/10 transition-colors"
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
                    className="w-full h-11 bg-sky-900/30 border border-sky-500/30 rounded-xl hover:bg-sky-900/45 disabled:opacity-50 flex items-center justify-center gap-3"
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
                    className="w-full btn btn-ghost mt-2 text-cyan-200 font-semibold"
                  >
                    Залечь на дно (пас хода)
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="hidden md:flex md:col-span-4 flex-col gap-2 min-h-0">
          <div className="panel p-3 max-h-[30%] overflow-y-auto">
            <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500 mb-2">Состав лобби</div>
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

          <div className="flex-1 panel p-3 overflow-y-auto flex flex-col-reverse custom-scrollbar text-xs space-y-reverse space-y-1">
            <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500 mb-2 sticky top-0">Лента событий</div>
            {gameLogs.map((l) => (
              <div key={l.id} className={cn("p-2 rounded border-l-2", l.type === "success" ? "border-emerald-500 bg-emerald-900/20" : l.type === "danger" ? "border-rose-500 bg-rose-900/20" : "border-gray-600 bg-white/5")}>
                {l.text}
              </div>
            ))}
          </div>

          <div className="h-[24%] panel p-2 flex flex-col">
            <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500 mb-2">Комм-канал</div>
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
                className="flex-1 ui-input h-8 text-xs"
              />
              <button onClick={onSendChat} disabled={!canSendChat} className="btn btn-primary h-8 px-3 py-0 disabled:opacity-40">
                <SendHorizonal size={14} />
              </button>
            </div>
          </div>

          <div className="h-[16%] panel p-2 overflow-y-auto">
            <h4 className="text-[10px] uppercase tracking-[0.18em] text-gray-500 mb-1">Трофеи ({me.inventory.length})</h4>
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

      <section className="md:hidden fixed left-2 right-2 bottom-[calc(env(safe-area-inset-bottom)+6px)] z-30 rounded-2xl border border-slate-600/40 bg-[linear-gradient(180deg,rgba(10,18,29,.96),rgba(7,13,22,.98))] shadow-[0_18px_40px_rgba(0,0,0,0.45)] backdrop-blur-xl p-2">
        <div className="flex items-center justify-between gap-2">
          <div className="grid grid-cols-4 gap-2 flex-1">
            <button onClick={() => { setMobilePanel("players"); setMobilePanelOpen(true); }} className={cn("btn h-11 rounded-xl text-xs font-semibold", mobilePanel === "players" ? "btn-primary" : "btn-ghost text-gray-300")}>
              Игроки
            </button>
            <button onClick={() => { setMobilePanel("logs"); setMobilePanelOpen(true); }} className={cn("btn h-11 rounded-xl text-xs font-semibold", mobilePanel === "logs" ? "btn-primary" : "btn-ghost text-gray-300")}>
              Логи
            </button>
            <button onClick={() => { setMobilePanel("inventory"); setMobilePanelOpen(true); }} className={cn("btn h-11 rounded-xl text-xs font-semibold", mobilePanel === "inventory" ? "btn-primary" : "btn-ghost text-gray-300")}>
              Инвентарь
            </button>
            <button onClick={() => { setMobilePanel("chat"); setMobilePanelOpen(true); }} className={cn("btn h-11 rounded-xl text-xs font-semibold", mobilePanel === "chat" ? "btn-primary" : "btn-ghost text-gray-300")}>
              Чат
            </button>
          </div>
          <button onClick={() => setMobilePanelOpen((v) => !v)} className="btn btn-ghost h-11 w-11 rounded-xl p-0 shrink-0" aria-label={mobilePanelOpen ? "Свернуть панель" : "Развернуть панель"}>
            {mobilePanelOpen ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
          </button>
        </div>

        {mobilePanelOpen && (
          <>
            {mobilePanel === "players" && (
              <div className="mt-2 max-h-[28vh] overflow-y-auto space-y-1 custom-scrollbar">
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
              <div className="mt-2 max-h-[28vh] overflow-y-auto flex flex-col-reverse custom-scrollbar text-xs space-y-reverse space-y-1">
                {gameLogs.map((l) => (
                  <div key={l.id} className={cn("p-2 rounded border-l-2", l.type === "success" ? "border-emerald-500 bg-emerald-900/20" : l.type === "danger" ? "border-rose-500 bg-rose-900/20" : "border-gray-600 bg-white/5")}>
                    {l.text}
                  </div>
                ))}
              </div>
            )}

            {mobilePanel === "inventory" && (
              <div className="mt-2 max-h-[28vh] overflow-y-auto custom-scrollbar">
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
              <div className="mt-2 max-h-[28vh] overflow-y-auto custom-scrollbar">
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
                    className="flex-1 ui-input h-8 text-xs"
                  />
                  <button onClick={onSendChat} disabled={!canSendChat} className="btn btn-primary h-8 px-3 py-0 disabled:opacity-40">
                    <SendHorizonal size={14} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </section>

      {errorMsg && <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-rose-900/80 border border-rose-400/40 text-rose-100 text-xs px-3 py-2 rounded-lg z-50">{errorMsg}</div>}
    </div>
  );
}
