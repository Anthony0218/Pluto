import { gameUi, useGameLanguage } from "../../../i18n/gameUi.ts";
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
  useGameLanguage();
  return (
    <details className="ed-unit-guide" open={open}>
      <summary>{gameUi("Unit strengths & counters")}</summary>
      <p>{gameUi(" Green means stronger against the target; amber means weaker. Position, terrain, morale, and supplies also affect combat. ")}</p>
      <div className="ed-counter-scroll">
        <table>
          <caption>{gameUi("Attacking unit → target unit · strength multiplier")}</caption>
          <thead>
            <tr>
              <th>{gameUi("Unit")}</th>
              {UNIT_KINDS.map((k) => (
                <th key={k}>{gameUi(UNIT_NAMES[k])}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {UNIT_KINDS.map((k) => (
              <tr key={k}>
                <th>{gameUi(UNIT_NAMES[k])}</th>
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
                      {gameUi(value.toFixed(2))}×
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        <strong>{gameUi("Braced spearmen:")}</strong>{gameUi(" Hold in the front makes spearmen 1.60× against cavalry; cavalry falls to 0.50× against them. ")}</p>
      {UNIT_KINDS.map((k) => (
        <div className="ed-unit-note" key={k}>
          <strong>
            {gameUi(UNIT_NAMES[k])}{gameUi(" · best in the ")}{gameUi(UNIT_HELP[k].position)}
          </strong>
          <span>{gameUi("Effective: ")}{gameUi(UNIT_HELP[k].strong)}.</span>
          <span>{gameUi("Vulnerable: ")}{gameUi(UNIT_HELP[k].weak)}.</span>
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
  useGameLanguage();
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
        aria-label={gameUi("Turn-based battle")}
      >
        <header>
          <div>
            <span className="ed-eyebrow">
              {gameUi(battle.phase === "encounter"
                ? "BATTLE PREVIEW"
                : `BATTLE ROUND ${r.round}`)}
            </span>
            <h2>{gameUi(d.name)}</h2>
          </div>
          <button onClick={onInspect}>{gameUi("Inspect campaign")}</button>
        </header>
        <p className="ed-round-status" role="status">
          {gameUi(battle.phase === "encounter"
            ? "Choose to fight or withdraw. The campaign waits for your decision."
            : r.committed.length
              ? "Orders committed. Waiting for the opposing commander; their orders remain hidden."
              : "Choose positions and one army order. Both sides resolve together after committing.")}
        </p>
        <div className="ed-battle-summary">
          {forecast.sides.map((side, i) => (
            <article key={side.army}>
              <span className="ed-eyebrow">
                {gameUi(i === 0 ? "ATTACKER" : "DEFENDER")}
              </span>
              <h3>{gameUi(side.name)}</h3>
              <dl>
                <div>
                  <dt>{gameUi("Healthy")}</dt>
                  <dd>{gameUi(side.healthy.toLocaleString())}</dd>
                </div>
                <div>
                  <dt>{gameUi("Wounded")}</dt>
                  <dd>{gameUi(side.wounded.toLocaleString())}</dd>
                </div>
                <div>
                  <dt>{gameUi("Readiness")}</dt>
                  <dd>{gameUi(side.health)}%</dd>
                </div>
                <div>
                  <dt>{gameUi("Morale")}</dt>
                  <dd>{gameUi(side.morale)}/100</dd>
                </div>
                <div>
                  <dt>{gameUi("Loyalty")}</dt>
                  <dd>{gameUi(side.loyalty)}%</dd>
                </div>
                <div>
                  <dt>{gameUi("Supplies")}</dt>
                  <dd>{gameUi(side.supply)}%</dd>
                </div>
              </dl>
              <progress
                max={100}
                value={gameUi(side.morale)}
                aria-label={gameUi(`${side.name} morale`)}
              />
            </article>
          ))}
        </div>
        <p className="ed-forecast">{gameUi(" Estimated attacker advantage: ")}<strong>{gameUi(forecast.chance)}%</strong>{gameUi(" · defender ")}{gameUi(100 - forecast.chance)}{gameUi("%. A strength estimate, not a guaranteed outcome; orders and reinforcements can change it. ")}</p>
        <div className="ed-round-layout">
          <div>
            <svg
              viewBox="0 0 600 340"
              role="img"
              aria-label={gameUi("Battle positions: protected rear, front line, and flanks")}
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
                    {gameUi(side === 0 ? "ATTACKER" : "DEFENDER")}
                    {gameUi(side === 1 && d.castle
                      ? ` · CASTLE LVL ${d.castle.level}`
                      : "")}
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
                          {gameUi(position.toUpperCase())}
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
                              {gameUi(icons[f.kind])} {gameUi(UNIT_NAMES[f.kind])}{gameUi(" ")}
                              {gameUi(Math.floor(f.count))}
                              {gameUi(f.routed ? " ↘" : "")}
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
                <p key={gameUi(line)}>{gameUi(line)}</p>
              ))}
              <p>{gameUi(" Wounded soldiers cannot fight. At a supplied friendly city, 25% recover per own turn; castles 20%, friendly camps 10%. ")}</p>
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
                <section key={id} aria-label={gameUi(`Orders for ${a.name}`)}>
                  <h3>{gameUi("Your orders · ")}{gameUi(a.name)}</h3>
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
                        {gameUi(battle.stood.includes(id)
                          ? "Waiting for opponent"
                          : "Stand and fight")}
                      </button>
                      <button
                        onClick={() =>
                          onCommand({
                            type: "retreat",
                            battle: battle.id,
                            army: id,
                          })
                        }
                      >{gameUi(" Withdraw before battle ")}</button>
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
                              {gameUi(ORDER_NAMES[order])}
                            </button>
                          ),
                        )}
                      </div>
                      <p>{gameUi(ORDER_HELP[plan.order])}</p>
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
                        {gameUi(committed
                          ? "Orders committed"
                          : `Commit round ${r.round}`)}
                      </button>
                      <fieldset disabled={committed}>
                        <legend>{gameUi("Deploy your troops")}</legend>
                        {battle.formations
                          .filter((f) => f.army === id)
                          .map((f) => (
                            <label key={f.id}>
                              {gameUi(UNIT_NAMES[f.kind])} · {gameUi(Math.floor(f.count))}{gameUi(" ")}{gameUi(" healthy")}{gameUi(f.routed ? " · Routed" : "")}
                              <select
                                aria-label={gameUi(`${UNIT_NAMES[f.kind]} position`)}
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
                                <option value="front">{gameUi("Front line")}</option>
                                <option value="rear">{gameUi("Protected rear")}</option>
                                <option value="flank">{gameUi("Flank")}</option>
                              </select>
                              <small>{gameUi(" Strong: ")}{gameUi(UNIT_HELP[f.kind].strong)}{gameUi(". Weak:")}{gameUi(" ")}
                                {gameUi(UNIT_HELP[f.kind].weak)}.
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
                    >{gameUi(" Call 100 city reserves · 10 coins · 10 food ")}</button>
                  )}
                </section>
              );
            })}
            {message && (
              <p role="alert" className="ed-notice">
                {gameUi(message)}
              </p>
            )}
          </aside>
        </div>
        {!!r.log.length && (
          <section
            className="ed-round-log"
            aria-label={gameUi("Battle round explanations")}
          >
            <h3>{gameUi("What happened")}</h3>
            {r.log.map((line, i) => (
              <p key={`${r.round}-${i}`}>{gameUi(line)}</p>
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
  useGameLanguage();
  return (
    <div className="ed-battle-backdrop">
      <section
        className="ed-battle-modal"
        role="dialog"
        aria-modal="true"
        aria-label={gameUi("Battle outcome")}
      >
        <span className="ed-eyebrow">{gameUi(" BATTLE OUTCOME · ")}{gameUi(report.round)}{gameUi(" ROUNDS ")}</span>
        <h2>
          {gameUi(report.winner
            ? `${report.winner} holds the field`
            : "Both armies leave the field")}
        </h2>
        <GameXpReward />
        <div className="ed-battle-summary">
          {report.sides.map((s) => (
            <article key={s.army}>
              <h3>{gameUi(s.name)}</h3>
              <p>
                {gameUi(s.healthy.toLocaleString())}{gameUi(" healthy survivors ·")}{gameUi(" ")}
                {gameUi(s.wounded.toLocaleString())}{gameUi(" wounded · ")}{gameUi(s.dead.toLocaleString())}{gameUi(" ")}{gameUi(" dead. ")}</p>
              {s.escaped && <p>{gameUi("Survivors retreat to a safe neighboring hex.")}</p>}
              {!!s.captured && (
                <p>
                  {gameUi(s.captured.toLocaleString())}{gameUi(" soldiers captured; no safe withdrawal route remained. ")}</p>
              )}
            </article>
          ))}
        </div>
        <p>{gameUi(" Wounded soldiers remain with the army. Rest on supplied friendly land to recover them; cities and castles help them heal faster. ")}</p>
        <button className="ed-primary" onClick={onClose}>{gameUi(" Return to campaign ")}</button>
        <details className="ed-round-log">
          <summary>{gameUi("Battle explanations")}</summary>
          {report.log.map((line, i) => (
            <p key={i}>{gameUi(line)}</p>
          ))}
        </details>
      </section>
    </div>
  );
}
