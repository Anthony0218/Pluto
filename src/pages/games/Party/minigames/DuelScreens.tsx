import { COLORS, DUEL_FLOW } from "../../../../games/party/config.ts";
import { describeWager } from "../../../../games/party/duels/wager.ts";
import type { MinigameDefinition } from "../../../../games/party/minigames/types.ts";
import type {
  DuelState,
  Match,
  MinigameRuntime,
  Player,
} from "../../../../games/party/types.ts";
import Portrait from "../PartyPortrait.tsx";

function Duelist({ player, you }: { player: Player; you: boolean }) {
  return (
    <div
      className="duel-duelist"
      style={{ "--pawn-color": COLORS[player.avatarId] } as React.CSSProperties}
    >
      <Portrait player={player} />
      <strong>{player.name.toUpperCase()}</strong>
      <small>
        {you ? "you" : player.isBot ? "bot" : "explorer"} · 🪙 {player.coins} · ✦ {player.goldenPlutos}
      </small>
    </div>
  );
}

export function DuelIntro({
  definition,
  match,
  duel,
  minigame,
  playerId,
  now,
}: {
  definition: MinigameDefinition;
  match: Match;
  duel: DuelState;
  minigame: MinigameRuntime;
  playerId: string;
  now: number;
}) {
  const challenger = match.players.find((p) => p.id === duel.challengerPlayerId)!,
    defender = match.players.find((p) => p.id === duel.defenderPlayerId)!;
  const remaining = minigame.startedAt - now,
    counting = remaining <= DUEL_FLOW.countdownMs,
    count = Math.ceil(remaining / 1000);
  const involved = playerId === challenger.id || playerId === defender.id;
  const pocket = duel.kind === "pocket-duel";
  return (
    <div className="mg-intro duel-intro">
      <span className="pp-eyebrow">
        {pocket ? "POCKET DUEL · RARE" : "DUEL SABER"} · {challenger.name.toUpperCase()}'S TURN
      </span>
      <h2>{pocket ? "POCKET DUEL!" : "DUEL!"}</h2>
      <div className="duel-versus">
        <Duelist player={challenger} you={challenger.id === playerId} />
        <b aria-label="versus">VS</b>
        <Duelist player={defender} you={defender.id === playerId} />
      </div>
      {duel.wager ? (
        <p className="duel-wager">
          <small>WAGER</small>
          {describeWager(duel.wager)}
          {duel.wager.type === "coins" && <small>Pot {duel.pot} coins · winner takes all</small>}
          {duel.wager.type === "pluto" && <small>Winner takes 1 Golden Pluto from the loser</small>}
        </p>
      ) : (
        <p className="duel-wager">
          <small>PRIZE · NO WAGER</small>✦ +1 NEW GOLDEN PLUTO
          <small>The loser loses nothing</small>
        </p>
      )}
      <p className="duel-minigame">
        <small>MINIGAME</small>
        {definition.name.toUpperCase()}
      </p>
      <p className="mg-lede">{definition.description}</p>
      <p className="mg-controls">
        <b>Controls</b> {definition.controls}
      </p>
      {!involved && <p className="mg-lede">You are watching this duel.</p>}
      <div
        className={`mg-countdown ${counting ? "counting" : ""}`}
        aria-live="assertive"
        key={counting ? count : "ready"}
      >
        {!counting ? <small>Get ready…</small> : count > 0 ? count : "GO!"}
      </div>
    </div>
  );
}

export function DuelResults({
  match,
  duel,
  playerId,
}: {
  match: Match;
  duel: DuelState;
  playerId: string;
}) {
  const winner = match.players.find((p) => p.id === duel.winnerPlayerId);
  const duelists = [duel.challengerPlayerId, duel.defenderPlayerId].map(
    (id) => match.players.find((p) => p.id === id)!,
  );
  const loser = duelists.find((p) => p.id !== winner?.id);
  const challenger = duelists[0];
  const champion = match.players.find((p) => p.id === match.winner);
  return (
    <div className="mg-results duel-results">
      <span className="pp-eyebrow">DUEL RESULTS</span>
      <h2>{winner ? `${winner.name.toUpperCase()} WINS!` : "DUEL OVER"}</h2>
      {duel.kind === "pocket-duel" ? (
        <p className="duel-wager">
          <small>POCKET DUEL PRIZE</small>
          {winner ? `✦ +1 NEW GOLDEN PLUTO FOR ${winner.name.toUpperCase()}` : "NO PRIZE"}
          <small>{loser?.name} loses nothing</small>
        </p>
      ) : duel.wager?.type === "coins" ? (
        <>
          <p className="duel-wager">
            <small>WAGER</small>
            {duel.wager.amount * 2} COINS
          </p>
          <ol className="mg-podium">
            {duelists.map((p) => {
              const payout = duel.payout?.[p.id]?.coins ?? 0;
              return (
                <li
                  key={p.id}
                  className={`${p.id === playerId ? "me" : ""} ${p.id === winner?.id ? "place-1" : ""}`}
                  style={{ "--pawn-color": COLORS[p.avatarId] } as React.CSSProperties}
                >
                  <b className="mg-place">{p.id === winner?.id ? "WIN" : "—"}</b>
                  <Portrait player={p} />
                  <span className="mg-name">
                    {p.name}
                    <small>staked {duel.wager?.type === "coins" ? duel.wager.amount : 0}</small>
                  </span>
                  <span className={`mg-reward ${payout ? "" : "none"}`}>+{payout}</span>
                  <span className="mg-total">🪙 {p.coins}</span>
                </li>
              );
            })}
          </ol>
        </>
      ) : (
        <p className="duel-wager">
          <small>1 GOLDEN PLUTO</small>
          TRANSFERRED FROM {loser?.name.toUpperCase()}
        </p>
      )}
      <p className="mg-next">
        {champion
          ? `${champion.name} reached the victory goal!`
          : `Back to ${challenger.name}'s turn — they can still use items and roll.`}
      </p>
    </div>
  );
}
