"use client";

import { useGame, CLASSES } from "@/context/GameContext";
import { motion } from "framer-motion";
import { Shield, TrendingUp, Ghost, EyeOff } from "lucide-react";
import { ComponentType } from "react";

export default function StartScreen() {
    const { startGame } = useGame();

    const iconMap: Record<string, ComponentType<{ className?: string }>> = {
        careerist: TrendingUp,
        idealist: Shield,
        quiet: EyeOff,
        cynic: Ghost
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center space-y-8 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-gray-900 via-[#0d0d12] to-[#0d0d12]">
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-2"
            >
                <h1 className="text-5xl md:text-7xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600 drop-shadow-[0_0_15px_rgba(168,85,247,0.5)]">
                    SOUL BROKER
                </h1>
                <p className="text-gray-400 text-lg tracking-widest uppercase">Город Душ ждет своего Оценщика</p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl w-full">
                {Object.values(CLASSES).map((cls, idx) => {
                    const Icon = iconMap[cls.id] || Ghost;
                    return (
                        <motion.div
                            key={cls.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.1 }}
                            whileHover={{ scale: 1.05, borderColor: "var(--primary)" }}
                            onClick={() => startGame(cls.id)}
                            className="bg-card/50 backdrop-blur-md border border-white/10 p-6 rounded-xl cursor-pointer hover:bg-card/80 transition-all group flex flex-col items-center gap-4 shadow-xl"
                        >
                            <div className="p-4 rounded-full bg-white/5 group-hover:bg-primary/20 transition-colors">
                                <Icon className="w-8 h-8 text-primary group-hover:text-white transition-colors" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-white mb-1">{cls.name}</h3>
                                <p className="text-sm text-gray-400 mb-4 h-10">{cls.description}</p>

                                <div className="space-y-2 text-xs">
                                    <p className="text-emerald-400 flex items-center justify-center gap-1">
                                        ▲ {cls.bonusText}
                                    </p>
                                    <p className="text-rose-400 flex items-center justify-center gap-1">
                                        ▼ {cls.malusText}
                                    </p>
                                </div>
                            </div>
                        </motion.div>
                    );
                })}
            </div>
        </div>
    );
}

