import { contractName, type Contract, type Suit } from "./schafkopf.ts";

export type CallSuit = Exclude<Suit, "Herz">;
export type CallPrefix = "random" | "auf" | "mit" | "none";
export type SoloWord = "random" | "Solo" | "Sticht";
export type CustomAnnouncement = "intent" | "pass" | "bid" | "kontra" | "re" | "sub" | "hirsch" | "Eichel" | "Gras" | "Schellen" | "solo" | "wenz" | "farbwenz" | "other";
export type AnnouncementSettings = {
  callPrefix: CallPrefix;
  callNames: Record<CallSuit, string>;
  soloWord: SoloWord;
  custom: Record<CustomAnnouncement, string>;
};

type CallName = { id: string; label: string; bare: string; auf: string; mit: string };
export const CALL_NAME_OPTIONS: Record<CallSuit, CallName[]> = {
  Eichel: [
    { id: "ass", label: "Eichel-Ass", bare: "Eichel-Ass", auf: "die Eichel-Ass", mit: "der Eichel-Ass" },
    { id: "alte", label: "Alte / mit der Alten", bare: "Alte", auf: "die Alte", mit: "der Alten" },
    { id: "oide", label: "Oide / mit der Oiden", bare: "Oide", auf: "die Oide", mit: "der Oiden" },
  ],
  Gras: [
    { id: "ass", label: "Gras-Ass", bare: "Gras-Ass", auf: "die Gras-Ass", mit: "der Gras-Ass" },
    { id: "blaue", label: "Blaue / mit der Blauen", bare: "Blaue", auf: "die Blaue", mit: "der Blauen" },
  ],
  Schellen: [
    { id: "ass", label: "Schellen-Ass", bare: "Schellen-Ass", auf: "die Schellen-Ass", mit: "der Schellen-Ass" },
    { id: "schellige", label: "Schellige / mit der Schelligen", bare: "Schellige", auf: "die Schellige", mit: "der Schelligen" },
    { id: "bums", label: "Bums", bare: "Bums", auf: "den Bums", mit: "dem Bums" },
    { id: "pumpe", label: "Pumpe", bare: "Pumpe", auf: "die Pumpe", mit: "der Pumpe" },
    { id: "kugel-bauer-theres", label: "Kugel-Bauer-Theres", bare: "Kugel-Bauer-Theres", auf: "die Kugel-Bauer-Theres", mit: "der Kugel-Bauer-Theres" },
    { id: "hundsgfickte", label: "Hundsgfickte / mit der Hundsgfickten", bare: "Hundsgfickte", auf: "die Hundsgfickte", mit: "der Hundsgfickten" },
  ],
};

export const DEFAULT_ANNOUNCEMENT_SETTINGS: AnnouncementSettings = {
  callPrefix: "random",
  callNames: { Eichel: "random", Gras: "random", Schellen: "random" },
  soloWord: "random",
  custom: { intent: "", pass: "", bid: "", kontra: "", re: "", sub: "", hirsch: "", Eichel: "", Gras: "", Schellen: "", solo: "", wenz: "", farbwenz: "", other: "" },
};
export const SIMPLE_ANNOUNCEMENT_SETTINGS: AnnouncementSettings = {
  ...DEFAULT_ANNOUNCEMENT_SETTINGS,
  callPrefix: "auf",
  callNames: { Eichel: "ass", Gras: "ass", Schellen: "ass" },
  soloWord: "Solo",
};

export function normalizeAnnouncementSettings(value: unknown): AnnouncementSettings {
  const saved = value && typeof value === "object" && !Array.isArray(value) ? value as Partial<AnnouncementSettings> : {};
  const prefix = saved.callPrefix;
  const soloWord = saved.soloWord;
  const callNames = Object.fromEntries((["Eichel", "Gras", "Schellen"] as const).map(suit => {
    const name = saved.callNames?.[suit];
    return [suit, name === "random" || CALL_NAME_OPTIONS[suit].some(option => option.id === name) ? name : "random"];
  })) as Record<CallSuit, string>;
  const custom = Object.fromEntries((Object.keys(DEFAULT_ANNOUNCEMENT_SETTINGS.custom) as CustomAnnouncement[]).map(key => [key, typeof saved.custom?.[key] === "string" ? saved.custom[key].slice(0, 100) : ""])) as Record<CustomAnnouncement, string>;
  return { callPrefix: prefix === "auf" || prefix === "mit" || prefix === "none" ? prefix : "random", callNames, soloWord: soloWord === "Solo" || soloWord === "Sticht" ? soloWord : "random", custom };
}

export function formatDeclarationAnnouncement(contract: Contract, settings: AnnouncementSettings, random: () => number = Math.random): string {
  const customKey = contract.kind === "rufspiel" ? contract.suit as CallSuit : contract.kind === "solo" || contract.kind === "wenz" || contract.kind === "farbwenz" ? contract.kind : "other";
  const custom = settings.custom[customKey]?.trim();
  if (custom) return custom;
  if (contract.kind === "rufspiel") {
    if (contract.calledRank && contract.calledRank !== "Ass") return `Ich spiele auf ${contract.suit}-${contract.calledRank}.`;
    const suit = contract.suit as CallSuit;
    const choices = CALL_NAME_OPTIONS[suit];
    if (!choices) return contractName(contract);
    const selected = choices.find(choice => choice.id === settings.callNames[suit]) ?? choices[Math.floor(random() * choices.length)];
    const prefix = settings.callPrefix === "random" ? (["auf", "mit", "none"] as const)[Math.floor(random() * 3)] : settings.callPrefix;
    if (prefix === "auf") return `I spui auf ${selected.auf}.`;
    if (prefix === "mit") return `I spui mit ${selected.mit}.`;
    return `${selected.bare}.`;
  }
  if (contract.kind === "solo" && contract.suit) {
    const word = settings.soloWord === "random" ? (random() < .5 ? "Solo" : "Sticht") : settings.soloWord;
    return `${contract.suit}-${word}${contract.tout ? " DU" : ""}.`;
  }
  return `${contractName(contract)}.`;
}
