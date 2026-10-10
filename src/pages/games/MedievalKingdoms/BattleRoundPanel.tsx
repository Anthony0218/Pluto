import GameXpReward from "@/components/games/GameXpReward";
import { useState } from "react";
import type {
  Battle,
  BattleOrder,
  BattlePlan,
  BattlePosition,
  BattleReport,
  Campaign,
  Command,
  House,
  UnitKind,
} from "../../../games/MedievalKingdoms/edravane/types.ts";
import { canControl } from "../../../games/MedievalKingdoms/edravane/simulation.ts";
import {
  battleForecast,
  defaultPlan,
  defaultPosition,
  ORDER_NAMES,
  ORDER_HELP,
  reinforcementSources,
  terrainExplanation,
  UNIT_HELP,
  UNIT_KINDS,
  UNIT_NAMES,
  unitCounter,
} from "../../../games/MedievalKingdoms/edravane/battleRounds.ts";
import { BIOMES } from "../../../games/MedievalKingdoms/edravane/world.ts";

export function UnitGuide({ open = false }: { open?: boolean }) {
  return (
    <details className="ed-unit-guide" open={open}>
      <summary>Unit strengths & counters</summary>
      <p>
        Green means stronger against the target; amber means weaker. Position,
        terrain, morale, and supplies also affect combat.
      </p>
      <div className="ed-counter-scroll">
        <table>
          <caption>Attacking unit → target unit · strength multiplier</caption>
          <thead>
            <tr>
              <th>Unit</th>
              {UNIT_KINDS.map((k) => (
                <th key={k}>{UNIT_NAMES[k]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {UNIT_KINDS.map((k) => (
              <tr key={k}>
                <th>{UNIT_NAMES[k]}</th>
                {UNIT_KINDS.map((target) => {
                  const value = unitCounter(k, target);
                  return (
                    <td
                      key={target}
                      className={
                        value > 1
                          ? "ed-counter-good"
                          : value < 1
                            ? "ed-counter-bad"
                            : ""
                      }
                    >
                      {value.toFixed(2)}×
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        <strong>Braced spearmen:</strong> Hold in the front makes spearmen 1.60×
        against cavalry; cavalry falls to 0.50× against them.
      </p>
      {UNIT_KINDS.map((k) => (
        <div className="ed-unit-note" key={k}>
          <strong>
            {UNIT_NAMES[k]} · best in the {UNIT_HELP[k].position}
          </strong>
          <span>Effective: {UNIT_HELP[k].strong}.</span>
          <span>Vulnerable: {UNIT_HELP[k].weak}.</span>
        </div>
      ))}
    </details>
  );
}
export function BattleRoundPanel({
  state,
  battle,
  house,
  onCommand,
  onInspect,
  message,
}: {
  state: Campaign;
  battle: Battle;
  house: House;
  onCommand: (cmd: Command) => void;
  onInspect: () => void;
  message: string;
}) {
  const [plans, setPlans] = useState<Record<string, BattlePlan>>(() =>
    Object.fromEntries(
      battle.armies.map((id) => [
        id,
        battle.rounds?.plans[id] ?? {
          ...defaultPlan(),
          positions: Object.fromEntries(
            battle.formations
              .filter((f) => f.army === id)
              .map((f) => [f.kind, f.position ?? defaultPosition(f.kind)]),
          ),
        },
      ]),
    ),
  );
  const r = battle.rounds!;
  const forecast = battleForecast(state, battle);
  const d = state.districts.find((d) => d.id === battle.hex)!;
  const update = (army: string, change: Partial<BattlePlan>) =>
    setPlans((p) => ({
      ...p,
      [army]: { ...(p[army] ?? defaultPlan()), ...change },
    }));
  const icons: Record<UnitKind, string> = {
    levies: "⚔",
    spearmen: "♜",
    archers: "➶",
    heavy: "◆",
    cavalry: "♞",
  };
  return (
    <div className="ed-battle-backdrop">
      <section
        className="ed-battle-modal ed-round-battle"
        role="dialog"
        aria-modal="true"
        aria-label="Turn-based battle"
      >
        <header>
          <div>
            <span className="ed-eyebrow">
              {battle.phase === "encounter"
                ? "BATTLE PREVIEW"
                : `BATTLE ROUND ${r.round}`}
            </span>
            <h2>{d.name}</h2>
          </div>
          <button onClick={onInspect}>Inspect campaign</button>
        </header>
        <p className="ed-round-status" role="status">
          {battle.phase === "encounter"
            ? "Choose to fight or withdraw. The campaign waits for your decision."
            : r.committed.length
              ? "Orders committed. Waiting for the opposing commander; their orders remain hidden."
              : "Choose positions and one army order. Both sides resolve together after committing."}
        </p>
        <div className="ed-battle-summary">
          {forecast.sides.map((side, i) => (
            <article key={side.army}>
              <span className="ed-eyebrow">
                {i === 0 ? "ATTACKER" : "DEFENDER"}
              </span>
              <h3>{side.name}</h3>
              <dl>
                <div>
                  <dt>Healthy</dt>
                  <dd>{side.healthy.toLocaleString()}</dd>
                </div>
                <div>
                  <dt>Wounded</dt>
                  <dd>{side.wounded.toLocaleString()}</dd>
                </div>
                <div>
                  <dt>Readiness</dt>
                  <dd>{side.health}%</dd>
                </div>
                <div>
                  <dt>Morale</dt>
                  <dd>{side.morale}/100</dd>
                </div>
                <div>
                  <dt>Loyalty</dt>
                  <dd>{side.loyalty}%</dd>
                </div>
                <div>
                  <dt>Supplies</dt>
                  <dd>{side.supply}%</dd>
                </div>
              </dl>
              <progress
                max={100}
                value={side.morale}
                aria-label={`${side.name} morale`}
              />
            </article>
          ))}
        </div>
        <p className="ed-forecast">
          Estimated attacker advantage: <strong>{forecast.chance}%</strong> ·
          defender {100 - forecast.chance}%. A strength estimate, not a
          guaranteed outcome; orders and reinforcements can change it.
        </p>
        <div className="ed-round-layout">
          <div>
            <svg
              viewBox="0 0 600 340"
              role="img"
              aria-label="Battle positions: protected rear, front line, and flanks"
            >
              <rect width="600" height="340" fill={BIOMES[d.biome].color} />
              {[0, 1].map((side) => (
                <g key={side}>
                  <rect
                    x={side === 0 ? 8 : 308}
                    y="8"
                    width="284"
                    height="324"
                    rx="8"
                    fill={side === 0 ? "#162b24" : "#392626"}
                    opacity=".84"
                  />
                  <text
                    x={side === 0 ? 18 : 318}
                    y="30"
                    fill="#f4e5bf"
                    fontSize="12"
                  >
                    {side === 0 ? "ATTACKER" : "DEFENDER"}
                    {side === 1 && d.castle
                      ? ` · CASTLE LVL ${d.castle.level}`
                      : ""}
                  </text>
                  {(["flank", "front", "rear"] as BattlePosition[]).map(
                    (position, i) => (
                      <g key={position}>
                        <rect
                          x={side === 0 ? 18 : 318}
                          y={46 + i * 91}
                          width="264"
                          height="82"
                          rx="5"
                          fill="#ffffff0d"
                        />
                        <text
                          x={side === 0 ? 25 : 325}
                          y={61 + i * 91}
                          fill="#d7c9a3"
                          fontSize="11"
                        >
                          {position.toUpperCase()}
                        </text>
                        {battle.formations
                          .filter(
                            (f) =>
                              f.army === battle.armies[side] &&
                              (plans[f.army]?.positions[f.kind] ??
                                f.position ??
                                defaultPosition(f.kind)) === position,
                          )
                          .map((f, j) => (
                            <text
                              key={f.id}
                              x={(side === 0 ? 25 : 325) + (j % 2) * 126}
                              y={83 + i * 91 + Math.floor(j / 2) * 19}
                              fill={f.routed ? "#dba28f" : "#eee4ca"}
                              fontSize="11"
                            >
                              {icons[f.kind]} {UNIT_NAMES[f.kind]}{" "}
                              {Math.floor(f.count)}
                              {f.routed ? " ↘" : ""}
                            </text>
                          ))}
                      </g>
                    ),
                  )}
                </g>
              ))}
            </svg>
            <div className="ed-battle-terrain">
              {terrainExplanation(state, battle.hex).map((line) => (
                <p key={line}>{line}</p>
              ))}
              <p>
                Wounded soldiers cannot fight. At a supplied friendly city, 25%
                recover per own turn; castles 20%, friendly camps 10%.
              </p>
            </div>
            <UnitGuide />
          </div>
          <aside className="ed-round-controls">
            {battle.armies.map((id) => {
              const a = state.armies.find((a) => a.id === id)!;
              if (!canControl(state, { house: house.id }, a)) return null;
              const plan = plans[id] ?? defaultPlan();
              const committed = r.committed.includes(id);
              const reserves = reinforcementSources(state, battle, a);
              return (
                <section key={id} aria-label={`Orders for ${a.name}`}>
                  <h3>Your orders · {a.name}</h3>
                  {battle.phase === "encounter" ? (
                    <div className="ed-round-actions">
                      <button
                        className="ed-primary"
                        disabled={battle.stood.includes(id)}
                        onClick={() =>
                          onCommand({
                            type: "stand",
                            battle: battle.id,
                            army: id,
                          })
                        }
                      >
                        {battle.stood.includes(id)
                          ? "Waiting for opponent"
                          : "Stand and fight"}
                      </button>
                      <button
                        onClick={() =>
                          onCommand({
                            type: "retreat",
                            battle: battle.id,
                            army: id,
                          })
                        }
                      >
                        Withdraw before battle
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="ed-orders">
                        {(Object.keys(ORDER_NAMES) as BattleOrder[]).map(
                          (order) => (
                            <button
                              key={order}
                              disabled={committed}
                              aria-pressed={plan.order === order}
                              className={plan.order === order ? "active" : ""}
                              onClick={() => update(id, { order })}
                            >
                              {ORDER_NAMES[order]}
                            </button>
                          ),
                        )}
                      </div>
                      <p>{ORDER_HELP[plan.order]}</p>
                      <button
                        className="ed-primary"
                        disabled={committed}
                        onClick={() =>
                          onCommand({
                            type: "battlePlan",
                            battle: battle.id,
                            army: id,
                            round: r.round,
                            plan,
                          })
                        }
                      >
                        {committed
                          ? "Orders committed"
                          : `Commit round ${r.round}`}
                      </button>
                      <fieldset disabled={committed}>
                        <legend>Deploy your troops</legend>
                        {battle.formations
                          .filter((f) => f.army === id)
                          .map((f) => (
                            <label key={f.id}>
                              {UNIT_NAMES[f.kind]} · {Math.floor(f.count)}{" "}
                              healthy{f.routed ? " · Routed" : ""}
                              <select
                                aria-label={`${UNIT_NAMES[f.kind]} position`}
                                value={
                                  plan.positions[f.kind] ??
                                  defaultPosition(f.kind)
                                }
                                disabled={f.routed || !f.count}
                                onChange={(e) =>
                                  update(id, {
                                    positions: {
                                      ...plan.positions,
                                      [f.kind]: e.target
                                        .value as BattlePosition,
                                    },
                                  })
                                }
                              >
                                <option value="front">Front line</option>
                                <option value="rear">Protected rear</option>
                                <option value="flank">Flank</option>
                              </select>
                              <small>
                                Strong: {UNIT_HELP[f.kind].strong}. Weak:{" "}
                                {UNIT_HELP[f.kind].weak}.
                              </small>
                            </label>
                          ))}
                      </fieldset>
                    </>
                  )}
                  {!!reserves.length && (
                    <button
                      disabled={
                        committed ||
                        (state.houses.find((h) => h.id === a.house)?.treasury ??
                          0) < 10 ||
                        (state.houses.find((h) => h.id === a.house)?.stock
                          .grain ?? 0) < 10
                      }
                      onClick={() =>
                        onCommand({
                          type: "battleReinforce",
                          battle: battle.id,
                          army: id,
                          reserve: reserves[0].id,
                        })
                      }
                    >
                      Call 100 city reserves · 10 coins · 10 food
                    </button>
                  )}
                </section>
              );
            })}
            {message && (
              <p role="alert" className="ed-notice">
                {message}
              </p>
            )}
          </aside>
        </div>
        {!!r.log.length && (
          <section
            className="ed-round-log"
            aria-label="Battle round explanations"
          >
            <h3>What happened</h3>
            {r.log.map((line, i) => (
              <p key={`${r.round}-${i}`}>{line}</p>
            ))}
          </section>
        )}
      </section>
    </div>
  );
}
export function BattleOutcome({
  report,
  onClose,
}: {
  report: BattleReport;
  onClose: () => void;
}) {
  return (
    <div className="ed-battle-backdrop">
      <section
        className="ed-battle-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Battle outcome"
      >
        <span className="ed-eyebrow">
          BATTLE OUTCOME · {report.round} ROUNDS
        </span>
        <h2>
          {report.winner
            ? `${report.winner} holds the field`
            : "Both armies leave the field"}
        </h2>
        <GameXpReward />
        <div className="ed-battle-summary">
          {report.sides.map((s) => (
            <article key={s.army}>
              <h3>{s.name}</h3>
              <p>
                {s.healthy.toLocaleString()} healthy survivors ·{" "}
                {s.wounded.toLocaleString()} wounded · {s.dead.toLocaleString()}{" "}
                dead.
              </p>
              {s.escaped && <p>Survivors retreat to a safe neighboring hex.</p>}
              {!!s.captured && (
                <p>
                  {s.captured.toLocaleString()} soldiers captured; no safe
                  withdrawal route remained.
                </p>
              )}
            </article>
          ))}
        </div>
        <p>
          Wounded soldiers remain with the army. Rest on supplied friendly land
          to recover them; cities and castles help them heal faster.
        </p>
        <button className="ed-primary" onClick={onClose}>
          Return to campaign
        </button>
        <details className="ed-round-log">
          <summary>Battle explanations</summary>
          {report.log.map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </details>
      </section>
    </div>
  );
}
