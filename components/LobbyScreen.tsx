"use client";

import { useSocket } from "@/context/SocketContext";
import { useState } from "react";
import { Copy, Users, Play, Check, MessageCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function LobbyScreen() {
    const { createRoom, joinRoom, currentRoom, startGame, playerId, isConnected } = useSocket();
    const [roomInput, setRoomInput] = useState("");
    const [copied, setCopied] = useState(false);

    const copyCode = () => {
        if (currentRoom) {
            navigator.clipboard.writeText(currentRoom.id);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    // In-room lobby view
    if (currentRoom && currentRoom.status === 'lobby') {
        const isHost = currentRoom.players[0]?.socketId === playerId;

        return (
            <div className="flex flex-col items-center justify-center min-h-screen p-4 space-y-6">
                <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
                    <h2 className="text-3xl font-bold text-center">
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600">Комната</span>
                    </h2>
                    <div className="flex items-center justify-center gap-3 mt-4">
                        <span className="text-4xl font-mono text-white tracking-[0.3em] bg-white/5 px-6 py-3 rounded-xl border border-white/10">
                            {currentRoom.id}
                        </span>
                        <button onClick={copyCode} className="p-3 bg-white/10 rounded-lg hover:bg-white/20 transition-colors" title="Копировать код">
                            {copied ? <Check className="w-5 h-5 text-emerald-400" /> : <Copy className="w-5 h-5 text-gray-400" />}
                        </button>
                    </div>
                </motion.div>

                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
                    className="bg-card/50 border border-white/10 p-6 rounded-xl w-full max-w-md backdrop-blur">
                    <h3 className="text-gray-400 mb-4 flex items-center gap-2">
                        <Users className="w-4 h-4" /> Игроки ({currentRoom.players.length}/4)
                    </h3>
                    <ul className="space-y-2">
                        <AnimatePresence>
                            {currentRoom.players.map((p, i) => (
                                <motion.li key={p.socketId}
                                    initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                                    className="bg-white/5 p-3 rounded-lg flex justify-between items-center border border-white/5">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${['bg-purple-600', 'bg-blue-600', 'bg-emerald-600', 'bg-orange-600'][i]
                                            }`}>
                                            {p.nickname[0]}
                                        </div>
                                        <span className="font-medium">{p.nickname}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {p.socketId === playerId && <span className="text-xs text-primary px-2 py-0.5 bg-primary/10 rounded-full">Вы</span>}
                                        {i === 0 && <span className="text-xs text-yellow-500 px-2 py-0.5 bg-yellow-500/10 rounded-full">Хост</span>}
                                    </div>
                                </motion.li>
                            ))}
                        </AnimatePresence>
                    </ul>
                </motion.div>

                {isHost ? (
                    <motion.button
                        whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                        onClick={startGame}
                        className="flex items-center gap-3 px-10 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-full shadow-lg shadow-purple-500/20 hover:shadow-purple-500/40 transition-shadow text-lg"
                    >
                        <Play className="w-6 h-6" /> Начать Игру
                    </motion.button>
                ) : (
                    <motion.p animate={{ opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 2 }}
                        className="text-gray-500 flex items-center gap-2">
                        <span className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" /> Ожидание хоста...
                    </motion.p>
                )}
            </div>
        );
    }

    // Landing / Join screen
    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4 space-y-10">
            <motion.div initial={{ opacity: 0, y: -30 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-3">
                <h1 className="text-6xl md:text-7xl font-bold text-transparent bg-clip-text bg-gradient-to-br from-purple-400 via-pink-500 to-orange-500 drop-shadow-[0_0_20px_rgba(168,85,247,0.4)]">
                    SOUL BROKER
                </h1>
                <p className="text-gray-400 text-lg tracking-[0.4em] uppercase">Город Мёртвых Душ</p>
                <div className="flex items-center justify-center gap-2 text-xs mt-4">
                    <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-red-500'} animate-pulse`} />
                    <span className={isConnected ? 'text-emerald-500' : 'text-red-500'}>{isConnected ? 'Подключено' : 'Подключение...'}</span>
                </div>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-3xl">
                <motion.div
                    initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}
                    whileHover={{ scale: 1.02, borderColor: 'rgba(168,85,247,0.5)' }}
                    className="bg-card/50 border border-white/10 p-8 rounded-2xl flex flex-col items-center space-y-4 cursor-pointer group backdrop-blur"
                    onClick={createRoom}
                >
                    <div className="p-5 rounded-2xl bg-gradient-to-br from-purple-600/20 to-pink-600/20 group-hover:from-purple-600/30 group-hover:to-pink-600/30 transition-colors">
                        <Play className="w-10 h-10 text-purple-400 group-hover:text-white transition-colors" />
                    </div>
                    <h3 className="text-xl font-bold">Создать Комнату</h3>
                    <p className="text-gray-500 text-center text-sm">Станьте хостом и пригласите друзей по коду</p>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}
                    className="bg-card/50 border border-white/10 p-8 rounded-2xl flex flex-col items-center space-y-4 backdrop-blur"
                >
                    <div className="p-5 rounded-2xl bg-gradient-to-br from-blue-600/20 to-cyan-600/20">
                        <MessageCircle className="w-10 h-10 text-blue-400" />
                    </div>
                    <h3 className="text-xl font-bold">Присоединиться</h3>
                    <div className="flex w-full gap-2">
                        <input
                            type="text" maxLength={6}
                            placeholder="КОД"
                            className="flex-1 bg-black/50 border border-white/20 rounded-lg px-4 py-3 text-center uppercase tracking-[0.3em] text-lg font-mono focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all"
                            value={roomInput}
                            onChange={(e) => setRoomInput(e.target.value.toUpperCase())}
                            onKeyDown={(e) => e.key === 'Enter' && joinRoom(roomInput)}
                        />
                        <button
                            onClick={() => joinRoom(roomInput)}
                            disabled={roomInput.length < 4}
                            className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 px-5 py-3 rounded-lg font-bold transition-colors"
                        >
                            GO
                        </button>
                    </div>
                </motion.div>
            </div>

            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
                className="text-gray-600 text-xs text-center max-w-md">
                Цель: набрать {1000} монет раньше соперников, воруя и продавая души. Берегитесь Розыска!
            </motion.p>

            <div className="flex gap-2 w-full max-w-md justify-center pt-4">
                <button
                    onClick={() => { localStorage.removeItem('sb_session'); location.reload(); }}
                    className="px-4 py-2 bg-red-900/10 text-red-500/50 rounded hover:bg-red-900/30 hover:text-red-400 text-[10px] transition-colors uppercase tracking-widest"
                >
                    Сброс сессии
                </button>
            </div>
        </div>
    );
}

