import { useEffect, useMemo, useRef, useState } from "react";
import type { Match, MinigameInput, MinigameRuntime } from "../../../../games/party/types.ts";
import type { MinigameDefinition } from "../../../../games/party/minigames/types.ts";
import { minigameViews } from "./views.ts";

// A separate local simulation: practice inputs never reach the connection or the real match.
export default function MinigamePractice({ definition, match, participants, playerId }: { definition: MinigameDefinition; match: Match; participants: string[]; playerId: string }) {
  const participantKey = participants.join("|");
  const participantIds = useMemo(() => participantKey.split("|"), [participantKey]);
  const live = useRef<{ state: unknown; startedAt: number; endsAt: number } | null>(null);
  const [runtime, setRuntime] = useState<MinigameRuntime | null>(null);
  const contextPlayers = useRef(match.players);
  useEffect(() => {
    const bots = participantIds.filter((id) => id !== playerId).map((id) => { const p = contextPlayers.current.find((p) => p.id === id)!; return { id, avatarId: p.avatarId, isBot: true, difficulty: "easy" as const }; });
    const reset = () => {
      const startedAt = Date.now(), endsAt = startedAt + definition.durationSeconds * 1000;
      live.current = { state: definition.create({ participants: participantIds.map((id) => { const p = contextPlayers.current.find((p) => p.id === id)!; return { id, avatarId: p.avatarId, isBot: id !== playerId, difficulty: "easy" }; }), startedAt, endsAt, random: Math.random }), startedAt, endsAt };
    };
    reset();
    const update = () => {
      const now = Date.now(); let game = live.current!;
      if (now >= game.endsAt || definition.isFinished?.(game.state)) { reset(); game = live.current!; }
      definition.tick?.(game.state, now);
      for (const bot of bots) for (const input of definition.botInputs?.(game.state, bot, now, Math.random) ?? []) {
        try { definition.tick?.(game.state, input.at); definition.applyInput(game.state, bot.id, input.input, input.at); } catch { /* Practice continues after an expired action. */ }
      }
      setRuntime({ minigameId: definition.id, participants: participantIds, status: "ACTIVE", introStartedAt: game.startedAt, startedAt: game.startedAt, endsAt: game.endsAt, state: definition.publicView(game.state, now, playerId), resultsEndsAt: null, results: null, rewards: null, rewardsApplied: false, serverNow: now });
    };
    update(); const timer = setInterval(update, 100);
    return () => { clearInterval(timer); live.current = null; };
  }, [definition, participantIds, playerId]);
  const sendInput = (input: MinigameInput) => {
    const game = live.current, parsed = definition.parseInput(input); if (!game || !parsed) return;
    const now = Date.now();
    try { definition.tick?.(game.state, now); definition.applyInput(game.state, playerId, parsed, now); } catch { /* Invalid practice input has no effect. */ }
  };
  const View = minigameViews[definition.id];
  return <div className="mg-practice-box"><div className="mg-practice-label"><b>✦ PRACTICE PLAYGROUND</b><span>Try the controls · Space marks you ready · use touch buttons to practise jumps / dash / firing</span></div>
    {runtime && View && <View key={runtime.startedAt} match={match} minigame={runtime} playerId={playerId} online now={runtime.serverNow!} sendInput={sendInput}/>}
  </div>;
}
