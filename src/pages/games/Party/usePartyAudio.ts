import { useEffect, useRef, type RefObject } from "react";
import { partyAudio, type MusicMood, type SoundId } from "../../../games/party/client/audio.ts";
import type { FeedbackKind, Lobby } from "../../../games/party/types.ts";

const EVENT_SOUNDS: Partial<Record<FeedbackKind, SoundId>> = {
  HEAL: "heal",
  CLEANSED: "heal",
  SHOP_PURCHASE: "item",
  ZERO_REWARD: "result",
  DAMAGE: "damage",
  HIT: "damage",
  KO: "ko",
  ITEM_GAINED: "item",
  ITEM_USED: "item",
  BONUS_ROLL: "dice",
  EXPLOSION: "damage",
  PROPERTY_CLAIMED: "property",
  PROPERTY_UPGRADED: "property",
  TOLL: "coinLoss",
  PLUTO_STOLEN: "coinLoss",
  MISS: "miss",
  DUEL_CHALLENGE: "duel",
  DUEL_WON: "result",
  FALLOUT: "radiation",
  RADIATION: "radiation",
  ANIMAL_SUMMONED: "animal",
  ANIMAL_HIT: "animal",
  AVALANCHE: "avalanche",
  TRANSPORT: "cable",
  SLIDE: "cable",
};
function moodFor(lobby: Lobby | null): MusicMood {
  const phase = lobby?.match?.phase;
  if (!phase) return "calm";
  if (phase === "MINIGAME" || phase === "DUEL_MINIGAME") return "minigame";
  if (phase === "GAME_OVER") return "calm";
  return "board";
}
// Connects authoritative snapshots to the audio system. Sounds are derived from new feedback events,
// phase changes and the local player's own coin/Pluto changes; nothing here affects game state.
export function usePartyAudio(
  lobby: Lobby | null,
  playerId: string,
  serverOffset: RefObject<number | null>,
) {
  useEffect(() => {
    const unlock = () => partyAudio.unlock();
    const click = (e: MouseEvent) => {
      const button = (e.target as Element | null)?.closest?.("button");
      if (button && !button.disabled && button.closest(".pp-page")) partyAudio.play("click");
    };
    const visibility = () => partyAudio.setHidden(document.visibilityState === "hidden");
    window.addEventListener("pointerdown", unlock, true);
    window.addEventListener("keydown", unlock, true);
    window.addEventListener("click", click, true);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      window.removeEventListener("pointerdown", unlock, true);
      window.removeEventListener("keydown", unlock, true);
      window.removeEventListener("click", click, true);
      document.removeEventListener("visibilitychange", visibility);
      partyAudio.setMusic("off");
    };
  }, []);
  const mood = moodFor(lobby);
  useEffect(() => partyAudio.setMusic(mood), [mood]);
  const match = lobby?.match ?? null;
  const pulseStart = lobby?.match?.phase === "MINIGAME" && lobby.match.minigame?.minigameId === "rhythm-rush" ? lobby.match.minigame.startedAt : null;
  useEffect(() => { partyAudio.setRhythm(pulseStart === null ? null : pulseStart - (serverOffset.current ?? 0)); return () => partyAudio.setRhythm(null); }, [pulseStart, serverOffset]);
  const seen = useRef<number | null>(null),
    phase = useRef<string | null>(null),
    wallet = useRef<{ coins: number; plutos: number } | null>(null);
  const eventSeq = match?.eventSeq ?? null,
    events = match?.events,
    currentPhase = match?.phase ?? null,
    me = match?.players.find((p) => p.id === playerId),
    coins = me?.coins ?? null,
    plutos = me?.goldenPlutos ?? null;
  useEffect(() => {
    // Events present when this client first sees a match (join, reconnect) are not replayed.
    if (eventSeq === null || events === undefined) {
      seen.current = null;
      return;
    }
    if (seen.current === null || eventSeq < seen.current) {
      seen.current = eventSeq;
      return;
    }
    const fresh = events.filter((e) => e.id > seen.current!);
    seen.current = eventSeq;
    const sounds = new Set(fresh.map((e) => EVENT_SOUNDS[e.kind]).filter(Boolean) as SoundId[]);
    sounds.forEach((s) => partyAudio.play(s));
  }, [eventSeq, events]);
  useEffect(() => {
    const previous = phase.current;
    phase.current = currentPhase;
    if (!previous || previous === currentPhase) return;
    if (currentPhase === "DICE_ROLL") partyAudio.play("dice");
    else if (currentPhase === "MINIGAME" || currentPhase === "DUEL_MINIGAME") partyAudio.play("go");
    else if (currentPhase === "MINIGAME_RESULTS" || currentPhase === "DUEL_RESULTS") partyAudio.play("result");
    else if (currentPhase === "GAME_OVER") partyAudio.play("victory");
    else if (currentPhase === "ANIMAL_PHASE") partyAudio.play("animal");
  }, [currentPhase]);
  useEffect(() => {
    const before = wallet.current;
    wallet.current = coins === null || plutos === null ? null : { coins, plutos };
    if (!before || coins === null || plutos === null) return;
    if (plutos > before.plutos) partyAudio.play("pluto");
    else if (coins > before.coins) partyAudio.play("coinGain");
    else if (coins < before.coins) partyAudio.play("coinLoss");
  }, [coins, plutos]);
  // 3-2-1 before a minigame or duel starts, timed on the server clock.
  const startsAt =
    (currentPhase === "MINIGAME_INTRO" || currentPhase === "DUEL_INTRO") && match?.minigame && !match.minigame.awaitingReady
      ? match.minigame.startedAt
      : null;
  useEffect(() => {
    if (startsAt === null) return;
    const localStart = startsAt - (serverOffset.current ?? 0);
    const timers = [3000, 2000, 1000]
      .map((before) => localStart - before - Date.now())
      .filter((delay) => delay > 0)
      .map((delay) => setTimeout(() => partyAudio.play("countdown"), delay));
    return () => timers.forEach(clearTimeout);
  }, [startsAt, serverOffset]);
}
