"use client";

import { useSocket } from "@/context/SocketContext";
import LobbyScreen from "@/components/LobbyScreen";
import GameScreen from "@/components/GameScreen";
import { AnimatePresence, motion } from "framer-motion";

export default function Home() {
  const { currentRoom } = useSocket();

  const showGame = currentRoom && currentRoom.status !== 'lobby';

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
