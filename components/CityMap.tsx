"use client";

import { useSocket } from "@/context/SocketContext";
import { cn } from "@/lib/utils";

type DistrictView = {
  id: "slums" | "business" | "park" | "residential";
  name: string;
  risk: number;
  reward: string;
  hint: string;
  emoji: string;
  tone: string;
};

const DISTRICTS: DistrictView[] = [
  {
    id: "slums",
    name: "Трущобы",
    risk: 10,
    reward: "30–80",
    hint: "Низкий риск, стабильный фарм",
    emoji: "🕳️",
    tone: "from-rose-900/50 via-slate-900/70 to-slate-950/90 border-rose-500/35",
  },
  {
    id: "business",
    name: "Деловой центр",
    risk: 50,
    reward: "150–350",
    hint: "Высокий риск, лучший куш",
    emoji: "🏙️",
    tone: "from-sky-800/55 via-slate-900/70 to-slate-950/90 border-sky-400/35",
  },
  {
    id: "park",
    name: "Старый парк",
    risk: 25,
    reward: "60–140",
    hint: "Средний риск, плавный рост",
    emoji: "🌲",
    tone: "from-emerald-900/50 via-slate-900/70 to-slate-950/90 border-emerald-400/35",
  },
  {
    id: "residential",
    name: "Жилой массив",
    risk: 30,
    reward: "80–180",
    hint: "Баланс риска и прибыли",
    emoji: "🏘️",
    tone: "from-amber-900/45 via-slate-900/70 to-slate-950/90 border-amber-400/35",
  },
];

export default function CityMap() {
  const { stealSoul, currentRoom, playerId } = useSocket();

  const isMyTurn = currentRoom
    ? currentRoom.players[currentRoom.activePlayerIndex]?.socketId === playerId
    : false;

  return (
    <div className="w-full h-full p-3 md:p-5">
      <div className="h-full rounded-2xl border border-slate-600/35 bg-[radial-gradient(circle_at_20%_20%,rgba(52,132,198,.22),transparent_40%),radial-gradient(circle_at_80%_10%,rgba(255,196,84,.16),transparent_35%),linear-gradient(180deg,rgba(10,20,31,.95),rgba(7,14,23,.95))] p-3 md:p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] md:text-xs uppercase tracking-[0.22em] text-slate-400">Городские районы</p>
          <span
            className={cn(
              "text-[10px] md:text-xs px-2 py-1 rounded-full border",
              isMyTurn ? "text-emerald-300 border-emerald-400/40 bg-emerald-900/25" : "text-slate-400 border-slate-600/40 bg-black/30"
            )}
          >
            {isMyTurn ? "Твой ход" : "Ожидание"}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 md:gap-3 h-[calc(100%-28px)]">
          {DISTRICTS.map((district) => (
            <button
              key={district.id}
              onClick={() => isMyTurn && stealSoul(district.id)}
              disabled={!isMyTurn}
              className={cn(
                "group text-left rounded-xl md:rounded-2xl border p-2.5 md:p-4 bg-gradient-to-br transition-all duration-200",
                district.tone,
                isMyTurn
                  ? "hover:-translate-y-0.5 hover:shadow-[0_10px_26px_rgba(0,0,0,0.35)] active:translate-y-0"
                  : "opacity-65 cursor-not-allowed"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-base md:text-2xl leading-none">{district.emoji}</p>
                  <h3 className="mt-1 text-xs md:text-base font-extrabold text-slate-100">{district.name}</h3>
                </div>
                <span
                  className={cn(
                    "text-[10px] md:text-xs px-2 py-1 rounded-lg font-semibold border",
                    district.risk >= 45
                      ? "text-rose-200 bg-rose-900/30 border-rose-400/40"
                      : district.risk >= 30
                        ? "text-amber-200 bg-amber-900/30 border-amber-400/40"
                        : "text-emerald-200 bg-emerald-900/30 border-emerald-400/40"
                  )}
                >
                  Риск {district.risk}%
                </span>
              </div>

              <div className="mt-2 md:mt-3">
                <p className="text-[10px] md:text-xs text-slate-300/90">Награда</p>
                <p className="text-sm md:text-xl font-black tracking-wide text-amber-200">{district.reward}$</p>
              </div>

              <p className="mt-2 text-[10px] md:text-xs text-slate-400">{district.hint}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
