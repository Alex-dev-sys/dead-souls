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
    reward: "30-80",
    hint: "Низкий риск, быстрый старт и дешевые души.",
    emoji: "◓",
    tone: "from-rose-900/55 via-slate-900/75 to-slate-950/90 border-rose-500/35",
  },
  {
    id: "business",
    name: "Деловой центр",
    risk: 50,
    reward: "150-350",
    hint: "Самый жирный куш, но район быстро перегревается.",
    emoji: "▥",
    tone: "from-sky-800/55 via-slate-900/75 to-slate-950/90 border-sky-400/35",
  },
  {
    id: "park",
    name: "Старый парк",
    risk: 25,
    reward: "60-140",
    hint: "Стабильный фарм и мягкая кривая риска.",
    emoji: "△",
    tone: "from-emerald-900/55 via-slate-900/75 to-slate-950/90 border-emerald-400/35",
  },
  {
    id: "residential",
    name: "Жилой массив",
    risk: 30,
    reward: "80-180",
    hint: "Баланс дохода и давления, хороший универсальный ход.",
    emoji: "▣",
    tone: "from-amber-900/50 via-slate-900/75 to-slate-950/90 border-amber-400/35",
  },
];

function getHeatTone(heat: number) {
  if (heat >= 60) return "text-rose-300 border-rose-400/40 bg-rose-900/30";
  if (heat >= 30) return "text-amber-200 border-amber-400/40 bg-amber-900/25";
  return "text-emerald-200 border-emerald-400/30 bg-emerald-900/20";
}

export default function CityMap() {
  const { stealSoul, currentRoom, playerId } = useSocket();

  const isMyTurn = currentRoom
    ? currentRoom.players[currentRoom.activePlayerIndex]?.socketId === playerId
    : false;

  return (
    <div className="w-full h-full p-2 md:p-5">
      <div className="h-full rounded-2xl border border-slate-600/35 bg-[radial-gradient(circle_at_20%_20%,rgba(52,132,198,.18),transparent_36%),radial-gradient(circle_at_80%_10%,rgba(255,196,84,.14),transparent_32%),linear-gradient(180deg,rgba(10,20,31,.96),rgba(7,14,23,.98))] p-2.5 md:p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div>
            <p className="text-[10px] md:text-xs uppercase tracking-[0.22em] text-slate-400">Городские районы</p>
            <p className="text-[10px] md:text-xs text-slate-500">Жара района повышает риск и делает спам по одной точке хуже.</p>
          </div>
          <span
            className={cn(
              "text-[10px] md:text-xs px-2 py-1 rounded-full border whitespace-nowrap",
              isMyTurn ? "text-emerald-300 border-emerald-400/40 bg-emerald-900/25" : "text-slate-400 border-slate-600/40 bg-black/30"
            )}
          >
            {isMyTurn ? "Твой ход" : "Ожидание"}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 h-[calc(100%-52px)] md:h-[calc(100%-46px)]">
          {DISTRICTS.map((district) => {
            const heat = currentRoom?.districtHeat?.[district.id] ?? 0;
            return (
              <button
                key={district.id}
                onClick={() => isMyTurn && stealSoul(district.id)}
                disabled={!isMyTurn}
                className={cn(
                  "group text-left rounded-xl md:rounded-2xl border p-2.5 md:p-4 bg-gradient-to-br transition-all duration-200",
                  district.tone,
                  isMyTurn ? "hover:-translate-y-0.5 hover:shadow-[0_10px_26px_rgba(0,0,0,0.35)] active:translate-y-0" : "opacity-70 cursor-not-allowed"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-lg md:text-2xl leading-none text-slate-200">{district.emoji}</p>
                    <h3 className="mt-1 text-[13px] md:text-base font-extrabold leading-tight text-slate-100">{district.name}</h3>
                  </div>
                  <div className="flex flex-col gap-1 items-end">
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
                    <span className={cn("text-[10px] md:text-xs px-2 py-1 rounded-lg font-semibold border", getHeatTone(heat))}>
                      Жара {heat}%
                    </span>
                  </div>
                </div>

                <div className="mt-2 md:mt-3">
                  <p className="text-[10px] md:text-xs text-slate-300/90">Награда</p>
                  <p className="text-lg md:text-xl font-black tracking-wide text-amber-200">{district.reward}$</p>
                </div>

                <p className="mt-2 text-[10px] md:text-xs leading-tight text-slate-400">{district.hint}</p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
