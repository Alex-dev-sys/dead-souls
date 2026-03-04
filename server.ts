import { createServer } from "node:http";
import next from "next";
import { Server } from "socket.io";
import { computeStealRisk, createReconnectToken, getNextActivePlayerIndex, isStealSuccess, sanitizeChatText, shouldRemoveDisconnected } from "./lib/game/core";

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = 3000;
const app = next({ dev, hostname, port });
const handler = app.getRequestHandler();

// ─── CONFIG ────────────────────────────────────────
const GAME_GOAL = 1500; // Increased goal
const MAX_WANTED = 100;
const TURN_TIMER_MS = 45000; // 45 seconds
const MAX_PLAYERS = 4;

const NAMES = [
    "Ворон", "Тень", "Призрак", "Лис", "Шакал", "Кобра",
    "Волк", "Ястреб", "Скорпион", "Гадюка", "Пантера", "Мантис"
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
    { id: 'dagger', name: 'Ритуальный нож', cost: 200, desc: '+15% к цене душ (пассивно)' },
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

// ─── SERVER STATE ──────────────────────────────────

interface Soul { id: string; name: string; value: number; origin: string; }
interface Player {
    socketId: string;
    nickname: string;
    role: ClassId | null;
    money: number;
    wantedLevel: number;
    inventory: Soul[];
    items: string[];
    abilityCooldown: number;
    activeBuffs: BuffId[]; // e.g. 'shadow_walk', 'insider'
    isEliminated: boolean;
    reconnectToken: string;
    disconnectedAt: number | null;
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
    turnTimer: ReturnType<typeof setTimeout> | null;
    turnDeadline: number;
    winner: string | null;
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
            room.status = "ended";
            room.winner = alive[0]?.nickname || null;
            if (room.turnTimer) clearTimeout(room.turnTimer);
        } else if (idx === room.activePlayerIndex) {
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
        room.status = 'ended';
        broadcastRoom(io, room_id);
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

// ─── MAIN ──────────────────────────────────────────

app.prepare().then(() => {
    const httpServer = createServer(handler);
    const io = new Server(httpServer, {
        cors: {
            origin: [
                "https://dead-souls-omega.vercel.app",
                "https://dead-souls-frrpiu2tq-alexeys-projects-2260f6f3.vercel.app",
                "https://dead-souls-1a1htkcss-alexeys-projects-2260f6f3.vercel.app",
            ],
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
                turnTimer: null, turnDeadline: 0, winner: null
            };
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
                abilityCooldown: 0, activeBuffs: [], isEliminated: false,
                reconnectToken, disconnectedAt: null,
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
                p.money = 20; // Starting cash
                p.wantedLevel = 0;
                p.inventory = [];
                p.items = [];
                p.abilityCooldown = 0;
                p.activeBuffs = [];
                p.isEliminated = false;
                p.disconnectedAt = null;
            });

            room.status = 'playing';
            room.turn = 1;
            room.activePlayerIndex = 0;
            room.currentEvent = EVENTS[0];

            emitLog(io, roomId, "💀 ИБРА НАЧАЛАСЬ! Цель: 1500 монет.", 'info');
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

            // Simple resolution for now
            room.activeEncounter = null;
            let log = "";
            let type = "info";

            if (optionId === 'run') {
                if (Math.random() > 0.5) {
                    log = `🏃 ${player.nickname} сбежал от полиции!`;
                    type = 'success';
                } else {
                    player.wantedLevel += 20;
                    log = `👮 Провал! ${player.nickname} не смог убежать. Розыск +20%.`;
                    type = 'danger';
                }
            } else if (optionId === 'bribe') {
                if (player.money >= 50) {
                    player.money -= 50;
                    log = `💸 ${player.nickname} откупился (-50 монет).`;
                } else {
                    player.wantedLevel += 15;
                    log = `⛔ Не хватило денег на взятку! Розыск +15%.`;
                    type = 'danger';
                }
            } else {
                log = `${player.nickname} проигнорировал событие.`;
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

            // Items/Buffs
            if (player.items.includes('dagger')) mult += 0.15;
            if (player.activeBuffs.includes('insider')) mult *= 2;

            const price = Math.floor(soul.value * mult);
            player.inventory.splice(soulIndex, 1);
            player.money += price;

            emitLog(io, roomId, `💰 ${player.nickname} продал душу за ${price} (x${mult.toFixed(1)})`, 'success');

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
            if (player.money < item.cost) return socket.emit("error_msg", "Не хватает денег");

            player.money -= item.cost;

            if (item.consume) {
                // Instant effect
                if (itemId === 'bribe') {
                    player.wantedLevel = Math.max(0, player.wantedLevel - 30);
                    emitLog(io, roomId, `🤝 ${player.nickname} дал крупную взятку. Розыск -30%.`, 'success');
                }
            } else {
                // Inventory item
                player.items.push(itemId);
                emitLog(io, roomId, `🛒 ${player.nickname} купил предмет: ${item.name}`, 'info');
            }

            checkPlayerState(io, roomId, player);
            // Buying doesn't end turn instantly? Let's make it end turn for balance, or make it free action?
            // Let's make it end turn to prevent spam interaction
            advanceTurn(io, roomId);
        });

        socket.on("action_ability", ({ roomId }: ActionPayload) => {
            const room = rooms[roomId];
            if (!room) return;
            const player = room.players[room.activePlayerIndex];
            if (player.socketId !== socket.id) return;

            if (player.abilityCooldown > 0) return socket.emit("error_msg", "Способность на перезарядке");

            const cls = CLASSES[player.role!];
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

    const risk = computeStealRisk({
        districtRisk: dist.risk,
        eventRiskMultiplier: room.currentEvent.riskMult,
        hasCloak: player.items.includes("cloak"),
        hasShadowWalk: player.activeBuffs.includes("shadow_walk"),
    });

    const roll = Math.random() * 100;

    if (isStealSuccess(roll, risk)) {
        // Success
        const val = Math.floor(Math.random() * (dist.maxReward - dist.minReward)) + dist.minReward;
        const name = `Душа ${SOUL_NAMES[Math.floor(Math.random() * SOUL_NAMES.length)]}`;
        player.inventory.push({ id: Date.now().toString(), name, value: val, origin: dist.name });
        emitLog(io, roomId, `Completed Heist: ${player.nickname} stole ${name} (${val})`, 'success');
    } else {
        // Fail
        let pen = 15;
        if (cls.stats.failReduction) pen *= cls.stats.failReduction;
        player.wantedLevel += Math.floor(pen);
        emitLog(io, roomId, `Failed Heist: ${player.nickname} noticed! +${Math.floor(pen)}% Wanted`, 'danger');
    }

    if (checkPlayerState(io, roomId, player)) return;
    advanceTurn(io, roomId);
}
