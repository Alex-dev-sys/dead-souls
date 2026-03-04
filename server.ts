import { createServer } from "node:http";
import next from "next";
import { Server } from "socket.io";
import { computeStealRisk, createReconnectToken, getNextActivePlayerIndex, isStealSuccess, sanitizeChatText, shouldRemoveDisconnected } from "./lib/game/core";

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = 3000;
const app = next({ dev, hostname, port });
const handler = app.getRequestHandler();

// в”Ђв”Ђв”Ђ CONFIG в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
const GAME_GOAL = 1500; // Increased goal
const MAX_WANTED = 100;
const TURN_TIMER_MS = 45000; // 45 seconds
const MAX_PLAYERS = 4;

const NAMES = [
    "Р’РѕСЂРѕРЅ", "РўРµРЅСЊ", "РџСЂРёР·СЂР°Рє", "Р›РёСЃ", "РЁР°РєР°Р»", "РљРѕР±СЂР°",
    "Р’РѕР»Рє", "РЇСЃС‚СЂРµР±", "РЎРєРѕСЂРїРёРѕРЅ", "Р“Р°РґСЋРєР°", "РџР°РЅС‚РµСЂР°", "РњР°РЅС‚РёСЃ"
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
        name: "РљР°СЂСЊРµСЂРёСЃС‚",
        desc: "РњР°СЃС‚РµСЂ СЃРґРµР»РѕРє. РђРєС‚РёРІРЅР°СЏ СЃРїРѕСЃРѕР±РЅРѕСЃС‚СЊ: РџСЂРѕРґР°С‚СЊ РґСѓС€Сѓ x2.",
        stats: { sellMult: 1.2, wantedRate: 1.1, failReduction: 1.0, eventImmunity: false },
        ability: { id: 'insider', name: 'РРЅСЃР°Р№Рґ', cooldown: 3, desc: 'РџСЂРѕРґР°С‚СЊ СЃР»РµРґСѓСЋС‰СѓСЋ РґСѓС€Сѓ РІ 2 СЂР°Р·Р° РґРѕСЂРѕР¶Рµ' }
    },
    idealist: {
        name: "РРґРµР°Р»РёСЃС‚",
        desc: "Р’РґРѕС…РЅРѕРІРёС‚РµР»СЊ. РђРєС‚РёРІРЅР°СЏ СЃРїРѕСЃРѕР±РЅРѕСЃС‚СЊ: РЎРЅРёР·РёС‚СЊ СЂРѕР·С‹СЃРє РІСЃРµРј.",
        stats: { sellMult: 0.9, wantedRate: 0.9, failReduction: 1.0, eventImmunity: false },
        ability: { id: 'preach', name: 'РџСЂРѕРїРѕРІРµРґСЊ', cooldown: 4, desc: 'РЎРЅРёР·РёС‚СЊ СЂРѕР·С‹СЃРє СЃРµР±Рµ (-30%) Рё РґСЂСѓРіРёРј (-10%)' }
    },
    quiet: {
        name: "РўРёС…РёР№",
        desc: "РќРµРІРёРґРёРјРєР°. РђРєС‚РёРІРЅР°СЏ СЃРїРѕСЃРѕР±РЅРѕСЃС‚СЊ: Р‘РµР·РѕРїР°СЃРЅР°СЏ РєСЂР°Р¶Р°.",
        stats: { sellMult: 1.0, wantedRate: 1.0, failReduction: 0.5, eventImmunity: false },
        ability: { id: 'shadow', name: 'РўРµРЅСЊ', cooldown: 3, desc: 'РЎР»РµРґСѓСЋС‰Р°СЏ РєСЂР°Р¶Р° РёРјРµРµС‚ 0% СЂРёСЃРєР°' }
    },
    cynic: {
        name: "Р¦РёРЅРёРє",
        desc: "РЎР°Р±РѕС‚Р°Р¶РЅРёРє. РђРєС‚РёРІРЅР°СЏ СЃРїРѕСЃРѕР±РЅРѕСЃС‚СЊ: РџРѕРґСЃС‚Р°РІРёС‚СЊ СЃРѕРїРµСЂРЅРёРєР°.",
        stats: { sellMult: 1.0, wantedRate: 1.0, failReduction: 1.0, eventImmunity: true },
        ability: { id: 'snitch', name: 'Р”РѕРЅРѕСЃ', cooldown: 3, desc: 'РџРѕРІС‹СЃРёС‚СЊ СЂРѕР·С‹СЃРє СЃР»СѓС‡Р°Р№РЅРѕРјСѓ СЃРѕРїРµСЂРЅРёРєСѓ РЅР° +25%' }
    }
};

