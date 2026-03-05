"use client";

import { useSocket } from "@/context/SocketContext";
import { cn } from "@/lib/utils";

export default function CityMap() {
    const { stealSoul, currentRoom, playerId } = useSocket();

    const isMyTurn = currentRoom
        ? currentRoom.players[currentRoom.activePlayerIndex]?.socketId === playerId
        : false;

    // Deterministic "random" values to avoid hydration mismatch
    const windowLit = [
        [true, true, false, true, false, true, true, true, false, true, true, true,
            false, true, true, true, false, false, true, true, true, true, false, true,
            true, false, true, true, true, false, true, true, true, false, true, true],
        [true, false, true, true, true, true, false, true, true, true, true, false,
            true, true, false, true, true, true, false, true, true, true, true, false,
            true, true, true, false, true, true, true, true, false, true, true, true],
        [true, true, true, false, true, true, true, false, true, true, true, true,
            false, true, true, true, true, false, true, true],
        [true, false, true, true, true, false, true, true, true]
    ];

    const windowOpacity = [
        [0.7, 0.8, 0.6, 0.9, 0.7, 0.8, 0.65, 0.85, 0.7, 0.9, 0.75, 0.8,
            0.6, 0.85, 0.7, 0.9, 0.65, 0.7, 0.8, 0.75, 0.9, 0.7, 0.6, 0.85,
            0.8, 0.7, 0.9, 0.75, 0.8, 0.65, 0.85, 0.7, 0.9, 0.6, 0.8, 0.75],
        [0.8, 0.65, 0.9, 0.7, 0.85, 0.75, 0.6, 0.8, 0.9, 0.7, 0.85, 0.65,
            0.75, 0.9, 0.6, 0.8, 0.7, 0.85, 0.65, 0.9, 0.75, 0.8, 0.7, 0.6,
            0.85, 0.9, 0.7, 0.65, 0.8, 0.75, 0.9, 0.85, 0.6, 0.7, 0.8, 0.75],
        [0.7, 0.85, 0.9, 0.6, 0.75, 0.8, 0.9, 0.65, 0.85, 0.7, 0.8, 0.75,
            0.6, 0.9, 0.7, 0.85, 0.8, 0.65, 0.75, 0.9],
        [0.8, 0.7, 0.9, 0.75, 0.85, 0.65, 0.8, 0.7, 0.9]
    ];

    const treeSizes = [14, 11, 12, 10, 13, 11, 9, 12, 10, 13, 11, 14];
    const treeSizesSmall = [8, 7, 9, 6, 8, 7, 9, 6, 8, 7, 9, 6];
    const treeHues = [135, 145, 140, 150, 138, 142, 148, 136, 144, 140, 137, 146];
    const treeSats = [35, 40, 38, 42, 36, 44, 37, 41, 39, 43, 35, 40];
    const treeLights = [20, 22, 19, 24, 21, 23, 18, 25, 20, 22, 21, 19];

    const houseColors = [
        "hsl(20,20%,22%)", "hsl(28,23%,24%)", "hsl(36,26%,26%)",
        "hsl(44,29%,28%)", "hsl(52,32%,30%)", "hsl(20,23%,24%)",
        "hsl(28,26%,26%)", "hsl(36,29%,28%)", "hsl(44,32%,30%)"
    ];
    const houseDoors = [
        "hsl(20,20%,15%)", "hsl(30,20%,15%)", "hsl(40,20%,15%)",
        "hsl(50,20%,15%)", "hsl(60,20%,15%)", "hsl(70,20%,15%)",
        "hsl(80,20%,15%)", "hsl(90,20%,15%)", "hsl(100,20%,15%)"
    ];
    const houseWinOp = [
        [0.5, 0.6], [0.7, 0.4], [0.5, 0.6], [0.8, 0.5], [0.6, 0.7],
        [0.4, 0.5], [0.7, 0.6], [0.5, 0.8], [0.6, 0.4]
    ];
    const bushSizes = [7, 6, 8, 5];

    return (
        <div className="relative w-full aspect-[4/3] max-w-[700px] mx-auto rounded-xl overflow-hidden shadow-2xl border border-white/10">
            <svg viewBox="0 0 800 600" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <filter id="shadow" x="-10%" y="-10%" width="130%" height="130%">
                        <feDropShadow dx="2" dy="3" stdDeviation="2" floodOpacity="0.4" />
                    </filter>
                    <pattern id="grass" patternUnits="userSpaceOnUse" width="20" height="20">
                        <rect width="20" height="20" fill="#1a3a1a" />
                        <circle cx="5" cy="5" r="1" fill="#2d5a2d" opacity="0.5" />
                        <circle cx="15" cy="12" r="0.8" fill="#2d5a2d" opacity="0.4" />
                        <circle cx="10" cy="18" r="0.6" fill="#3a6a3a" opacity="0.3" />
                    </pattern>
                    <pattern id="water" patternUnits="userSpaceOnUse" width="30" height="10">
                        <rect width="30" height="10" fill="#1a2a4a" />
                        <path d="M0,5 Q7.5,2 15,5 T30,5" stroke="#2a4a7a" strokeWidth="0.5" fill="none" opacity="0.5" />
                    </pattern>
                    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#0a0a1a" />
                        <stop offset="100%" stopColor="#151530" />
                    </linearGradient>
                    <linearGradient id="roof-slum" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#5a3a2a" /><stop offset="100%" stopColor="#4a2a1a" />
                    </linearGradient>
                    <linearGradient id="roof-biz" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#4a6a8a" /><stop offset="100%" stopColor="#3a5a7a" />
                    </linearGradient>
                    <linearGradient id="roof-res" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#8a5a3a" /><stop offset="100%" stopColor="#7a4a2a" />
                    </linearGradient>
                </defs>

                {/* BG */}
                <rect width="800" height="600" fill="url(#sky)" />
                <rect width="800" height="600" fill="url(#grass)" opacity="0.8" />

                {/* ROADS */}
                <rect x="0" y="280" width="800" height="40" fill="#2a2a2a" rx="2" />
                <line x1="0" y1="300" x2="800" y2="300" stroke="#555" strokeWidth="1" strokeDasharray="12,8" />
                <rect x="380" y="0" width="40" height="600" fill="#2a2a2a" rx="2" />
                <line x1="400" y1="0" x2="400" y2="600" stroke="#555" strokeWidth="1" strokeDasharray="12,8" />
                <rect x="160" y="0" width="16" height="280" fill="#222" rx="1" />
                <rect x="600" y="320" width="16" height="280" fill="#222" rx="1" />
                <rect x="420" y="450" width="240" height="14" fill="#222" rx="1" />
                <rect x="0" y="140" width="380" height="14" fill="#222" rx="1" />
                <rect x="0" y="276" width="800" height="4" fill="#444" rx="1" />
                <rect x="0" y="320" width="800" height="4" fill="#444" rx="1" />
                <rect x="376" y="0" width="4" height="600" fill="#444" rx="1" />
                <rect x="420" y="0" width="4" height="600" fill="#444" rx="1" />

                {/* === DISTRICT 1: ТРУЩОБЫ (Top-Left) === */}
                <g
                    className={cn("cursor-pointer transition-all duration-300", isMyTurn ? "hover:opacity-90" : "opacity-70 cursor-not-allowed")}
                    onClick={() => isMyTurn && stealSoul('slums')}
                >
                    <rect x="30" y="60" width="50" height="60" fill="#3a3025" filter="url(#shadow)" />
                    <polygon points="25,60 55,35 85,60" fill="url(#roof-slum)" />
                    <rect x="45" y="85" width="12" height="20" fill="#2a2015" rx="1" />
                    <rect x="60" y="70" width="8" height="8" fill="#5a4a20" opacity="0.6" />
                    <rect x="35" y="70" width="8" height="8" fill="#6a5a30" opacity="0.4" />

                    <rect x="100" y="50" width="40" height="50" fill="#352a20" filter="url(#shadow)" />
                    <polygon points="95,50 120,30 145,50" fill="url(#roof-slum)" />
                    <rect x="112" y="75" width="10" height="18" fill="#251a10" rx="1" />
                    <rect x="105" y="58" width="7" height="7" fill="#5a4a20" opacity="0.5" />

                    <rect x="50" y="170" width="60" height="55" fill="#3a3525" filter="url(#shadow)" />
                    <polygon points="45,170 80,145 115,170" fill="url(#roof-slum)" />
                    <rect x="70" y="195" width="12" height="22" fill="#2a2015" rx="1" />
                    <rect x="55" y="178" width="8" height="8" fill="#5a4a20" opacity="0.5" />
                    <rect x="90" y="178" width="8" height="8" fill="#5a4a20" opacity="0.4" />

                    <ellipse cx="145" cy="115" rx="6" ry="8" fill="#4a3a20" stroke="#3a2a10" strokeWidth="1" />
                    <rect x="240" y="200" width="8" height="12" fill="#3a3020" />

                    <rect x="200" y="40" width="70" height="65" fill="#332a1a" filter="url(#shadow)" />
                    <polygon points="195,40 235,12 275,40" fill="url(#roof-slum)" />
                    <rect x="225" y="72" width="14" height="25" fill="#231a0a" rx="1" />
                    <rect x="205" y="50" width="9" height="9" fill="#5a4a20" opacity="0.5" />
                    <rect x="250" y="50" width="9" height="9" fill="#5a4a20" opacity="0.3" />

                    <rect x="290" y="55" width="30" height="20" fill="#2a3a2a" rx="2" stroke="#1a2a1a" strokeWidth="1" />

                    <line x1="20" y1="130" x2="90" y2="130" stroke="#4a3a20" strokeWidth="2" />
                    <line x1="20" y1="130" x2="20" y2="138" stroke="#4a3a20" strokeWidth="2" />
                    <line x1="40" y1="130" x2="40" y2="138" stroke="#4a3a20" strokeWidth="2" />
                    <line x1="55" y1="130" x2="55" y2="136" stroke="#4a3a20" strokeWidth="2" />

                    <rect x="250" y="170" width="55" height="50" fill="#3a3020" filter="url(#shadow)" />
                    <polygon points="245,170 277,148 310,170" fill="url(#roof-slum)" />
                    <rect x="268" y="193" width="10" height="20" fill="#2a2010" rx="1" />

                    <line x1="180" y1="155" x2="180" y2="130" stroke="#555" strokeWidth="2" />
                    <circle cx="180" cy="128" r="3" fill="#6a5a30" opacity="0.4" />

                    <text x="190" y="248" textAnchor="middle" className="fill-rose-400/70" style={{ fontSize: '9px' }}>Риск: 10%</text>
                    <text x="190" y="260" textAnchor="middle" className="fill-purple-300/80 font-bold" style={{ fontSize: '14px', letterSpacing: '3px' }}>ТРУЩОБЫ</text>
                </g>

                {/* === DISTRICT 2: ДЕЛОВОЙ ЦЕНТР (Top-Right) === */}
                <g
                    className={cn("cursor-pointer transition-all duration-300", isMyTurn ? "hover:opacity-90" : "opacity-70 cursor-not-allowed")}
                    onClick={() => isMyTurn && stealSoul('business')}
                >
                    {/* Skyscraper 1 */}
                    <rect x="450" y="20" width="50" height="250" fill="#2a3a5a" filter="url(#shadow)" />
                    {[...Array(12)].map((_, row) =>
                        [...Array(3)].map((_, col) => {
                            const i = row * 3 + col;
                            return (
                                <rect key={`w1-${i}`} x={456 + col * 15} y={30 + row * 20} width="8" height="10"
                                    fill={windowLit[0][i] ? "#4a7aaa" : "#2a3a5a"} opacity={windowOpacity[0][i]} rx="0.5" />
                            );
                        })
                    )}
                    <rect x="465" y="15" width="20" height="8" fill="#3a5a7a" />
                    <line x1="475" y1="15" x2="475" y2="5" stroke="#5a7a9a" strokeWidth="1.5" />
                    <circle cx="475" cy="4" r="2" fill="#f00" opacity="0.6" />

                    {/* Skyscraper 2 */}
                    <rect x="520" y="80" width="60" height="190" fill="#354555" filter="url(#shadow)" />
                    {[...Array(9)].map((_, row) =>
                        [...Array(4)].map((_, col) => {
                            const i = row * 4 + col;
                            return (
                                <rect key={`w2-${i}`} x={526 + col * 14} y={90 + row * 20} width="7" height="10"
                                    fill={windowLit[1][i] ? "#5a8aaa" : "#354555"} opacity={windowOpacity[1][i]} rx="0.5" />
                            );
                        })
                    )}

                    {/* Office building */}
                    <rect x="610" y="60" width="70" height="120" fill="#3a4a5a" filter="url(#shadow)" />
                    <rect x="610" y="55" width="70" height="8" fill="#4a6a8a" />
                    {[...Array(5)].map((_, row) =>
                        [...Array(4)].map((_, col) => {
                            const i = row * 4 + col;
                            return (
                                <rect key={`w3-${i}`} x={617 + col * 16} y={70 + row * 22} width="9" height="12"
                                    fill={windowLit[2][i] ? "#6a9aba" : "#3a4a5a"} opacity={windowOpacity[2][i]} rx="0.5" />
                            );
                        })
                    )}

                    {/* Small building */}
                    <rect x="700" y="140" width="50" height="80" fill="#3a485a" filter="url(#shadow)" />
                    <rect x="700" y="135" width="50" height="8" fill="#5a7a9a" />
                    {[...Array(3)].map((_, row) =>
                        [...Array(3)].map((_, col) => {
                            const i = row * 3 + col;
                            return (
                                <rect key={`w4-${i}`} x={706 + col * 15} y={150 + row * 22} width="8" height="12"
                                    fill={windowLit[3][i] ? "#5a8aba" : "#3a485a"} opacity={windowOpacity[3][i]} rx="0.5" />
                            );
                        })
                    )}

                    <line x1="500" y1="250" x2="500" y2="230" stroke="#6a7a8a" strokeWidth="2" />
                    <circle cx="500" cy="228" r="4" fill="#aaccff" opacity="0.3" />

                    <rect x="620" y="200" width="80" height="60" fill="#222" rx="3" />
                    <rect x="630" y="210" width="20" height="12" fill="#3a4a5a" rx="2" />
                    <rect x="660" y="210" width="20" height="12" fill="#4a3a3a" rx="2" />
                    <rect x="640" y="235" width="20" height="12" fill="#3a5a4a" rx="2" />

                    <text x="600" y="248" textAnchor="middle" className="fill-rose-400/70" style={{ fontSize: '9px' }}>Риск: 40%</text>
                    <text x="600" y="260" textAnchor="middle" className="fill-blue-300/80 font-bold" style={{ fontSize: '12px', letterSpacing: '2px' }}>ДЕЛОВОЙ ЦЕНТР</text>
                </g>

                {/* === DISTRICT 3: СТАРЫЙ ПАРК (Bottom-Left) === */}
                <g
                    className={cn("cursor-pointer transition-all duration-300", isMyTurn ? "hover:opacity-90" : "opacity-70 cursor-not-allowed")}
                    onClick={() => isMyTurn && stealSoul('park')}
                >
                    <ellipse cx="120" cy="440" rx="60" ry="30" fill="url(#water)" stroke="#2a4a6a" strokeWidth="1" />

                    {[
                        { x: 40, y: 350 }, { x: 80, y: 370 }, { x: 160, y: 340 }, { x: 250, y: 360 }, { x: 300, y: 390 },
                        { x: 50, y: 500 }, { x: 200, y: 480 }, { x: 280, y: 530 }, { x: 130, y: 550 }, { x: 340, y: 500 },
                        { x: 220, y: 400 }, { x: 310, y: 450 }
                    ].map((t, i) => (
                        <g key={`tree-${i}`}>
                            <rect x={t.x - 2} y={t.y} width="4" height="15" fill="#3a2a1a" />
                            <circle cx={t.x} cy={t.y - 5} r={treeSizes[i]} fill={`hsl(${treeHues[i]}, ${treeSats[i]}%, ${treeLights[i]}%)`} opacity="0.9" />
                            <circle cx={t.x + 4} cy={t.y - 8} r={treeSizesSmall[i]} fill={`hsl(${treeHues[i] + 5}, ${treeSats[i] + 5}%, ${treeLights[i] + 4}%)`} opacity="0.7" />
                        </g>
                    ))}

                    <rect x="170" y="430" width="25" height="6" fill="#5a3a1a" rx="1" />
                    <rect x="172" y="436" width="3" height="8" fill="#4a2a0a" />
                    <rect x="190" y="436" width="3" height="8" fill="#4a2a0a" />

                    <path d="M20,400 Q100,380 180,420 T340,370" stroke="#4a4a3a" strokeWidth="5" fill="none" strokeLinecap="round" />
                    <path d="M100,520 Q200,490 270,560" stroke="#4a4a3a" strokeWidth="4" fill="none" strokeLinecap="round" />

                    <circle cx="260" cy="460" r="15" fill="#1a2a4a" stroke="#3a5a7a" strokeWidth="1.5" />
                    <circle cx="260" cy="460" r="4" fill="#3a5a7a" />

                    <rect x="88" y="385" width="8" height="20" fill="#555" rx="1" />
                    <circle cx="92" cy="382" r="5" fill="#666" />

                    <text x="190" y="563" textAnchor="middle" className="fill-rose-400/70" style={{ fontSize: '9px' }}>Риск: 20%</text>
                    <text x="190" y="575" textAnchor="middle" className="fill-emerald-300/80 font-bold" style={{ fontSize: '13px', letterSpacing: '2px' }}>СТАРЫЙ ПАРК</text>
                </g>

                {/* === DISTRICT 4: ЖИЛОЙ МАССИВ (Bottom-Right) === */}
                <g
                    className={cn("cursor-pointer transition-all duration-300", isMyTurn ? "hover:opacity-90" : "opacity-70 cursor-not-allowed")}
                    onClick={() => isMyTurn && stealSoul('residential')}
                >
                    {[
                        { x: 450, y: 380, w: 55, h: 45 }, { x: 520, y: 370, w: 50, h: 50 }, { x: 590, y: 385, w: 55, h: 40 },
                        { x: 660, y: 375, w: 50, h: 45 }, { x: 735, y: 380, w: 45, h: 40 },
                        { x: 460, y: 490, w: 50, h: 45 }, { x: 530, y: 500, w: 55, h: 40 }, { x: 610, y: 485, w: 50, h: 50 },
                        { x: 690, y: 495, w: 55, h: 40 }
                    ].map((h, i) => (
                        <g key={`house-${i}`}>
                            <rect x={h.x} y={h.y} width={h.w} height={h.h} fill={houseColors[i]} filter="url(#shadow)" />
                            <polygon points={`${h.x - 5},${h.y} ${h.x + h.w / 2},${h.y - 18} ${h.x + h.w + 5},${h.y}`} fill="url(#roof-res)" />
                            <rect x={h.x + h.w / 2 - 5} y={h.y + h.h - 18} width="10" height="16" fill={houseDoors[i]} rx="1" />
                            <rect x={h.x + 6} y={h.y + 8} width="8" height="8" fill="#4a6a5a" opacity={houseWinOp[i][0]} rx="0.5" />
                            <rect x={h.x + h.w - 14} y={h.y + 8} width="8" height="8" fill="#5a7a6a" opacity={houseWinOp[i][1]} rx="0.5" />
                        </g>
                    ))}

                    <line x1="440" y1="440" x2="790" y2="440" stroke="#3a2a1a" strokeWidth="1.5" />
                    <line x1="440" y1="550" x2="790" y2="550" stroke="#3a2a1a" strokeWidth="1.5" />

                    {[{ x: 470, y: 455 }, { x: 560, y: 460 }, { x: 650, y: 455 }, { x: 740, y: 458 }].map((b, i) => (
                        <g key={`bush-${i}`}>
                            <circle cx={b.x} cy={b.y} r={bushSizes[i]} fill="#2a4a2a" opacity="0.8" />
                            <circle cx={b.x + 4} cy={b.y - 2} r={4} fill="#3a5a3a" opacity="0.6" />
                        </g>
                    ))}

                    <line x1="510" y1="465" x2="510" y2="445" stroke="#6a6a6a" strokeWidth="1.5" />
                    <circle cx="510" cy="443" r="3" fill="#ffaa55" opacity="0.25" />

                    <rect x="680" y="555" width="40" height="25" fill="#2a2a3a" rx="3" stroke="#4a4a5a" strokeWidth="0.5" />
                    <line x1="690" y1="555" x2="690" y2="545" stroke="#5a5a6a" strokeWidth="1" />
                    <line x1="710" y1="555" x2="710" y2="545" stroke="#5a5a6a" strokeWidth="1" />

                    <text x="610" y="563" textAnchor="middle" className="fill-rose-400/70" style={{ fontSize: '9px' }}>Риск: 25%</text>
                    <text x="610" y="575" textAnchor="middle" className="fill-orange-300/80 font-bold" style={{ fontSize: '12px', letterSpacing: '2px' }}>ЖИЛОЙ МАССИВ</text>
                </g>

                {/* CROSSROAD */}
                <circle cx="400" cy="300" r="20" fill="#2a2a2a" stroke="#555" strokeWidth="1" />
                <circle cx="400" cy="300" r="8" fill="#333" />

                {/* Hover overlays */}
                <rect x="5" y="5" width="370" height="270" rx="8" fill="transparent" stroke="transparent" className="hover:stroke-purple-500/50 hover:fill-purple-500/5 transition-all duration-500" strokeWidth="3" pointerEvents="none" />
                <rect x="425" y="5" width="370" height="270" rx="8" fill="transparent" stroke="transparent" className="hover:stroke-blue-500/50 hover:fill-blue-500/5 transition-all duration-500" strokeWidth="3" pointerEvents="none" />
                <rect x="5" y="325" width="370" height="270" rx="8" fill="transparent" stroke="transparent" className="hover:stroke-emerald-500/50 hover:fill-emerald-500/5 transition-all duration-500" strokeWidth="3" pointerEvents="none" />
                <rect x="425" y="325" width="370" height="270" rx="8" fill="transparent" stroke="transparent" className="hover:stroke-orange-500/50 hover:fill-orange-500/5 transition-all duration-500" strokeWidth="3" pointerEvents="none" />
            </svg>
        </div>
    );
}

