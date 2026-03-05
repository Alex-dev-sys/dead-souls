"use client";

import { useSocket } from "@/context/SocketContext";
import { useState } from "react";
import { Copy, Users, Play, Check, MessageCircle, PlusSquare, Wifi, WifiOff } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export default function LobbyScreen() {
  const { createRoom, joinRoom, currentRoom, startGame, playerId, isConnected } = useSocket();
  const [roomInput, setRoomInput] = useState("");
  const [copied, setCopied] = useState(false);

  const copyCode = () => {
    if (!currentRoom) return;
    navigator.clipboard.writeText(currentRoom.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (currentRoom && currentRoom.status === "lobby") {
    const isHost = currentRoom.players[0]?.socketId === playerId;

    return (
      <section className="min-h-screen flex items-center justify-center p-4">
        <div className="ui-shell w-full">
          <div className="panel p-5 md:p-6 max-w-2xl mx-auto">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="section-title">Код комнаты</p>
                <div className="mt-1 text-4xl md:text-5xl font-black tracking-[0.22em] text-amber-300">{currentRoom.id}</div>
              </div>
              <button onClick={copyCode} className="btn btn-ghost px-4 flex items-center gap-2" title="Копировать код">
                {copied ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                {copied ? "Скопировано" : "Копировать"}
              </button>
            </div>

            <div className="panel p-3 md:p-4 mt-4">
              <h3 className="section-title mb-2 flex items-center gap-2">
                <Users className="w-4 h-4" />
                Игроки ({currentRoom.players.length}/4)
              </h3>

              <ul className="space-y-2">
                <AnimatePresence>
                  {currentRoom.players.map((p, i) => (
                    <motion.li
                      key={p.socketId}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="h-12 px-3 rounded-xl border border-slate-600/30 bg-slate-950/35 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center text-xs font-extrabold",
                            ["bg-sky-700", "bg-emerald-700", "bg-amber-700", "bg-indigo-700"][i]
                          )}
                        >
                          {p.nickname[0]}
                        </div>
                        <span className="font-semibold">{p.nickname}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {p.socketId === playerId && <span className="text-[11px] px-2 py-1 rounded-lg bg-sky-900/40 text-sky-200">Вы</span>}
                        {i === 0 && <span className="text-[11px] px-2 py-1 rounded-lg bg-amber-900/40 text-amber-200">Хост</span>}
                      </div>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            </div>

            <div className="mt-4 flex justify-center">
              {isHost ? (
                <button onClick={startGame} className="btn btn-primary px-6 md:px-10 flex items-center gap-3">
                  <Play className="w-5 h-5" />
                  Начать игру
                </button>
              ) : (
                <p className="text-slate-300 text-sm h-11 flex items-center">Ожидание хоста...</p>
              )}
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="min-h-screen flex items-center justify-center p-4">
      <div className="ui-shell w-full">
        <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-5">
          <h1 className="text-5xl md:text-6xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-sky-200 via-amber-300 to-sky-400">
            DEAD SOULS
          </h1>
          <p className="mt-2 text-slate-300/90 tracking-[0.22em] uppercase text-xs md:text-sm">Mini App Lobby</p>
          <div className="mt-3 flex items-center justify-center gap-2 text-xs">
            {isConnected ? <Wifi className="w-4 h-4 text-emerald-300" /> : <WifiOff className="w-4 h-4 text-rose-300" />}
            <span className={isConnected ? "text-emerald-300" : "text-rose-300"}>{isConnected ? "Подключено" : "Нет соединения"}</span>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl mx-auto">
          <motion.article initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} className="panel p-5 md:p-6 min-h-[240px] flex flex-col">
            <div className="w-12 h-12 rounded-xl bg-amber-300/10 border border-amber-300/35 flex items-center justify-center mb-4">
              <PlusSquare className="w-6 h-6 text-amber-300" />
            </div>
            <h3 className="text-xl font-bold">Создать комнату</h3>
            <p className="text-slate-300/85 text-sm mt-2 flex-1">Стань хостом, получи код и пригласи друзей.</p>
            <button onClick={createRoom} className="btn btn-primary w-full mt-4">
              Создать
            </button>
          </motion.article>

          <motion.article initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} className="panel p-5 md:p-6 min-h-[240px] flex flex-col">
            <div className="w-12 h-12 rounded-xl bg-sky-300/10 border border-sky-300/35 flex items-center justify-center mb-4">
              <MessageCircle className="w-6 h-6 text-sky-300" />
            </div>
            <h3 className="text-xl font-bold">Войти в комнату</h3>
            <p className="text-slate-300/85 text-sm mt-2">Введи код хоста и подключись к матчу.</p>

            <div className="mt-4 flex gap-2">
              <input
                type="text"
                maxLength={6}
                placeholder="КОД"
                className="ui-input flex-1 uppercase tracking-[0.3em] text-center font-mono"
                value={roomInput}
                onChange={(e) => setRoomInput(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && joinRoom(roomInput)}
              />
              <button onClick={() => joinRoom(roomInput)} disabled={roomInput.length < 4} className="btn btn-secondary px-4">
                GO
              </button>
            </div>
          </motion.article>
        </div>

        <div className="mt-5 flex justify-center">
          <button
            onClick={() => {
              localStorage.removeItem("sb_session");
              location.reload();
            }}
            className="btn btn-ghost px-4 text-xs uppercase tracking-wide"
          >
            Сброс сессии
          </button>
        </div>
      </div>
    </section>
  );
}
