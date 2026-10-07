# Edravane battle rules

A declared attack first gives the defender a campaign response. Defend, reinforce or withdraw before the attacker enters the territory. An encounter then permits a final withdrawal or a stand. Campaign time stays frozen while these decisions and the battle are pending.

## One order per army

Deploy troop types in three zones: front, protected rear or flank. Positions carry forward between rounds. Select Hold, Advance, Flank, Volley or Retreat, then commit. Both sides resolve together; multiplayer hides the opponent’s plan until resolution. Bots choose from the same orders and use the same casualty engine.

| Order | Effect |
| --- | --- |
| Hold | Braces front spearmen, improves defense, reduces fatigue and supports morale; lower attacking strength. |
| Advance | Presses the front; cavalry benefits from an open-ground charge. |
| Flank | Troops in the flank zone try to reach the rear, increasing strength and shocking enemy morale. Cavalry is stopped by braced spearmen, forests, mountains, rivers or castles. |
| Volley | Increases archer strength; other troops attack less effectively. |
| Retreat | Preserves survivors and wounded on an available safe neighboring hex, with pursuit losses. Without a safe retreat, surviving troops are captured. |

Low morale or severe depletion routes formations. A battle ends when one side cannot fight, both sides withdraw or the 20-round limit is reached. The last case compares remaining combat power.

## Unit counters

The **Unit strengths & counters** panel shows the complete multiplier table and readable role advice, both in battle and the recruitment/attack interfaces. Green cells mean an advantage and amber cells a disadvantage; numerical values also convey the difference.

| Troops | Starting role | Strengths and vulnerabilities |
| --- | --- | --- |
| Footsoldiers | Front | Affordable protection for archers; weak against heavy infantry and cavalry reaching their flank. |
| Spearmen | Front | 1.30× against cavalry, rising to 1.60× when holding the front. Cavalry attacks braced spearmen at 0.50×. Vulnerable to archers and heavy infantry. |
| Archers | Rear | 1.20× against footsoldiers and spearmen. Exposed archers lose 60% effectiveness; a broken front or successful cavalry flank can expose them. |
| Heavy infantry | Front | 1.25× against footsoldiers and spearmen; a strong front, subject to fatigue and rear attacks. |
| Cavalry | Flank | 1.45× against exposed archers, open-ground bonuses and pursuit; vulnerable to spearmen and difficult terrain. |

Terrain, castle level, orders, fatigue, supplies and morale also affect combat, so a favorable counter alone does not guarantee victory. The preview shows healthy and wounded troops, readiness, morale, loyalty, supplies, terrain and relative estimated strength. It is not a probabilistic prediction of who will win.

## Morale, wounds and settlements

Army loyalty establishes starting morale; vassal troop loyalty is capped by its house’s loyalty. Casualties, rear attacks, food shortages and commander incapacitation lower morale. Holding with supporting formations and successful attacks help it. Battle outcomes update the surviving army’s campaign morale.

Losses are recorded once: 35% deaths and the remainder wounded, with whole-soldier rounding. Only healthy soldiers fight; readiness displays the healthy share and is not applied again as a separate damage penalty. Wounded stay with surviving armies and consume upkeep. Recovery requires supplied friendly land, no active travel and no hostile army present. On the army’s own crown turn, 25% of its wounded recover at a city, 20% at a castle and 10% at a camp.

Level 1/2/3 castles grant 15%/30%/55% defense. Friendly cities support the defender with food and faster recovery. Once per battle, a city defender can call 100 healthy troops from an eligible nearby garrison for 10 coins and 10 food; the reserve retains at least 500 healthy soldiers. Reinforcing does not copy wounded soldiers or create manpower.

The outcome panel separates healthy survivors, wounded, deaths and captures and preserves explanations from the final rounds. The campaign retains the latest eight battle reports. Existing saved campaigns continue to load; a battle already underway under the legacy rules finishes under those rules, while new encounters use rounds.

## Verification

Twelve dedicated battle tests exercise actual campaign commands and resolution, alongside the full 98-test campaign and multiplayer suite. Multiplayer verification covers the Supabase authority and database permissions, plus legacy socket regression fixtures. Live checks against the deployed Supabase function use two authenticated players to verify hidden plans, commitment, round authority, frozen human turns and durable battle aftermath.

Desktop browser checks verify the preview, city reinforcement costs and guard preservation, position persistence between rounds, visible counters, simultaneous round explanations, campaign inspection and return, retreat outcome and house wound/readiness totals. At 390px width, the battle uses one column and order selection and commitment remain reachable. Screenshots: `edravane-battle-preview.jpg`, `edravane-unit-counters-preview.jpg` and `edravane-battle-mobile-preview.jpg`.
