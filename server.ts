import { createServer } from "node:http";
import next from "next";
import { Server } from "socket.io";
import { applyContractProgress, bumpDistrictHeat, computeStealRisk, createContracts, createDistrictHeatMap, decayDistrictHeat, DistrictHeatMap, DistrictId, getDistrictHeatRiskBonus, getNextActivePlayerIndex, isAllowedSocketOrigin, isStealSuccess, pickRotatingMarket, sanitizeChatText, shouldRemoveDisconnected, ContractProgress, createReconnectToken } from "./lib/game/core";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.APP_HOST || "0.0.0.0";
const port = Number(process.env.PORT || 3000);
const app = next({ dev, hostname, port });
const handler = app.getRequestHandler();

// в”Ђв”Ђв”Ђ CONFIG в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
const GAME_GOAL = 1500; // Increased goal
const MAX_WANTED = 100;
const TURN_TIMER_MS = 45000; // 45 seconds
const MAX_PLAYERS = 4;

const NAMES = [
    "Raven", "Shade", "Ghost", "Fox", "Jackal", "Cobra",
    "Wolf", "Hawk", "Scorpion", "Viper", "Panther", "Mantis"
];

type ClassId = "careerist" | "idealist" | "quiet" | "cynic";
type BuffId = "shadow_walk" | "insider";
type ClassConfig = {
    name: string;
    desc: string;
    stats: {
        sellMult: number;
        wantedRate: number;
        failReduction: number;
        eventImmunity: boolean;
    };
    ability: {
        id: "insider" | "preach" | "shadow" | "snitch";
        name: string;
        cooldown: number;
        desc: string;
    };
};

const CLASSES: Record<ClassId, ClassConfig> = {
    careerist: {
        name: "Карьерист",
        desc: "Мастер сделок. Активная способность: Продать душу x2.",
        stats: { sellMult: 1.2, wantedRate: 1.1, failReduction: 1.0, eventImmunity: false },
        ability: { id: 'insider', name: 'Инсайд', cooldown: 3, desc: 'Продать следующую душу в 2 раза дороже' }
    },
    idealist: {
        name: "Идеалист",
        desc: "Вдохновитель. Активная способность: Снизить розыск всем.",
        stats: { sellMult: 0.9, wantedRate: 0.9, failReduction: 1.0, eventImmunity: false },
        ability: { id: 'preach', name: 'Проповедь', cooldown: 4, desc: 'Снизить розыск себе (-30%) и другим (-10%)' }
    },
    quiet: {
        name: "Тихий",
        desc: "Невидимка. Активная способность: Безопасная кража.",
        stats: { sellMult: 1.0, wantedRate: 1.0, failReduction: 0.5, eventImmunity: false },
        ability: { id: 'shadow', name: 'Тень', cooldown: 3, desc: 'Следующая кража имеет 0% риска' }
    },
    cynic: {
        name: "Циник",
        desc: "Саботажник. Активная способность: Подставить соперника.",
        stats: { sellMult: 1.0, wantedRate: 1.0, failReduction: 1.0, eventImmunity: true },
        ability: { id: 'snitch', name: 'Донос', cooldown: 3, desc: 'Повысить розыск случайному сопернику на +25%' }
    }
};

const ITEMS = [
    { id: 'cloak', name: 'Плащ-невидимка', cost: 150, desc: 'Снижает риск кражи на 20% (пассивно)' },
    { id: 'dagger', name: 'Кинжал', cost: 200, desc: 'Увеличивает цену продажи души на 15% (пассивно)' },
    { id: 'intel_map', name: 'Intel Map', cost: 140, desc: '-10% steal risk (passive)' },
    { id: 'talisman', name: 'Luck Talisman', cost: 180, desc: '+20% loot value on successful steal (passive)' },
    { id: 'bribe', name: 'Взятка', cost: 100, desc: 'Мгновенно снижает розыск на 30%', consume: true }
];

const DISTRICTS = [
    { id: 'slums', name: 'Трущобы', risk: 10, minReward: 30, maxReward: 80 },
    { id: 'business', name: 'Деловой центр', risk: 50, minReward: 150, maxReward: 350 },
    { id: 'park', name: 'Старый Парк', risk: 25, minReward: 60, maxReward: 140 },
    { id: 'residential', name: 'Жилой массив', risk: 30, minReward: 80, maxReward: 180 }
];

