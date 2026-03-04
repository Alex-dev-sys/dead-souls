"use client";

import { useSocket } from "@/context/SocketContext";
import LobbyScreen from "@/components/LobbyScreen";
import GameScreen from "@/components/GameScreen";
import RoundRulesScreen from "@/components/RoundRulesScreen";
import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useState } from "react";

export default function Home() {
  const { currentRoom } = useSocket();
  const [acceptedRules, setAcceptedRules] = useState<Record<string, boolean>>({});

  const showGame = currentRoom && currentRoom.status !== 'lobby';
  const isFirstRound = currentRoom?.status === "playing" && currentRoom.turn === 0;
  const rulesKey = useMemo(() => (currentRoom?.id ? `sb_rules_seen_${currentRoom.id}` : null), [currentRoom?.id]);
  const showRoundRules = useMemo(() => {
    if (!rulesKey || !isFirstRound || typeof window === "undefined") return false;
    const persisted = sessionStorage.getItem(rulesKey) === "1";
    return !persisted && !acceptedRules[rulesKey];
  }, [acceptedRules, isFirstRound, rulesKey]);

  const acceptRules = () => {
    if (!rulesKey) return;
    sessionStorage.setItem(rulesKey, "1");
    setAcceptedRules((prev) => ({ ...prev, [rulesKey]: true }));
  };

  return (
    <main className="min-h-screen bg-background text-foreground font-sans overflow-hidden relative">
      <AnimatePresence mode="wait">
        {!showGame ? (
          <motion.div
            key="lobby"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="w-full h-full"
          >
            <LobbyScreen />
          </motion.div>
        ) : showRoundRules ? (
          <motion.div
            key="rules"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="w-full h-full"
          >
            <RoundRulesScreen onContinue={acceptRules} />
          </motion.div>
        ) : (
          <motion.div
            key="game"
            initial={{ opacity: 0, scale: 1.05 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full h-full"
          >
            <GameScreen />
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
