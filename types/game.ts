export type PlayerClass = 'careerist' | 'idealist' | 'quiet' | 'cynic';

export interface ClassInfo {
    id: PlayerClass;
    name: string;
    description: string;
    bonusText: string;
    malusText: string;
    stats: {
        sellMultiplier: number; // 1.0 base
        wantedRate: number; // 1.0 base
        failReduction: number; // 1.0 base
        incomeMultiplier: number; // 1.0 base
        canRelease: boolean;
        eventImmunity: boolean;
    };
}

export interface Soul {
    id: string;
    name: string;
    value: number;
    origin: string;
}

export interface District {
    id: string;
    name: string;
    risk: number;
    reward: { min: number; max: number };
    description: string;
}

export interface GameEvent {
    id: string;
    text: string;
    type: 'neutral' | 'risk' | 'price' | 'good' | 'bad';
    value: number; // multiplier
    duration: number;
}

export interface GameState {
    money: number;
    wantedLevel: number;
    turn: number;
    inventory: Soul[];
    playerClass: PlayerClass | null;
    currentEvent: GameEvent | null;
    history: LogEntry[];
    isGameOver: boolean;
    gameResult: 'win' | 'loss' | null;
}

export interface LogEntry {
    id: string;
    text: string;
    type: 'info' | 'success' | 'danger' | 'warning';
    turn: number;
}