const EVENTS = [
    { text: "Тихая ночь. Город спит.", riskMult: 1.0, priceMult: 1.0 },
    { text: "Облава! Полиция на чеку.", riskMult: 1.5, priceMult: 1.0 },
    { text: "Дефицит душ! Цены взлетели.", riskMult: 1.0, priceMult: 1.5 },
    { text: "Ливень. Свидетелей нет.", riskMult: 0.6, priceMult: 1.0 },
    { text: "Кровавая Луна. Ритуал требует жертв.", riskMult: 1.2, priceMult: 1.2 },
    { text: "Праздник в городе. Все пьяны.", riskMult: 0.5, priceMult: 0.8 },
    { text: "Комендантский час. Опасно!", riskMult: 1.8, priceMult: 1.1 }
];

const SOUL_NAMES = [
    "Поэта", "Убийцы", "Святоши", "Вора", "Короля",
    "Нищего", "Вдовы", "Солдата", "Шута", "Палача"
];

const ENCOUNTERS = [
    {
        id: 'cop', text: "Вас остановил патрульный!",
        options: [
            { id: 'run', text: "Бежать (50% шанс успеха, иначе +20% розыска)" },
            { id: 'bribe', text: "Дать взятку (-50 монет)", cost: 50 },
            { id: 'talk', text: "Заговорить зубы (Шанс зависит от класса)" }
        ]
    },
    {
        id: 'rival', text: "Конкурент предлагает сделку.",
        options: [
            { id: 'accept', text: "Купить инфу (-30 монет, -10% розыска)", cost: 30 },
            { id: 'ignore', text: "Игнорировать" },
            { id: 'rob', text: "Ограбить его (Риск!)" }
        ]
    }
];

// в”Ђв”Ђв”Ђ SERVER STATE в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

interface Soul { id: string; name: string; value: number; origin: string; }
interface MatchStats {
    successfulSteals: number;
    failedSteals: number;
    soulsSold: number;
    totalRevenue: number;
    turnsWaited: number;
    contractRewards: number;
    contractsCompleted: number;
    highestStreak: number;
}
interface Player {
    socketId: string;
    nickname: string;
    role: ClassId | null;
    money: number;
    wantedLevel: number;
    inventory: Soul[];
    items: string[];
    abilityCooldown: number;
    activeBuffs: BuffId[];
    stealStreak: number;
    contracts: ContractProgress[];
    visitedDistricts: DistrictId[];
    matchStats: MatchStats;
    isEliminated: boolean;
    reconnectToken: string;
    disconnectedAt: number | null;
}
interface EndgameEntry {
    socketId: string;
    nickname: string;
    money: number;
    wantedLevel: number;
    soulsSold: number;
    successfulSteals: number;
    failedSteals: number;
    contractRewards: number;
    contractsCompleted: number;
    highestStreak: number;
    isEliminated: boolean;
}
interface Room {
    id: string;
    players: Player[];
    status: 'lobby' | 'playing' | 'ended';
    turn: number;
    activePlayerIndex: number;
    currentEvent: { text: string; riskMult: number; priceMult: number };
    activeEncounter: { playerId: string; encounterId: string } | null;
    chat: { nickname: string; text: string; time: number }[];
    districtHeat: DistrictHeatMap;
    rotatingMarket: string[];
    turnTimer: ReturnType<typeof setTimeout> | null;
    turnDeadline: number;
    winner: string | null;
    endgameSummary: EndgameEntry[] | null;
}

const rooms: Record<string, Room> = {};
const usedNames: Record<string, string[]> = {};
const reconnectTimers: Record<string, ReturnType<typeof setTimeout>> = {};
const REJOIN_GRACE_MS = 45_000;

type JoinRoomAck = { roomId: string; playerId: string; nickname: string; reconnectToken: string };
type RejoinPayload = { roomId: string; reconnectToken: string };
type ChatMessagePayload = { roomId: string; text: string };
type ActionPayload = { roomId: string };
type ActionStealPayload = ActionPayload & { districtId: string };
type ActionSellPayload = ActionPayload & { soulIndex: number };
type ActionBuyPayload = ActionPayload & { itemId: string };
type ResolveEncounterPayload = ActionPayload & { optionId: string };
type ActionWaitPayload = ActionPayload;

function createEmptyMatchStats(): MatchStats {
    return {
        successfulSteals: 0,
        failedSteals: 0,
        soulsSold: 0,
        totalRevenue: 0,
        turnsWaited: 0,
        contractRewards: 0,
        contractsCompleted: 0,
        highestStreak: 0,
    };
}

function rerollRotatingMarket(room: Room) {
    room.rotatingMarket = pickRotatingMarket(ITEMS.map((item) => item.id), 3);
}

