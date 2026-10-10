import { gameUi, useGameLanguage } from "../../../i18n/gameUi.ts";
import { useState } from "react";
import { Anchor, Castle, Crown, Eye, Flag, Handshake, Leaf, Route, Shield, Swords } from "lucide-react";
import type { Army, Campaign, Command, CouncilOffice, District, House, PeaceTerms, Person, SuccessionLaw } from "../../../games/MedievalKingdoms/edravane/types.ts";
import { campaignRound, councilSkill, DEMANDS, IDENTITIES, LAWS, ruler, season, successionPreview, TRAITS } from "../../../games/MedievalKingdoms/edravane/realm.ts";
import { bargainOpinionBonus, peaceDescription, truce, warScore } from "../../../games/MedievalKingdoms/edravane/campaignStrategy.ts";
import { EffectBadge } from "./RealmIcon.tsx";
import { provisionLimit, routeForecast, supplyConnection } from "../../../games/MedievalKingdoms/edravane/logistics.ts";
import { hexDistance, NATIONS } from "../../../games/MedievalKingdoms/edravane/world.ts";

type Actions = { state: Campaign; house: House; active: boolean; onCommand: (c: Command) => void };
export function Personality({ person }: { person?: Person }) {
  useGameLanguage();
  if (!person) return null;
  return <div className="ed-personality">
    <div className="ed-traits">{person.traits?.map((trait) => <span title={gameUi(TRAITS[trait])} key={trait}>{gameUi(trait)}<small>{gameUi(TRAITS[trait])}</small></span>)}</div>
    {person.skills && <dl className="ed-character-skills">{Object.entries(person.skills).map(([skill, value]) => <div key={skill} title={gameUi({ diplomacy: "Improves opinion gained from vassal bargains; a chancellor adds skill.", command: "Improves battle effectiveness; a marshal adds skill.", stewardship: "Improves royal income and provision capacity; a steward adds skill.", intrigue: "At 16 skill, scouts reveal three hexes; a spymaster adds skill." }[skill])}><dt>{gameUi(skill)}</dt><dd>{gameUi(value)}</dd></div>)}</dl>}
  </div>;
}
export function KingdomIdentity({ nation }: { nation: string }) {
  useGameLanguage();
  const identity = IDENTITIES[nation];
  return <div className="ed-identity"><strong>{gameUi(identity.title)}</strong><p>{gameUi(identity.strength)}</p><small>{gameUi(identity.problem)}</small></div>;
}
export function VassalBargain({ state, house, vassal, active, onCommand }: Actions & { vassal: House }) {
  useGameLanguage();
  const [officeChoice, setOffice] = useState<CouncilOffice>("marshal");
  const [estateChoice, setEstate] = useState("");
  const offices = (["marshal", "steward", "chancellor", "spymaster"] as const).filter((office) => !state.houses.some((h) => h.liege === house.id && h.contract?.office === office));
  const office = offices.includes(officeChoice) ? officeChoice : offices[0];
  const estates = state.districts.filter((d) => d.owner === house.id && !d.seat && !d.occupation && state.districts.some((n) => n.nation && n.nation !== house.nation && hexDistance(d, n) === 1));
  const estate = estates.find((d) => d.id === estateChoice) ?? estates[0];
  const demand = vassal.demand;
  if (!demand) return null;
  const done = (vassal.bargains ?? []).includes(demand.kind);
  const unavailable = !active ? "Negotiate on your own turn." : vassal.rebellion ? "This house is in rebellion." : done ? "This concession is already granted." : demand.kind === "council-seat" && !office ? "All council offices are occupied." : demand.kind === "border-estate" && !estate ? "You have no unoccupied royal estate on a foreign frontier." : demand.kind === "protect-trade" && house.treasury < 40 ? "Requires 40 coins." : "";
  return <div className="ed-bargain">
    <Personality person={ruler(vassal)} />
    <p className="ed-demand"><Handshake size={15} /><span><strong>{gameUi(demand.status === "fulfilled" ? "Agreement" : demand.status === "broken" ? "Broken promise" : "House demand")}</strong>{gameUi(DEMANDS[demand.kind])}</span></p>
    <small>{gameUi("Tax ")}{gameUi(Math.round((vassal.contract?.taxRate ?? 0.2) * 100))}%{gameUi(vassal.contract?.office ? ` · ${vassal.contract.office}` : "")}{gameUi(demand.deadline !== undefined ? ` · protection through round ${demand.deadline}` : "")}</small>
    {!done && demand.kind === "council-seat" && <label>{gameUi("Council office")}<select value={office ?? ""} onChange={(e) => setOffice(e.target.value as CouncilOffice)}>{offices.map((o) => <option key={o} value={o}>{gameUi(o)}</option>)}</select></label>}
    {!done && demand.kind === "border-estate" && <label>{gameUi("Estate to grant")}<select value={estate?.id ?? ""} onChange={(e) => setEstate(e.target.value)}>{estates.map((d) => <option key={d.id} value={d.id}>{gameUi(d.name)}</option>)}</select></label>}
    {!done && <><p className="ed-reason">{gameUi(demand.kind === "lower-taxes" ? "Tax falls to 10%; obligation rises by 200 soldiers." : demand.kind === "council-seat" ? "This house gains an office, contributes its ruler's skill, and supports your heir." : demand.kind === "border-estate" ? "Ownership and garrison reserves transfer; obligation rises by 300 soldiers." : "40 coins funds protected trade. A blockade before the deadline costs 20 opinion.")}{gameUi(" Matching their demand grants at least 20 opinion.")}</p>
      <div className="ed-effects"><EffectBadge metric="opinion" amount={bargainOpinionBonus(state, house, vassal, demand.kind)} label={gameUi("house opinion")} />{demand.kind === "protect-trade" && <EffectBadge metric="coins" amount={-40} />}{demand.kind === "lower-taxes" && <EffectBadge metric="troops" amount={200} label={gameUi("service obligation")} />}{demand.kind === "border-estate" && <EffectBadge metric="troops" amount={300} label={gameUi("service obligation")} />}</div>
      <button disabled={!!unavailable} onClick={() => onCommand({ type: "bargain", house: vassal.id, offer: demand.kind, office, hex: estate?.id })}><Handshake size={14} />{gameUi("Agree to this demand")}</button>
    </>}
    {unavailable && <p className="ed-reason">{gameUi(unavailable)}</p>}
  </div>;
}
export function SuccessionPlanner({ state, house, active, onCommand }: Actions) {
  useGameLanguage();
  const [lawChoice, setLaw] = useState<SuccessionLaw>(house.successionLaw ?? "primogeniture");
  const [heirChoice, setHeir] = useState("");
  const preview = successionPreview(state, house);
  const selected = preview.candidates.find((p) => p.id === heirChoice) ?? preview.next;
  const current = ruler(house);
  const law = house.successionLaw ?? "primogeniture";
  return <section className="ed-succession-planner" aria-label={gameUi("Succession planning")}>
    <span className="ed-eyebrow">{gameUi("THE NEXT REIGN")}</span><h3>{gameUi("Prepare your succession")}</h3>
    <div className="ed-family-tree"><div className="ed-family-founder"><Crown size={16} /><strong>{current?.name}</strong><small>{gameUi("Current ruler")}{gameUi(house.regent ? " · Regency" : "")}</small></div><div className="ed-family-branches">{preview.candidates.map((p) => <div className={p.id === preview.next?.id ? "ed-next-heir" : ""} key={p.id}><strong>{p.name}</strong><small>{gameUi(p.age)}{gameUi(" years · ")}{gameUi(p.id === preview.next?.id ? "Next heir" : "Rival claim")}</small><Personality person={p} /></div>)}</div></div>
    <p>{gameUi(LAWS[law])}</p>
    <div className="ed-succession-warning"><Shield size={16} /><div><strong>{gameUi(preview.next ? `${preview.next.name} would inherit${preview.regency ? " under a regency" : ""}` : "No eligible heir")}</strong><p>{gameUi(preview.supporters.length)}{gameUi(" supporting houses · ")}{gameUi(preview.opposition.length)}{gameUi(" potential opponents")}{gameUi(preview.estate ? ` · ${preview.estate.name} passes to a cadet branch` : "")}.</p>{!preview.recognized && <p className="ed-danger">{gameUi("Recognition blocked: improve legitimacy and secure a majority of house support.")}</p>}</div></div>
    {preview.opposition.length > 0 && <p className="ed-reason">{gameUi("Potential opponents: ")}{gameUi(preview.opposition.map((v) => v.name).join(", "))}{gameUi(". Council seats and fulfilled demands can secure their support.")}</p>}
    {(law === "elective" || law === "clan") && <><label>{gameUi("Nominate an heir")}<select value={selected?.id ?? ""} onChange={(e) => setHeir(e.target.value)}>{preview.candidates.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label><button disabled={!active || !selected || selected.id === house.designatedHeir} onClick={() => onCommand({ type: "nominate", person: selected!.id })}>{gameUi("Nominate ")}{gameUi(selected?.name ?? "an heir")}</button></>}
    <label>{gameUi("Inheritance law")}<select value={lawChoice} onChange={(e) => setLaw(e.target.value as SuccessionLaw)}>{Object.keys(LAWS).map((l) => <option key={l} value={l}>{gameUi(l)}</option>)}</select></label>
    <p className="ed-reason">{gameUi(LAWS[lawChoice])}{gameUi(" Changing the law affects every vassal.")}</p>
    <div className="ed-effects" aria-label={gameUi("Inheritance law effects")}><EffectBadge metric="coins" amount={-80} /><EffectBadge metric="legitimacy" amount={-10} /><EffectBadge metric="opinion" amount={-5} label={gameUi("vassal opinion")} /></div>
    <button disabled={!active || lawChoice === law || house.treasury < 80 || house.legitimacy < 50} onClick={() => onCommand({ type: "successionLaw", law: lawChoice })}>{gameUi("Change inheritance law")}</button>
    {gameUi(!active ? <p className="ed-reason">{gameUi("Plan succession on your own turn.")}</p> : house.legitimacy < 50 ? <p className="ed-reason">{gameUi("Changing the law requires 50 legitimacy.")}</p> : house.treasury < 80 ? <p className="ed-reason">{gameUi("Changing the law requires 80 coins.")}</p> : null)}
  </section>;
}
export function MarriagePlanner({ state, house, active, onCommand }: Actions) {
  useGameLanguage();
  const [targetChoice, setTarget] = useState("");
  const [firstChoice, setFirst] = useState("");
  const [secondChoice, setSecond] = useState("");
  const eligible = (h: House) => h.family.filter((p) => p.alive && p.age >= 18 && !p.spouse && !p.imprisonedBy && p.id !== h.ruler);
  const targets = state.houses.filter((h) => h.id !== house.id && eligible(h).length && !state.wars.includes([house.nation, h.nation].sort().join("|")));
  const target = targets.find((h) => h.id === targetChoice) ?? targets[0];
  const ours = eligible(house), theirs = target ? eligible(target) : [];
  const first = ours.find((p) => p.id === firstChoice) ?? ours[0], second = theirs.find((p) => p.id === secondChoice) ?? theirs[0];
  return <section className="ed-marriage-planner"><h3>{gameUi("Arrange a dynastic marriage")}</h3>
    <label>{gameUi("Your heir")}<select value={first?.id ?? ""} onChange={(e) => setFirst(e.target.value)}>{ours.map((p) => <option value={p.id} key={p.id}>{p.name}</option>)}</select></label>
    <label>{gameUi("Partner house")}<select value={target?.id ?? ""} onChange={(e) => setTarget(e.target.value)}>{targets.map((h) => <option value={h.id} key={h.id}>{gameUi(h.name)} · {gameUi(NATIONS.find((n) => n.id === h.nation)?.name)}</option>)}</select></label>
    <label>{gameUi("Their heir")}<select value={second?.id ?? ""} onChange={(e) => setSecond(e.target.value)}>{theirs.map((p) => <option value={p.id} key={p.id}>{p.name}</option>)}</select></label>
    <p className="ed-reason">{gameUi(first && second ? `${first.name} and ${second.name}: 30 coins; the receiving crown must consent. A living marriage creates a pact and protects against border conquest. Children inherit family claims.` : "Both houses need free, unmarried adult heirs.")}</p>
    <button disabled={!active || !first || !second || !target || house.treasury < 30} onClick={() => onCommand({ type: "marry", house: target!.id, people: [first!.id, second!.id] })}><Handshake size={14} />{gameUi("Propose this marriage")}</button>
    {!active && <small>{gameUi("Propose marriages on your own turn.")}</small>}
  </section>;
}
export function PeaceNegotiator({ state, house, nation, active, onCommand }: Actions & { nation: string }) {
  useGameLanguage();
  const [kind, setKind] = useState<PeaceTerms["kind"]>("white");
  const [hexChoice, setHex] = useState("");
  const [claimChoice, setClaim] = useState("");
  const [coins, setCoins] = useState(0), [access, setAccess] = useState(false);
  const opponent = state.houses.find((h) => h.id === state.titles.find((t) => t.nation === nation)?.holder)!;
  const occupied = state.districts.filter((d) => state.houses.find((h) => h.id === d.owner)?.nation === nation && state.houses.find((h) => h.id === d.occupation)?.nation === house.nation);
  const claimants = state.houses.filter((h) => h.nation === nation && h.role === "claimant" && h.id !== opponent.id && ruler(h)?.alive && !ruler(h)?.imprisonedBy);
  const hex = occupied.find((d) => d.id === hexChoice) ?? occupied[0], claimant = claimants.find((h) => h.id === claimChoice) ?? claimants[0];
  const score = warScore(state, house.nation, nation);
  const terms: PeaceTerms = { kind, coins, militaryAccess: access, ...(kind === "cede" ? { hex: hex?.id } : {}), ...(kind === "claimant" ? { claimant: claimant?.id } : {}) };
  const unavailable = !active ? "Negotiate on your own turn." : kind === "cede" && !hex ? "Occupy an opposing estate before requesting it." : kind === "claimant" && (!claimant || score < 60) ? "Installing a claimant requires 60 leverage and a free opposing claimant." : kind === "tribute" && score < 20 ? "Tribute requires 20 leverage." : coins > opponent.treasury ? "Their treasury cannot afford these reparations." : "";
  const conflict = state.conflicts?.find((w) => [w.from, w.to].includes(house.nation) && [w.from, w.to].includes(nation));
  return <div className="ed-peace-planner"><h3>{gameUi("Negotiate a settlement")}</h3><p>{gameUi("Leverage: ")}<strong>{gameUi(score > 0 ? "+" : "")}{gameUi(score)}</strong> · {gameUi(conflict?.objective ? `Objective: ${state.districts.find((d) => d.id === conflict.objective)?.name}` : "Occupation and prisoners strengthen your demands.")}</p>
    <label>{gameUi("Peace terms")}<select value={kind} onChange={(e) => setKind(e.target.value as PeaceTerms["kind"])}><option value="white">{gameUi("White peace")}</option><option value="recover">{gameUi("Recover occupied land")}</option><option value="release">{gameUi("Release relatives")}</option><option value="open-trade">{gameUi("Restore trade access")}</option><option value="cede">{gameUi("Cede an occupied estate")}</option><option value="claimant">{gameUi("Install a claimant")}</option><option value="tribute">{gameUi("Three rounds of tribute")}</option></select></label>
    {kind === "cede" && <label>{gameUi("Estate")}<select value={hex?.id ?? ""} onChange={(e) => setHex(e.target.value)}>{occupied.map((d) => <option key={d.id} value={d.id}>{gameUi(d.name)}</option>)}</select></label>}
    {kind === "claimant" && <label>{gameUi("Claimant")}<select value={claimant?.id ?? ""} onChange={(e) => setClaim(e.target.value)}>{claimants.map((h) => <option key={h.id} value={h.id}>{gameUi(h.name)}</option>)}</select></label>}
    <label>{gameUi("Reparations · ")}{gameUi(coins)}{gameUi(" coins")}<input type="range" min="0" max="500" step="25" value={coins} onChange={(e) => setCoins(Number(e.target.value))} /></label>
    <label className="ed-checkbox"><input type="checkbox" checked={access} onChange={(e) => setAccess(e.target.checked)} />{gameUi("Mutual military access")}</label>
    <p className="ed-reason">{gameUi(peaceDescription(terms))}</p><button disabled={!!unavailable} onClick={() => onCommand({ type: "peace", nation, terms })}><Handshake size={14} />{gameUi("Send these peace terms")}</button>{unavailable && <p className="ed-reason">{gameUi(unavailable)}</p>}
  </div>;
}
export function ArmyLogistics({ state, house, army, destination }: { state: Campaign; house: House; army?: Army; destination?: District }) {
  useGameLanguage();
  if (!army || army.garrison || army.house !== house.id && army.pledgedTo !== house.id) return null;
  const supply = supplyConnection(state, army), forecast = destination && destination.id !== army.hex ? routeForecast(state, army, destination.id) : null;
  return <div className="ed-logistics" aria-label={gameUi("Army supply and route preview")}><div><Route size={15} /><strong>{gameUi(supply.connected ? "Supply route open" : "Supply route cut")}</strong><span>{gameUi(army.provisions ?? 0)}/{gameUi(provisionLimit(state, army))}{gameUi(" turns of carried food")}</span></div><p>{gameUi(supply.reason)}. {gameUi(season(state))}.</p>{forecast && <p className={forecast.risk ? "ed-danger" : "ed-reason"}>{gameUi(forecast.path.length ? `${forecast.path.length} hexes · ${forecast.isolated} without friendly supply · ${forecast.stores} food turns remaining at arrival${forecast.risk ? "; starvation is likely before arrival" : ""}.` : "No contiguous land route. An island needs naval transport.")}{gameUi(" Winter raises food use and attrition. Forecasts use your current intelligence.")}</p>}</div>;
}
export function DistrictStrategy({ state, house, district, army, active, onCommand }: Actions & { district: District; army?: Army }) {
  useGameLanguage();
  const own = district.owner === house.id && !district.occupation;
  const siege = state.sieges?.find((v) => v.hex === district.id);
  const attacker = state.armies.find((a) => a.id === siege?.army);
  const canSiege = army && !army.garrison && (army.house === house.id || army.pledgedTo === house.id) && district.castle && district.owner && state.houses.find((h) => h.id === (district.occupation ?? district.owner))?.nation !== house.nation;
  const adjacent = army && hexDistance(state.districts.find((d) => d.id === army.hex)!, district) <= 1;
  const war = district.owner && state.wars.includes([house.nation, state.houses.find((h) => h.id === (district.occupation ?? district.owner))!.nation].sort().join("|"));
  const scoutRange = councilSkill(state, house, "intrigue") >= 16 ? 3 : 2;
  const scoutReason = !active ? "Scout on your own turn." : ["sea", "legacy"].includes(district.biome) ? "Scouts need a land district." : house.treasury < 25 ? "Requires 25 coins." : state.scouts?.some((m) => m.house === house.id && m.hex === district.id && m.until >= campaignRound(state)) ? "Scouts already cover this area." : !state.districts.some((d) => state.houses.find((h) => h.id === d.owner)?.nation === house.nation && hexDistance(d, district) <= 6) ? "This district is beyond the scouts' six-hex travel range." : "";
  return <section className="ed-district-strategy">
    {own && <><h3>{gameUi("Roads, stores & watchtowers")}</h3><div className="ed-infrastructure">{(["road", "depot", "watchtower"] as const).map((building) => <div key={building}><button disabled={!active || district[building] || house.treasury < { road: 40, depot: 70, watchtower: 60 }[building] || house.stock.timber < 15} onClick={() => onCommand({ type: "infrastructure", hex: district.id, building })}>{gameUi(building === "road" ? <Route size={14} /> : building === "depot" ? <Leaf size={14} /> : <Eye size={14} />)}{gameUi(district[building] ? `${building} built` : `Build ${building} · ${{ road: 40, depot: 70, watchtower: 60 }[building]}`)}</button></div>)}</div><p className="ed-reason">{gameUi("Each costs 15 timber. Roads help crossings; depots supply nearby hosts; watchtowers reveal armies within ")}{gameUi(house.nation === "dunwald" ? 3 : 2)}{gameUi(" hexes.")}</p>{house.stock.timber < 15 && <small>{gameUi("More timber is needed to build infrastructure.")}</small>}</>}
    {siege && <div className="ed-siege-state"><Castle size={18} /><strong>{gameUi("Castle under siege")}</strong><p>{gameUi(siege.turns)}{gameUi(" siege turns · ")}{gameUi(siege.food)}{gameUi(" turns of garrison food · ")}{gameUi(siege.engines ? "Siege engines ready" : "Engines need three turns, 20 timber and 10 iron")}.</p><small>{gameUi(attacker?.name ?? "A hostile host")}{gameUi(" holds the approaches. Relief troops can attack the besieging host.")}</small></div>}
    {canSiege && <><h3>{gameUi("Siege options")}</h3><p className="ed-reason">{gameUi("Blockade to exhaust the garrison, demand its surrender, or assault. An assault costs ")}{gameUi(siege?.engines ? "3%" : "12%")}{gameUi(" of your troops before battle.")}</p><div className="ed-siege-actions">{(["blockade", "negotiate", "assault", ...(siege?.army === army!.id ? ["lift"] as const : [])] as const).map((stance) => <button key={stance} disabled={!active || !adjacent || !war || stance === "negotiate" && !!siege?.offered} onClick={() => onCommand({ type: "siege", army: army!.id, hex: district.id, stance })}>{stance === "blockade" ? <Anchor size={14} /> : <Swords size={14} />}{gameUi(stance === "blockade" ? "Lay blockade" : stance === "negotiate" ? "Demand surrender" : stance === "assault" ? "Assault walls" : "Lift siege")}</button>)}</div>{gameUi(!war ? <small>{gameUi("Declare war before besieging this castle.")}</small> : !adjacent ? <small>{gameUi("March the selected host next to this castle first.")}</small> : !active ? <small>{gameUi("Give siege orders on your own turn.")}</small> : null)}</>}
    <div className="ed-scout-action"><button disabled={!!scoutReason} onClick={() => onCommand({ type: "scout", hex: district.id })}><Eye size={14} />{gameUi("Scout this area · 25 coins")}</button><small>{gameUi(scoutRange)}{gameUi("-hex visibility for two rounds; scouts travel up to six hexes from your realm.")}</small>{scoutReason && <small>{gameUi(scoutReason)}</small>}</div>
  </section>;
}
export function TreatyStatus({ state, from, to }: { state: Campaign; from: string; to: string }) {
  useGameLanguage();
  const treaty = truce(state, from, to);
  return treaty ? <p className="ed-treaty"><Handshake size={14} />{gameUi("Truce through round ")}{gameUi(treaty.until)}{gameUi(treaty.access ? " · military access" : "")}{gameUi(treaty.trade ? " · protected trade" : "")}</p> : null;
}
export function Chronicle({ state, onHouse, onHex }: { state: Campaign; onHouse: (h: House) => void; onHex: (d: District) => void }) {
  useGameLanguage();
  const [expanded, setExpanded] = useState(false);
  const events = state.events ?? [];
  return <section className="ed-chronicle" aria-label={gameUi("Kingdom chronicle")}><div className="ed-chronicle-heading"><Flag size={16} /><strong>{gameUi("Kingdom chronicle")}</strong><button onClick={() => setExpanded((v) => !v)} aria-expanded={expanded}>{gameUi(expanded ? "Recent events" : "Earlier events")}</button></div><div className="ed-event-list">{events.slice(0, expanded ? 30 : 4).map((e) => {
    const h = state.houses.find((h) => h.id === e.house), d = state.districts.find((d) => d.id === e.hex);
    return <article className="ed-event" key={e.id}><span className="ed-event-crest" style={{ color: h?.color }}>{gameUi(h?.crest ?? "♜")}</span><div><small>{gameUi("Round ")}{gameUi(e.round)} · {gameUi(e.kind)}</small><strong>{gameUi(e.title)}</strong><p>{gameUi(e.detail)}</p><div className="ed-event-links">{h && <button onClick={() => onHouse(h)}>{gameUi("House ")}{gameUi(h.name)}</button>}{d && <button onClick={() => onHex(d)}>{gameUi(d.name)}</button>}</div></div></article>;
  })}{!events.length && <p className="ed-reason">{gameUi("Diplomacy, succession, promises and battles will write the story of your reign.")}</p>}</div></section>;
}
