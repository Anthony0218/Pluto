import type { Resource } from "./types.ts";

export type Cargo = { coins: number; resources: Partial<Record<Resource, number>> };
export type Covenant = "none" | "access" | "protection" | "heir-support" | "low-tolls";
export type Compact = {
  id: string; from: string; to: string; give: Cargo; take: Cargo;
  covenant: Covenant; duration: number; remaining: number; delivered: number;
  status: "offered" | "active" | "fulfilled" | "declined" | "broken" | "expired";
  offered: number; lastRound: number; reason: string;
};
export type ProjectKind = "bridge" | "granary" | "sea-lane";
export type RealmProject = {
  id: string; kind: ProjectKind; hex: string; destination?: string; owner: string;
  status: "funding" | "complete" | "cancelled"; contributions: Record<string, Cargo>;
  open: boolean; maintained: boolean; lastRound: number;
};
export type Interest = "rural" | "merchants" | "scholars";
export type Reform = "balanced" | "tolls" | "charter" | "learning";
export type Administration = "local-rule" | "governor" | "autonomy" | "direct";
export type Integration = { policy: Administration; administrator: string; formerOwner: string; since: number };
export type RealmMemory = {
  id: string; house: string; other: string; person: string; round: number;
  kind: "honoured" | "broken" | "aid" | "succession"; detail: string; effect: number; responsible?: string;
};
export type RealmDomestic = {
  approval: Record<Interest, number>; reform: Reform; lastReform: number;
  levyBurden: number; lastRound: number; successions: number; successionSupport: number;
};
export type LegacyScore = { dynasty: number; prosperity: number; diplomacy: number; defence: number; total: number };
export type Landmark = { hex: string; kind: "pass" | "harbour" | "crossing" };
export type RealmAgreements = {
  version: 1; compacts: Compact[]; projects: RealmProject[]; memories: RealmMemory[];
  domestic: Record<string, RealmDomestic>; landmarks: Landmark[];
  calendar: { baseTick: number; baseYear: number; agedYear: number; bornYear: number };
  campaign: {
    kind: "council" | "sandbox"; startRound: number; length: number;
    councilHeld: string[]; scores: Record<string, LegacyScore>;
    result?: { round: number; winners: string[] };
  };
};
export type AgreementCommand =
  | { type: "offerCompact"; house: string; give: Cargo; take: Cargo; covenant: Covenant; duration: number }
  | { type: "answerCompact"; compact: string; accept: boolean }
  | { type: "breakCompact"; compact: string }
  | { type: "foundProject"; kind: ProjectKind; hex: string; destination?: string }
  | { type: "fundProject"; project: string; cargo: Cargo }
  | { type: "projectAccess"; project: string; open: boolean }
  | { type: "cancelProject"; project: string }
  | { type: "reform"; reform: Reform }
  | { type: "integrate"; hex: string; policy: Administration; administrator?: string }
  | { type: "develop"; hex: string; building: "farm" | "market" | "town" }
  | { type: "continueSandbox" };