function grantContractRewards(io: Server, roomId: string, player: Player, reward: number) {
    if (reward <= 0) return;
    player.money += reward;
    player.matchStats.contractRewards += reward;
    player.matchStats.contractsCompleted += 1;
    emitLog(io, roomId, `Contract cleared: ${player.nickname} +${reward}$`, 'success');
}

function buildEndgameSummary(room: Room): EndgameEntry[] {
    return [...room.players]
        .map((player) => ({
            socketId: player.socketId,
            nickname: player.nickname,
            money: player.money,
            wantedLevel: player.wantedLevel,
            soulsSold: player.matchStats.soulsSold,
            successfulSteals: player.matchStats.successfulSteals,
            failedSteals: player.matchStats.failedSteals,
            contractRewards: player.matchStats.contractRewards,
            contractsCompleted: player.matchStats.contractsCompleted,
            highestStreak: player.matchStats.highestStreak,
            isEliminated: player.isEliminated,
        }))
        .sort((a, b) => b.money - a.money || b.successfulSteals - a.successfulSteals || a.wantedLevel - b.wantedLevel);
}

function finishGame(io: Server, roomId: string, winner: string | null) {
    const room = rooms[roomId];
    if (!room) return;
    room.status = 'ended';
    room.winner = winner;
    room.endgameSummary = buildEndgameSummary(room);
    if (room.turnTimer) {
        clearTimeout(room.turnTimer);
        room.turnTimer = null;
    }
    broadcastRoom(io, roomId);
}

function clearReconnectTimer(token: string) {
    const timer = reconnectTimers[token];
    if (timer) {
        clearTimeout(timer);
        delete reconnectTimers[token];
    }
}

function toClientRoom(room: Room) {
    const safe = {
        ...room,
        players: room.players.map((player) => ({
            socketId: player.socketId,
            nickname: player.nickname,
            role: player.role,
            money: player.money,
            wantedLevel: player.wantedLevel,
            inventory: player.inventory,
            items: player.items,
            abilityCooldown: player.abilityCooldown,
            activeBuffs: player.activeBuffs,
            stealStreak: player.stealStreak,
            contracts: player.contracts,
            matchStats: player.matchStats,
            isEliminated: player.isEliminated,
            isDisconnected: player.disconnectedAt !== null,
        })),
    };
    delete (safe as { turnTimer?: ReturnType<typeof setTimeout> | null }).turnTimer;
    return {
        ...safe,
    };
}

function pickName(roomId: string): string {
    if (!usedNames[roomId]) usedNames[roomId] = [];
    const available = NAMES.filter(n => !usedNames[roomId].includes(n));
    const name = available.length > 0 ? available[Math.floor(Math.random() * available.length)] : `Агент-${Math.floor(Math.random() * 999)}`;
    usedNames[roomId].push(name);
    return name;
}

function broadcastRoom(io: Server, roomId: string) {
    const room = rooms[roomId];
    if (!room) return;
    io.to(roomId).emit("room_update", toClientRoom(room));
}

function emitLog(io: Server, roomId: string, text: string, type: string) {
    io.to(roomId).emit("log", { id: Date.now().toString() + Math.random(), text, type, turn: rooms[roomId]?.turn || 0 });
}

function findRoomIdBySocket(socketId: string): string | null {
    for (const [roomId, room] of Object.entries(rooms)) {
        if (room.players.some((p) => p.socketId === socketId)) {
            return roomId;
        }
    }
    return null;
}

function cleanupRoomIfEmpty(io: Server, roomId: string) {
    const room = rooms[roomId];
    if (!room) return;
    if (room.players.length > 0) return;
    if (room.turnTimer) clearTimeout(room.turnTimer);
    delete rooms[roomId];
    delete usedNames[roomId];
}

function removePlayerFromRoom(io: Server, roomId: string, socketId: string) {
    const room = rooms[roomId];
    if (!room) return;
    const idx = room.players.findIndex((p) => p.socketId === socketId);
    if (idx < 0) return;
    const wasActivePlayer = idx === room.activePlayerIndex;
    const [removed] = room.players.splice(idx, 1);
    clearReconnectTimer(removed.reconnectToken);

    if (room.players.length === 0) {
        cleanupRoomIfEmpty(io, roomId);
        return;
    }

    if (idx < room.activePlayerIndex && room.activePlayerIndex > 0) {
        room.activePlayerIndex -= 1;
    }
    if (room.activePlayerIndex >= room.players.length) {
        room.activePlayerIndex = 0;
    }

    if (room.status === "playing") {
        const alive = room.players.filter((p) => !p.isEliminated);
        if (alive.length <= 1) {
            finishGame(io, roomId, alive[0]?.nickname || null);
        } else if (wasActivePlayer) {
            // Make the next player active without applying removed player's end-turn effects.
            room.activePlayerIndex -= 1;
            advanceTurn(io, roomId);
            return;
        }
    }
    broadcastRoom(io, roomId);
}