const ITEMS = [
    { id: 'cloak', name: 'РџР»Р°С‰-РЅРµРІРёРґРёРјРєР°', cost: 150, desc: 'РЎРЅРёР¶Р°РµС‚ СЂРёСЃРє РєСЂР°Р¶Рё РЅР° 20% (РїР°СЃСЃРёРІРЅРѕ)' },
    { id: 'dagger', name: 'РљРёРЅР¶Р°Р»', cost: 200, desc: 'РЈРІРµР»РёС‡РёРІР°РµС‚ С†РµРЅСѓ РїСЂРѕРґР°Р¶Рё РґСѓС€Рё РЅР° 15% (РїР°СЃСЃРёРІРЅРѕ)' },
    { id: 'intel_map', name: 'Intel Map', cost: 140, desc: '-10% steal risk (passive)' },
    { id: 'talisman', name: 'Luck Talisman', cost: 180, desc: '+20% loot value on successful steal (passive)' },
    { id: 'bribe', name: 'Р’Р·СЏС‚РєР°', cost: 100, desc: 'РњРіРЅРѕРІРµРЅРЅРѕ СЃРЅРёР¶Р°РµС‚ СЂРѕР·С‹СЃРє РЅР° 30%', consume: true }
];

const DISTRICTS = [
    { id: 'slums', name: 'РўСЂСѓС‰РѕР±С‹', risk: 10, minReward: 30, maxReward: 80 },
    { id: 'business', name: 'Р”РµР»РѕРІРѕР№ С†РµРЅС‚СЂ', risk: 50, minReward: 150, maxReward: 350 },
    { id: 'park', name: 'РЎС‚Р°СЂС‹Р№ РџР°СЂРє', risk: 25, minReward: 60, maxReward: 140 },
    { id: 'residential', name: 'Р–РёР»РѕР№ РјР°СЃСЃРёРІ', risk: 30, minReward: 80, maxReward: 180 }
];

const EVENTS = [
    { text: "РўРёС…Р°СЏ РЅРѕС‡СЊ. Р“РѕСЂРѕРґ СЃРїРёС‚.", riskMult: 1.0, priceMult: 1.0 },
    { text: "РћР±Р»Р°РІР°! РџРѕР»РёС†РёСЏ РЅР° С‡РµРєСѓ.", riskMult: 1.5, priceMult: 1.0 },
    { text: "Р”РµС„РёС†РёС‚ РґСѓС€! Р¦РµРЅС‹ РІР·Р»РµС‚РµР»Рё.", riskMult: 1.0, priceMult: 1.5 },
    { text: "Р›РёРІРµРЅСЊ. РЎРІРёРґРµС‚РµР»РµР№ РЅРµС‚.", riskMult: 0.6, priceMult: 1.0 },
    { text: "РљСЂРѕРІР°РІР°СЏ Р›СѓРЅР°. Р РёС‚СѓР°Р» С‚СЂРµР±СѓРµС‚ Р¶РµСЂС‚РІ.", riskMult: 1.2, priceMult: 1.2 },
    { text: "РџСЂР°Р·РґРЅРёРє РІ РіРѕСЂРѕРґРµ. Р’СЃРµ РїСЊСЏРЅС‹.", riskMult: 0.5, priceMult: 0.8 },
    { text: "РљРѕРјРµРЅРґР°РЅС‚СЃРєРёР№ С‡Р°СЃ. РћРїР°СЃРЅРѕ!", riskMult: 1.8, priceMult: 1.1 }
];

