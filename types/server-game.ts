import { GameEvent, PlayerClass, Soul } from "./game";

export interface ServerPlayer {
    id: string; // Socket ID
    socketId: string;
    role: PlayerClass | null; // Assigned by server
    money: number;
    wantedLevel: number;
    inventory: Soul[];
    location: string | null; // District ID
    isReady: boolean;
}

export interface ServerRoom {
    id: string; // Room Code
    players: ServerPlayer[];
    state: {
        status: 'lobby' | 'playing' | 'ended';
        turn: number;
        activePlayerIndex: number; // Index in players array
        districtHeat: Record<string, number>; // District ID -> Heat Level
        event: GameEvent | null; // Current global event
    };
    settings: {
        maxPlayers: number;
    };
}