function startTurnTimer(io: Server, roomId: string) {
    const room = rooms[roomId];
    if (!room) return;
    if (room.turnTimer) clearTimeout(room.turnTimer);

    room.turnDeadline = Date.now() + TURN_TIMER_MS;
    io.to(roomId).emit("turn_deadline", room.turnDeadline);

    room.turnTimer = setTimeout(() => {
        // Auto-skip
        const player = room.players[room.activePlayerIndex];
        if (player && !player.isEliminated) {
            // Apply penalty for AFK
            player.wantedLevel = Math.min(MAX_WANTED, player.wantedLevel + 5);
            emitLog(io, roomId, `💤 ${player.nickname} уснул. Розыск +5%.`, 'warning');

            // Should also clear any active encounter if timed out
            if (room.activeEncounter && room.activeEncounter.playerId === player.socketId) {
                room.activeEncounter = null;
            }
        }
        advanceTurn(io, roomId);
    }, TURN_TIMER_MS);
}

function advanceTurn(io: Server, room_id: string) {
    const room = rooms[room_id];
    if (!room || room.status !== 'playing') return;

    // Cooldown reduction for current player
    const currP = room.players[room.activePlayerIndex];
    if (currP && currP.abilityCooldown > 0) currP.abilityCooldown--;
    // Clear temp buffs
    if (currP) currP.activeBuffs = currP.activeBuffs.filter(b => b !== 'shadow_walk' && b !== 'insider');

    // Find next player
    room.activePlayerIndex = getNextActivePlayerIndex(room.players, room.activePlayerIndex);

    // New Round Logic
    if (room.activePlayerIndex === 0) {
        room.turn++;
        room.currentEvent = EVENTS[Math.floor(Math.random() * EVENTS.length)];
        emitLog(io, room_id, `🌙 РАУНД ${room.turn}: ${room.currentEvent.text}`, 'info');
    }

    room.activeEncounter = null;

    // Game Over check
    const alive = room.players.filter(p => !p.isEliminated);
    if (alive.length === 0) {
        finishGame(io, room_id, null);
        return;
    }

    startTurnTimer(io, room_id);
    broadcastRoom(io, room_id);
}

function checkPlayerState(io: Server, roomId: string, player: Player) {
    const room = rooms[roomId];
    if (player.money >= GAME_GOAL) {
        room.status = 'ended';
        room.winner = player.nickname;
        emitLog(io, roomId, `👑 ${player.nickname} — КОРОЛЬ ДУШ! ПОБЕДА!`, 'success');
        if (room.turnTimer) clearTimeout(room.turnTimer);
        broadcastRoom(io, roomId);
        return true;
    }
    if (player.wantedLevel >= MAX_WANTED) {
        player.isEliminated = true;
        emitLog(io, roomId, `🚔 ${player.nickname} схвачен полицией!`, 'danger');

        const alive = room.players.filter(p => !p.isEliminated);
        if (alive.length === 1) {
            room.status = 'ended';
            room.winner = alive[0].nickname;
            emitLog(io, roomId, `🏆 ${alive[0].nickname} победил (остальные арестованы)!`, 'success');
            if (room.turnTimer) clearTimeout(room.turnTimer);
            broadcastRoom(io, roomId);
            return true;
        }
    }
    return false;
}

// в”Ђв”Ђв”Ђ MAIN в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

