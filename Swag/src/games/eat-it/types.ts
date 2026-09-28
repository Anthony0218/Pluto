import type { FoodKind, PowerKind } from './config.ts';
export type MapId = 'city' | 'nature';
export type Vec = { x: number; y: number };
export type Input = Vec;
export type BotState = 'FORAGE' | 'FLEE' | 'HUNT' | 'POWERUP' | 'REPOSITION';
export type Player = Vec & {
  id: string; name: string; bot: boolean; color: string; mass: number; vx: number; vy: number; facing: number;
  alive: boolean; placement: number | null; eliminatedBy: string | null; eliminatedAt: number | null;
  score: number; foodEaten: number; playersEaten: number; powerupsCollected: number;
  effects: Record<PowerKind, number>; input: Input; botState: BotState; nextDecision: number;
};
export type FoodObject = Vec & { id: number; kind: FoodKind; vx: number; vy: number; z: number; vz: number; rotation: number; target: string | null; capturedAt: number };
export type PowerObject = Vec & { id: number; kind: PowerKind };
export type GameEvent = Vec & { id: number; at: number; type: 'food' | 'eat' | 'power' | 'collision' | 'eliminated' | 'win'; playerId: string; victimId?: string; food?: FoodKind; power?: PowerKind; radius?: number };
export type GameState = {
  id: string; map: MapId; rng: number; nextId: number; time: number; status: 'playing' | 'finished'; winnerId: string | null;
  players: Player[]; food: FoodObject[]; powerups: PowerObject[]; events: GameEvent[];
  nextFood: number; nextPower: number; spawnSector: number;
};
export type Obstacle = Vec & { w: number; h: number; kind: 'stall' | 'planter' | 'fountain' | 'bench' | 'tree' | 'rock' | 'water' | 'log' | 'crate' };
export type Participant = { id: string; name: string; bot?: boolean };
export type RoomMember = { id: string; name: string; ready: boolean; lastSeen: number; departed?: boolean };
export type Room = { id: string; room_code: string; host_id: string; players: RoomMember[]; settings: { map: MapId; count: number }; game_state: GameState | null; status: 'waiting' | 'playing' | 'finished'; version: number; last_tick: number };