const SOUL_NAMES = [
    "РџРѕСЌС‚Р°", "РЈР±РёР№С†С‹", "РЎРІСЏС‚РѕС€Рё", "Р’РѕСЂР°", "РљРѕСЂРѕР»СЏ",
    "РќРёС‰РµРіРѕ", "Р’РґРѕРІС‹", "РЎРѕР»РґР°С‚Р°", "РЁСѓС‚Р°", "РџР°Р»Р°С‡Р°"
];

const ENCOUNTERS = [
    {
        id: 'cop', text: "Р’Р°СЃ РѕСЃС‚Р°РЅРѕРІРёР» РїР°С‚СЂСѓР»СЊРЅС‹Р№!",
        options: [
            { id: 'run', text: "Р‘РµР¶Р°С‚СЊ (50% С€Р°РЅСЃ СѓСЃРїРµС…Р°, РёРЅР°С‡Рµ +20% СЂРѕР·С‹СЃРєР°)" },
            { id: 'bribe', text: "Р”Р°С‚СЊ РІР·СЏС‚РєСѓ (-50 РјРѕРЅРµС‚)", cost: 50 },
            { id: 'talk', text: "Р—Р°РіРѕРІРѕСЂРёС‚СЊ Р·СѓР±С‹ (РЁР°РЅСЃ Р·Р°РІРёСЃРёС‚ РѕС‚ РєР»Р°СЃСЃР°)" }
        ]
    },
    {
        id: 'rival', text: "РљРѕРЅРєСѓСЂРµРЅС‚ РїСЂРµРґР»Р°РіР°РµС‚ СЃРґРµР»РєСѓ.",
        options: [
            { id: 'accept', text: "РљСѓРїРёС‚СЊ РёРЅС„Сѓ (-30 РјРѕРЅРµС‚, -10% СЂРѕР·С‹СЃРєР°)", cost: 30 },
            { id: 'ignore', text: "РРіРЅРѕСЂРёСЂРѕРІР°С‚СЊ" },
            { id: 'rob', text: "РћРіСЂР°Р±РёС‚СЊ РµРіРѕ (Р РёСЃРє!)" }
        ]
    }
];