app.prepare().then(() => {
    const httpServer = createServer(handler);
    const staticAllowedOrigins = ["https://vibestudy.ru", "https://dead-souls-omega.vercel.app"];
    const io = new Server(httpServer, {
        cors: {
            origin: (origin, callback) => {
                if (isAllowedSocketOrigin(origin, staticAllowedOrigins)) return callback(null, true);
                return callback(new Error(`CORS blocked for origin: ${origin}`));
            },
            methods: ["GET", "POST"],
            credentials: true,
        },
    });

    io.on("connection", (socket) => {
        // --- Lobby ---
        socket.on("create_room", () => {
            const roomId = Math.random().toString(36).substring(2, 6).toUpperCase();
            rooms[roomId] = {
                id: roomId, players: [], status: 'lobby',
                turn: 0, activePlayerIndex: 0,
                currentEvent: EVENTS[0], chat: [], activeEncounter: null,
                districtHeat: createDistrictHeatMap(), rotatingMarket: [],
                turnTimer: null, turnDeadline: 0, winner: null, endgameSummary: null
            };
            rerollRotatingMarket(rooms[roomId]);
            socket.emit("room_created", roomId);
        });

        socket.on("join_room", (roomId: string) => {
            const room = rooms[roomId];
            if (!room || room.status !== 'lobby' || room.players.length >= MAX_PLAYERS) {
                return socket.emit("error_msg", "Не удалось войти");
            }
            if (room.players.find(p => p.socketId === socket.id)) return;

            const nickname = pickName(roomId);
            const reconnectToken = createReconnectToken();
            room.players.push({
                socketId: socket.id, nickname, role: null,
                money: 0, wantedLevel: 0, inventory: [], items: [],
                abilityCooldown: 0, activeBuffs: [], stealStreak: 0,
                contracts: [], visitedDistricts: [], matchStats: createEmptyMatchStats(),
                isEliminated: false, reconnectToken, disconnectedAt: null,
            });
            socket.join(roomId);
            const ack: JoinRoomAck = { roomId, playerId: socket.id, nickname, reconnectToken };
            socket.emit("joined_room", ack);
            broadcastRoom(io, roomId);
        });

        socket.on("rejoin_game", ({ roomId, reconnectToken }: RejoinPayload) => {
            const room = rooms[roomId];
            if (!room) return socket.emit("error_msg", "Комната не найдена");

            const player = room.players.find((p) => p.reconnectToken === reconnectToken);
            if (!player) return socket.emit("error_msg", "Игрок не найден");

            // Update socket ID
            clearReconnectTimer(player.reconnectToken);
            player.socketId = socket.id;
            player.disconnectedAt = null;
            socket.join(roomId);

            const ack: JoinRoomAck = { roomId, playerId: socket.id, nickname: player.nickname, reconnectToken: player.reconnectToken };
            socket.emit("joined_room", ack);
            emitLog(io, roomId, `♻️ ${player.nickname} вернулся в игру.`, 'info');
            broadcastRoom(io, roomId);
        });

        socket.on("start_game", (roomId: string) => {
            const room = rooms[roomId];
            if (!room || room.players[0].socketId !== socket.id) return;

            const roles = Object.keys(CLASSES) as ClassId[];
            // Shuffle
            for (let i = roles.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [roles[i], roles[j]] = [roles[j], roles[i]];
            }

            room.players.forEach((p, i) => {
                p.role = roles[i % roles.length];
                p.money = 20;
                p.wantedLevel = 0;
                p.inventory = [];
                p.items = [];
                p.abilityCooldown = 0;
                p.activeBuffs = [];
                p.stealStreak = 0;
                p.contracts = createContracts(2);
                p.visitedDistricts = [];
                p.matchStats = createEmptyMatchStats();
                p.isEliminated = false;
                p.disconnectedAt = null;
            });

            room.status = 'playing';
            room.turn = 1;
            room.activePlayerIndex = 0;
            room.currentEvent = EVENTS[Math.floor(Math.random() * EVENTS.length)];
            room.districtHeat = createDistrictHeatMap();
            room.endgameSummary = null;
            rerollRotatingMarket(room);

            emitLog(io, roomId, "💀 ИГРА НАЧАЛАСЬ! Цель: 1500 монет.", 'info');
            broadcastRoom(io, roomId);
            startTurnTimer(io, roomId);
        });

        // --- Gameplay Actions ---

        socket.on("action_steal", ({ roomId, districtId }: ActionStealPayload) => {
            const room = rooms[roomId];
            if (!room || room.status !== 'playing') return;
            const player = room.players[room.activePlayerIndex];
            if (player.socketId !== socket.id || player.isEliminated) return;
            if (room.activeEncounter) return; // Must resolve encounter first

            const dist = DISTRICTS.find(d => d.id === districtId);
            if (!dist) return;

            // Random Encounter Chance (20%)
            if (Math.random() < 0.2) {
                const enc = ENCOUNTERS[Math.floor(Math.random() * ENCOUNTERS.length)];
                room.activeEncounter = { playerId: socket.id, encounterId: enc.id };
                broadcastRoom(io, roomId);
                return;
            }

            // Standard Steal Logic
            resolveSteal(io, roomId, player, dist);
        });

        socket.on("action_rub_encounter", ({ roomId, optionId }: ResolveEncounterPayload) => {
            const room = rooms[roomId];
            if (!room || !room.activeEncounter) return;
            const player = room.players[room.activePlayerIndex];
            if (player.socketId !== socket.id) return;

            const encounterId = room.activeEncounter.encounterId;
            room.activeEncounter = null;
            let log = "";
            let type = "info";

            if (encounterId === "cop") {
                if (optionId === "run") {
                    if (Math.random() > 0.5) {
                        log = `🏃 ${player.nickname} сбежал от полиции!`;
                        type = "success";
                    } else {
                        player.wantedLevel += 20;
                        log = `👮 Провал! ${player.nickname} не смог убежать. Розыск +20%.`;
                        type = "danger";
                    }
                } else if (optionId === "bribe") {
                    if (player.money >= 50) {
                        player.money -= 50;
                        log = `💸 ${player.nickname} откупился (-50 монет).`;
                    } else {
                        player.wantedLevel += 15;
                        log = `⚠ Не хватило денег на взятку! Розыск +15%.`;
                        type = "danger";
                    }
                } else if (optionId === "talk") {
                    const charismaBonus = player.role === "idealist" ? 0.2 : 0;
                    if (Math.random() < 0.35 + charismaBonus) {
                        player.wantedLevel = Math.max(0, player.wantedLevel - 10);
                        log = `🗣️ ${player.nickname} заговорил патруль. Розыск -10%.`;
                        type = "success";
                    } else {
                        player.wantedLevel += 10;
                        log = `💢 ${player.nickname} нагрубил патрулю. Розыск +10%.`;
                        type = "warning";
                    }
                } else {
                    log = `${player.nickname} не понял ситуацию и пропустил момент.`;
                }
            } else if (encounterId === "rival") {
                if (optionId === "accept") {
                    if (player.money >= 30) {
                        player.money -= 30;
                        player.wantedLevel = Math.max(0, player.wantedLevel - 10);
                        log = `🧠 ${player.nickname} купил информацию и затаился. Розыск -10%.`;
                        type = "success";
                    } else {
                        player.wantedLevel += 10;
                        log = `💢 ${player.nickname} не оплатил сделку. Розыск +10%.`;
                        type = "danger";
                    }
                } else if (optionId === "rob") {
                    const rivalRisk = 35;
                    if (Math.random() * 100 > rivalRisk) {
                        const gain = 40 + Math.floor(Math.random() * 51);
                        player.money += gain;
                        log = `💼 ${player.nickname} обчистил конкурента на ${gain}$!`;
                        type = "success";
                    } else {
                        player.wantedLevel += 15;
                        log = `🚨 ${player.nickname} попался на глазах людей. Розыск +15%.`;
                        type = "danger";
                    }
                } else {
                    log = `${player.nickname} проигнорировал конкурента и ушел без шума.`;
                }
            } else {
                log = `${player.nickname} переждал неожиданную ситуацию.`;
            }

            emitLog(io, roomId, log, type);
            if (checkPlayerState(io, roomId, player)) return;
            advanceTurn(io, roomId);
        });

        socket.on("action_sell", ({ roomId, soulIndex }: ActionSellPayload) => {
            const room = rooms[roomId];
            if (!room) return;
            const player = room.players[room.activePlayerIndex];
            if (player.socketId !== socket.id) return;

            const soul = player.inventory[soulIndex];
            if (!soul) return;

            const cls = CLASSES[player.role!];
            let mult = cls.stats.sellMult * room.currentEvent.priceMult;

            if (player.items.includes('dagger')) mult += 0.15;
            if (player.activeBuffs.includes('insider')) mult *= 2;

            const price = Math.floor(soul.value * mult);
            player.inventory.splice(soulIndex, 1);
            player.money += price;
            player.matchStats.soulsSold += 1;
            player.matchStats.totalRevenue += price;
            const contractReward = applyContractProgress(player.contracts, [{ id: 'broker', amount: 1 }]);

            emitLog(io, roomId, `Deal closed: ${player.nickname} sold a soul for ${price} (x${mult.toFixed(1)})`, 'success');
            grantContractRewards(io, roomId, player, contractReward);

            if (checkPlayerState(io, roomId, player)) return;
            advanceTurn(io, roomId);
        });

        socket.on("action_buy", ({ roomId, itemId }: ActionBuyPayload) => {
            const room = rooms[roomId];
            if (!room) return;
            const player = room.players[room.activePlayerIndex];
            if (player.socketId !== socket.id) return;

            const item = ITEMS.find(i => i.id === itemId);
            if (!item) return;
            if (!room.rotatingMarket.includes(itemId)) return socket.emit("error_msg", "Lot is not on the market");
            if (player.money < item.cost) return socket.emit("error_msg", "Not enough cash");

            player.money -= item.cost;

            if (item.consume) {
                if (itemId === 'bribe') {
                    player.wantedLevel = Math.max(0, player.wantedLevel - 30);
                    emitLog(io, roomId, `Bribe paid: ${player.nickname} lowered wanted by 30%`, 'success');
                }
            } else {
                player.items.push(itemId);
                emitLog(io, roomId, `Market buy: ${player.nickname} picked up ${item.name}`, 'info');
            }

            const contractReward = applyContractProgress(player.contracts, [{ id: 'quartermaster', amount: 1 }]);
            grantContractRewards(io, roomId, player, contractReward);
            if (checkPlayerState(io, roomId, player)) return;
            advanceTurn(io, roomId);
        });

        socket.on("action_wait", ({ roomId }: ActionWaitPayload) => {
            const room = rooms[roomId];
            if (!room || room.status !== "playing") return;
            const player = room.players[room.activePlayerIndex];
            if (player.socketId !== socket.id || player.isEliminated) return;
            if (room.activeEncounter) return;

            const passiveIncome = Math.min(30, player.inventory.length * 5);
            if (passiveIncome > 0) {
                player.money += passiveIncome;
            }
            player.matchStats.turnsWaited += 1;
            player.wantedLevel = Math.max(0, player.wantedLevel - 20);
            room.districtHeat = decayDistrictHeat(room.districtHeat, 4);
            const hadStreak = player.stealStreak > 0;
            player.stealStreak = 0;
            emitLog(
                io,
                roomId,
                `🕶️ ${player.nickname} stayed low. Wanted -20%${passiveIncome > 0 ? `, +${passiveIncome}$ from contacts` : ""}${hadStreak ? ", combo reset" : ""}.`,
                "info"
            );

            if (checkPlayerState(io, roomId, player)) return;
            advanceTurn(io, roomId);
        });

        socket.on("action_ability", ({ roomId }: ActionPayload) => {
            const room = rooms[roomId];
            if (!room || room.status !== "playing") return;
            const player = room.players[room.activePlayerIndex];
            if (!player || player.socketId !== socket.id || player.isEliminated) return;
            if (room.activeEncounter) return;
            if (!player.role) return socket.emit("error_msg", "Роль не назначена");

            if (player.abilityCooldown > 0) return socket.emit("error_msg", "Способность на перезарядке");

            const cls = CLASSES[player.role];
            const ab = cls.ability;

            player.abilityCooldown = ab.cooldown + 1; // +1 because it decrements end of turn

            if (ab.id === 'insider') {
                player.activeBuffs.push('insider');
                emitLog(io, roomId, `📈 ${player.nickname} активировал ИНСАЙД! Следующая продажа x2.`, 'success');
                // Free action, turn doesn't end
                broadcastRoom(io, roomId);
                return;
            }

            if (ab.id === 'shadow') {
                player.activeBuffs.push('shadow_walk');
                emitLog(io, roomId, `👻 ${player.nickname} ушел в Тень. Безопасная кража.`, 'success');
                // Free action
                broadcastRoom(io, roomId);
                return;
            }

            if (ab.id === 'preach') {
                player.wantedLevel = Math.max(0, player.wantedLevel - 30);
                room.players.forEach(p => {
                    if (p.socketId !== player.socketId && !p.isEliminated) {
                        p.wantedLevel = Math.max(0, p.wantedLevel - 10);
                    }
                });
                emitLog(io, roomId, `🙏 ${player.nickname} смывает грехи. Розыск всем снижен!`, 'success');
                advanceTurn(io, roomId);
                return;
            }

            if (ab.id === 'snitch') {
                const targets = room.players.filter(p => !p.isEliminated && p.socketId !== player.socketId);
                if (targets.length > 0) {
                    const victim = targets[Math.floor(Math.random() * targets.length)];
                    victim.wantedLevel += 25;
                    emitLog(io, roomId, `🚔 ${player.nickname} сдал ${victim.nickname} полиции! (+25% розыска)`, 'danger');
                } else {
                    emitLog(io, roomId, `${player.nickname} хотел донести, но не на кого.`, 'warning');
                }
                advanceTurn(io, roomId);
                return;
            }
        });

        // Chat
        socket.on("chat_message", ({ roomId, text }: ChatMessagePayload) => {
            const room = rooms[roomId];
            if (room) {
                const player = room.players.find(p => p.socketId === socket.id);
                if (player) {
                    const sanitized = sanitizeChatText(text || "");
                    if (!sanitized) return;
                    room.chat.push({ nickname: player.nickname, text: sanitized, time: Date.now() });
                    if (room.chat.length > 50) room.chat.shift();
                    io.to(roomId).emit("chat_update", room.chat[room.chat.length - 1]);
                }
            }
        });

        // Disconnect
        socket.on("disconnect", () => {
            const roomId = findRoomIdBySocket(socket.id);
            if (!roomId) return;
            const room = rooms[roomId];
            if (!room) return;
            const player = room.players.find((p) => p.socketId === socket.id);
            if (!player) return;

            player.disconnectedAt = Date.now();
            emitLog(io, roomId, `🔌 ${player.nickname} отключился. Окно переподключения: ${REJOIN_GRACE_MS / 1000} сек.`, "warning");
            broadcastRoom(io, roomId);

            clearReconnectTimer(player.reconnectToken);
            reconnectTimers[player.reconnectToken] = setTimeout(() => {
                const targetRoom = rooms[roomId];
                if (!targetRoom) return;
                const samePlayer = targetRoom.players.find((p) => p.reconnectToken === player.reconnectToken);
                if (!samePlayer || !shouldRemoveDisconnected(samePlayer.disconnectedAt, Date.now(), REJOIN_GRACE_MS)) return;
                emitLog(io, roomId, `❌ ${samePlayer.nickname} не вернулся вовремя и был удален из игры.`, "danger");
                removePlayerFromRoom(io, roomId, samePlayer.socketId);
            }, REJOIN_GRACE_MS);
        });
    });

    httpServer.listen(port, () => console.log(`> Ready on http://${hostname}:${port}`));
});

