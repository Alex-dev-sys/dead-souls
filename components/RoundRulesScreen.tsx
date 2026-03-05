"use client";

import { motion } from "framer-motion";
import { BookOpenText, ShieldAlert, Coins, Eye, Handshake } from "lucide-react";

type Rule = {
  title: string;
  text: string;
  icon: React.ComponentType<{ className?: string }>;
};

const RULES: Rule[] = [
  {
    title: "Цель раунда",
    text: "Набирай капитал быстрее соперников. Чем чище серия ходов, тем выше шанс вырваться в лидеры.",
    icon: Coins,
  },
  {
    title: "Риск и розыск",
    text: "Каждая операция повышает риск. Слишком высокий розыск может выбить тебя из темпа.",
    icon: Eye,
  },
  {
    title: "Предметы и умения",
    text: "Покупай усиления и жми способность класса вовремя. Это решает исход раунда.",
    icon: ShieldAlert,
  },
  {
    title: "Случайные события",
    text: "Встречи нужно решать сразу в mini-app. Выбор влияет на деньги, розыск и темп.",
    icon: Handshake,
  },
];

type Props = {
  onContinue: () => void;
};

export default function RoundRulesScreen({ onContinue }: Props) {
  return (
    <section className="min-h-screen flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        className="panel w-full max-w-3xl p-5 md:p-7"
      >
        <div className="flex items-center gap-3 mb-4 md:mb-6">
          <div className="w-11 h-11 rounded-xl bg-amber-400/10 border border-amber-300/30 flex items-center justify-center">
            <BookOpenText className="w-6 h-6 text-amber-300" />
          </div>
          <div>
            <p className="section-title">Перед началом</p>
            <h2 className="text-2xl md:text-3xl font-extrabold">Правила раунда</h2>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {RULES.map((item) => {
            const Icon = item.icon;
            return (
              <article key={item.title} className="panel p-4">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-sky-400/10 border border-sky-300/20 flex items-center justify-center mt-0.5">
                    <Icon className="w-4 h-4 text-sky-300" />
                  </div>
                  <div>
                    <h3 className="font-bold">{item.title}</h3>
                    <p className="text-sm text-slate-300/90 mt-1">{item.text}</p>
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        <div className="mt-4 md:mt-6 flex justify-end">
          <button className="btn btn-primary px-6" onClick={onContinue}>
            Понятно, начать раунд
          </button>
        </div>
      </motion.div>
    </section>
  );
}