// в”Ђв”Ђв”Ђ SERVER STATE в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

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
type ActionWaitPayload = ActionPayload;

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
    const name = available.length > 0 ? available[Math.floor(Math.random() * available.length)] : `РђРіРµРЅС‚-${Math.floor(Math.random() * 999)}`;
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
            emitLog(io, roomId, `рџ’¤ ${player.nickname} СѓСЃРЅСѓР». Р РѕР·С‹СЃРє +5%.`, 'warning');

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
        emitLog(io, room_id, `рџЊ™ Р РђРЈРќР” ${room.turn}: ${room.currentEvent.text}`, 'info');
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
        emitLog(io, roomId, `рџ‘‘ ${player.nickname} вЂ” РљРћР РћР›Р¬ Р”РЈРЁ! РџРћР‘Р•Р”Рђ!`, 'success');
        if (room.turnTimer) clearTimeout(room.turnTimer);
        broadcastRoom(io, roomId);
        return true;
    }
    if (player.wantedLevel >= MAX_WANTED) {
        player.isEliminated = true;
        emitLog(io, roomId, `рџљ” ${player.nickname} СЃС…РІР°С‡РµРЅ РїРѕР»РёС†РёРµР№!`, 'danger');

        const alive = room.players.filter(p => !p.isEliminated);
        if (alive.length === 1) {
            room.status = 'ended';
            room.winner = alive[0].nickname;
            emitLog(io, roomId, `рџЏ† ${alive[0].nickname} РїРѕР±РµРґРёР» (РѕСЃС‚Р°Р»СЊРЅС‹Рµ Р°СЂРµСЃС‚РѕРІР°РЅС‹)!`, 'success');
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
                return socket.emit("error_msg", "РќРµ СѓРґР°Р»РѕСЃСЊ РІРѕР№С‚Рё");
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
            if (!room) return socket.emit("error_msg", "РљРѕРјРЅР°С‚Р° РЅРµ РЅР°Р№РґРµРЅР°");

            const player = room.players.find((p) => p.reconnectToken === reconnectToken);
            if (!player) return socket.emit("error_msg", "РРіСЂРѕРє РЅРµ РЅР°Р№РґРµРЅ");

            // Update socket ID
            clearReconnectTimer(player.reconnectToken);
            player.socketId = socket.id;
            player.disconnectedAt = null;
            socket.join(roomId);

            const ack: JoinRoomAck = { roomId, playerId: socket.id, nickname: player.nickname, reconnectToken: player.reconnectToken };
            socket.emit("joined_room", ack);
            emitLog(io, roomId, `в™»пёЏ ${player.nickname} РІРµСЂРЅСѓР»СЃСЏ РІ РёРіСЂСѓ.`, 'info');
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

            emitLog(io, roomId, "рџ’Ђ РР‘Р Рђ РќРђР§РђР›РђРЎР¬! Р¦РµР»СЊ: 1500 РјРѕРЅРµС‚.", 'info');
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

            // Items/Buffs
            if (player.items.includes('dagger')) mult += 0.15;
            if (player.activeBuffs.includes('insider')) mult *= 2;

            const price = Math.floor(soul.value * mult);
            player.inventory.splice(soulIndex, 1);
            player.money += price;

            emitLog(io, roomId, `рџ’° ${player.nickname} РїСЂРѕРґР°Р» РґСѓС€Сѓ Р·Р° ${price} (x${mult.toFixed(1)})`, 'success');

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
            if (player.money < item.cost) return socket.emit("error_msg", "РќРµ С…РІР°С‚Р°РµС‚ РґРµРЅРµРі");

            player.money -= item.cost;

            if (item.consume) {
                // Instant effect
                if (itemId === 'bribe') {
                    player.wantedLevel = Math.max(0, player.wantedLevel - 30);
                    emitLog(io, roomId, `рџ¤ќ ${player.nickname} РґР°Р» РєСЂСѓРїРЅСѓСЋ РІР·СЏС‚РєСѓ. Р РѕР·С‹СЃРє -30%.`, 'success');
                }
            } else {
                // Inventory item
                player.items.push(itemId);
                emitLog(io, roomId, `рџ›’ ${player.nickname} РєСѓРїРёР» РїСЂРµРґРјРµС‚: ${item.name}`, 'info');
            }

            checkPlayerState(io, roomId, player);
            // Buying doesn't end turn instantly? Let's make it end turn for balance, or make it free action?
            // Let's make it end turn to prevent spam interaction
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
            player.wantedLevel = Math.max(0, player.wantedLevel - 20);
            emitLog(io, roomId, `рџ•¶пёЏ ${player.nickname} stayed low. Wanted -20%${passiveIncome > 0 ? `, +${passiveIncome}$ from contacts` : ""}.`, "info");

            if (checkPlayerState(io, roomId, player)) return;
            advanceTurn(io, roomId);
        });

        socket.on("action_ability", ({ roomId }: ActionPayload) => {
            const room = rooms[roomId];
            if (!room) return;
            const player = room.players[room.activePlayerIndex];
            if (player.socketId !== socket.id) return;

            if (player.abilityCooldown > 0) return socket.emit("error_msg", "РЎРїРѕСЃРѕР±РЅРѕСЃС‚СЊ РЅР° РїРµСЂРµР·Р°СЂСЏРґРєРµ");

            const cls = CLASSES[player.role!];
            const ab = cls.ability;

            player.abilityCooldown = ab.cooldown + 1; // +1 because it decrements end of turn

            if (ab.id === 'insider') {
                player.activeBuffs.push('insider');
                emitLog(io, roomId, `рџ“€ ${player.nickname} Р°РєС‚РёРІРёСЂРѕРІР°Р» РРќРЎРђР™Р”! РЎР»РµРґСѓСЋС‰Р°СЏ РїСЂРѕРґР°Р¶Р° x2.`, 'success');
                // Free action, turn doesn't end
                broadcastRoom(io, roomId);
                return;
            }

            if (ab.id === 'shadow') {
                player.activeBuffs.push('shadow_walk');
                emitLog(io, roomId, `рџ‘» ${player.nickname} СѓС€РµР» РІ РўРµРЅСЊ. Р‘РµР·РѕРїР°СЃРЅР°СЏ РєСЂР°Р¶Р°.`, 'success');
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
                emitLog(io, roomId, `рџ™Џ ${player.nickname} СЃРјС‹РІР°РµС‚ РіСЂРµС…Рё. Р РѕР·С‹СЃРє РІСЃРµРј СЃРЅРёР¶РµРЅ!`, 'success');
                advanceTurn(io, roomId);
                return;
            }

            if (ab.id === 'snitch') {
                const targets = room.players.filter(p => !p.isEliminated && p.socketId !== player.socketId);
                if (targets.length > 0) {
                    const victim = targets[Math.floor(Math.random() * targets.length)];
                    victim.wantedLevel += 25;
                    emitLog(io, roomId, `рџљ” ${player.nickname} СЃРґР°Р» ${victim.nickname} РїРѕР»РёС†РёРё! (+25% СЂРѕР·С‹СЃРєР°)`, 'danger');
                } else {
                    emitLog(io, roomId, `${player.nickname} С…РѕС‚РµР» РґРѕРЅРµСЃС‚Рё, РЅРѕ РЅРµ РЅР° РєРѕРіРѕ.`, 'warning');
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
            emitLog(io, roomId, `рџ”Њ ${player.nickname} РѕС‚РєР»СЋС‡РёР»СЃСЏ. РћРєРЅРѕ РїРµСЂРµРїРѕРґРєР»СЋС‡РµРЅРёСЏ: ${REJOIN_GRACE_MS / 1000} СЃРµРє.`, "warning");
            broadcastRoom(io, roomId);

            clearReconnectTimer(player.reconnectToken);
            reconnectTimers[player.reconnectToken] = setTimeout(() => {
                const targetRoom = rooms[roomId];
                if (!targetRoom) return;
                const samePlayer = targetRoom.players.find((p) => p.reconnectToken === player.reconnectToken);
                if (!samePlayer || !shouldRemoveDisconnected(samePlayer.disconnectedAt, Date.now(), REJOIN_GRACE_MS)) return;
                emitLog(io, roomId, `вќЊ ${samePlayer.nickname} РЅРµ РІРµСЂРЅСѓР»СЃСЏ РІРѕРІСЂРµРјСЏ Рё Р±С‹Р» СѓРґР°Р»РµРЅ РёР· РёРіСЂС‹.`, "danger");
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
        hasIntelMap: player.items.includes("intel_map"),
        hasShadowWalk: player.activeBuffs.includes("shadow_walk"),
    });

    const roll = Math.random() * 100;

    if (isStealSuccess(roll, risk)) {
        // Success
        const rawVal = Math.floor(Math.random() * (dist.maxReward - dist.minReward)) + dist.minReward;
        const val = player.items.includes("talisman") ? Math.floor(rawVal * 1.2) : rawVal;
        const name = `Р”СѓС€Р° ${SOUL_NAMES[Math.floor(Math.random() * SOUL_NAMES.length)]}`;
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