type DistrictRuntime = (typeof DISTRICTS)[number];

function resolveSteal(io: Server, roomId: string, player: Player, dist: DistrictRuntime) {
    const room = rooms[roomId];
    const cls = CLASSES[player.role!];
    const districtId = dist.id as DistrictId;
    const heatBonus = getDistrictHeatRiskBonus(room.districtHeat, districtId);

    const risk = computeStealRisk({
        districtRisk: dist.risk,
        eventRiskMultiplier: room.currentEvent.riskMult,
        heatBonus,
        hasCloak: player.items.includes("cloak"),
        hasIntelMap: player.items.includes("intel_map"),
        hasShadowWalk: player.activeBuffs.includes("shadow_walk"),
    });

    const roll = Math.random() * 100;

    if (isStealSuccess(roll, risk)) {
        const rawVal = Math.floor(Math.random() * (dist.maxReward - dist.minReward)) + dist.minReward;
        const itemBoost = player.items.includes("talisman") ? 1.2 : 1;
        const streakBoost = 1 + Math.min(player.stealStreak * 0.04, 0.2);
        const val = Math.floor(rawVal * itemBoost * streakBoost);
        const name = `Soul ${SOUL_NAMES[Math.floor(Math.random() * SOUL_NAMES.length)]}`;
        player.inventory.push({ id: Date.now().toString(), name, value: val, origin: dist.name });
        player.stealStreak += 1;
        player.matchStats.successfulSteals += 1;
        player.matchStats.highestStreak = Math.max(player.matchStats.highestStreak, player.stealStreak);
        if (!player.visitedDistricts.includes(districtId)) {
            player.visitedDistricts.push(districtId);
        }
        room.districtHeat = bumpDistrictHeat(room.districtHeat, districtId, 12);
        const contractReward = applyContractProgress(player.contracts, [
            { id: 'runner', amount: 1 },
            { id: 'district_hopper', value: player.visitedDistricts.length },
        ]);
        emitLog(io, roomId, `Heist complete: ${player.nickname} took ${name} (${val}$) in ${dist.name}${heatBonus > 0 ? ` | heat +${heatBonus}%` : ''}${player.stealStreak > 1 ? ` | combo x${player.stealStreak}` : ''}`, 'success');
        grantContractRewards(io, roomId, player, contractReward);
    } else {
        let pen = 15;
        if (cls.stats.failReduction) pen *= cls.stats.failReduction;
        player.stealStreak = 0;
        player.matchStats.failedSteals += 1;
        player.wantedLevel += Math.floor(pen);
        room.districtHeat = bumpDistrictHeat(room.districtHeat, districtId, 18);
        emitLog(io, roomId, `Heist failed: ${player.nickname} got spotted in ${dist.name}. +${Math.floor(pen)}% wanted${heatBonus > 0 ? ` | heat +${heatBonus}%` : ''}`, 'danger');
    }

    if (checkPlayerState(io, roomId, player)) return;
    advanceTurn(io, roomId);
}




