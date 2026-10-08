import type { Campaign, CharacterSkills, ChronicleEvent, House, Person, SuccessionLaw, Trait } from "./types.ts";
import { NATIONS } from "./world.ts";

export const TRAITS: Record<Trait, string> = {
  ambitious: "Seeks power; rival claims and offices matter more.",
  loyal: "Supports the lawful heir and answers summons more readily.",
  greedy: "Values tax concessions and trade privileges.",
  proud: "Resents insults and demands recognition.",
  cautious: "Requires stronger defenses and food stocks before initiating conquest.",
  brave: "Commands more effectively but favors military solutions.",
};
export const DEMANDS = {
  "lower-taxes": "Reduce my taxes in exchange for 200 more pledged soldiers",
  "council-seat": "Give me a council office in exchange for supporting your heir",
  "border-estate": "Grant me a border estate in exchange for 300 more pledged soldiers",
  "protect-trade": "Protect my trade: no blockades for the next three rounds",
};
export const LAWS: Record<SuccessionLaw, string> = {
  primogeniture: "Eldest eligible heir inherits the house and estates.",
  partition: "The crown stays with the eldest heir; a younger heir receives an estate and founds a cadet house.",
  elective: "Powerful houses confirm the nominated heir; a majority must support the succession.",
  clan: "The assembly confirms an heir; legitimacy and achievements determine recognition.",
};
export const IDENTITIES: Record<string, { title: string; strength: string; problem: string }> = {
  auremarch: { title: "The breadbasket crown", strength: "Fertile grain estates; stewardship improves royal income.", problem: "Resource lords demand tax privileges." },
  "high-cairn": { title: "Lords of the mountain gates", strength: "An extra 10% castle defense in hills and mountains.", problem: "Frontier lords seek land and military command." },
  saltmere: { title: "The merchant queens", strength: "Friendly sea lanes resupply island armies; maritime trade earns 10% more.", problem: "Merchant houses expect protected routes." },
  dunwald: { title: "Wardens of the woods", strength: "Watchtowers see three hexes through woodland.", problem: "Proud frontier houses demand council recognition." },
  varnesk: { title: "The winter court", strength: "Hosts carry four turns of provisions and suffer less seasonal winter attrition.", problem: "Winter grain production falls; stockpile or import food." },
  sylvarenne: { title: "The council crown", strength: "Council offices provide skilled advisers and heir support.", problem: "A majority of houses must confirm a nominated heir." },
  "ilyr-coast": { title: "The diplomatic ports", strength: "Foreign marriage pacts gain an extra 10 relationship points.", problem: "Trade families demand safe international routes." },
  graskor: { title: "The clan assembly", strength: "Battle victories earn prestige and strengthen assembly recognition.", problem: "An unrecognized heir needs legitimacy or military achievements." },
};
const clamp = (n: number, a = 0, b = 100) => Math.max(a, Math.min(b, n));
export const campaignRound = (s: Campaign) => s.turns?.round ?? Math.floor(s.tick / 8) + 1;
export const season = (s: Campaign) => ["Spring", "Summer", "Autumn", "Winter"][Math.floor((campaignRound(s) - 1) / 3) % 4];
export function character(person: Person) {
  const hash = Array.from(person.id).reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 7);
  const keys = Object.keys(TRAITS) as Trait[];
  person.traits ??= [keys[hash % keys.length], keys[(hash % keys.length + 1 + (hash % 4)) % keys.length]];
  person.skills ??= {
    diplomacy: 4 + hash % 11, command: 4 + (hash >>> 4) % 11,
    stewardship: 4 + (hash >>> 8) % 11, intrigue: 4 + (hash >>> 12) % 11,
  };
  person.claims ??= person.claim ? [person.claim] : [];
}
export function initializeStrategy(s: Campaign) {
  if (s.strategyRules) return;
  s.strategyRules = 1;
  s.conflicts ??= [];
  s.treaties ??= [];
  s.sieges ??= [];
  s.scouts ??= [];
  s.intelligence ??= {};
  s.events ??= [];
  for (const h of s.houses) {
    h.family.forEach(character);
    h.contract ??= { taxRate: 0.2 };
    h.successionLaw ??= h.nation === "sylvarenne" ? "elective" : h.nation === "graskor" ? "clan" : "primogeniture";
    h.prestige ??= 0;
    h.bargains ??= [];
    if (h.liege) h.demand ??= { kind: h.role === "resource" ? "lower-taxes" : h.role === "frontier" ? "border-estate" : h.role === "trade" ? "protect-trade" : "council-seat", status: "open", since: campaignRound(s) };
  }
  for (const a of s.armies) a.provisions ??= a.origin === "varnesk" ? 4 : 3;
}
export function event(s: Campaign, value: Omit<ChronicleEvent, "id" | "tick" | "round">) {
  if (!s.strategyRules) return;
  (s.events ??= []).unshift({ ...value, id: `event-${++s.serial}`, tick: s.tick, round: campaignRound(s) });
  s.events = s.events.slice(0, 120);
}
export function ruler(h: House) { return h.family.find((p) => p.id === h.ruler); }
export function councilSkill(s: Campaign, h: House, skill: keyof CharacterSkills) {
  const office = { command: "marshal", diplomacy: "chancellor", stewardship: "steward", intrigue: "spymaster" }[skill];
  const adviser = s.houses.find((v) => v.liege === h.id && !v.rebellion && v.contract?.office === office);
  return (ruler(h)?.skills?.[skill] ?? 8) + Math.floor((adviser ? ruler(adviser)?.skills?.[skill] ?? 0 : 0) / 3);
}
export function successionCandidates(_s: Campaign, h: House) {
  const n = NATIONS.find((n) => n.id === h.nation)!;
  return h.family.filter((p) => p.alive && p.id !== h.ruler && !p.imprisonedBy &&
    (p.parents.includes(h.ruler) || p.claim === h.nation) &&
    (n.succession === "Kings inherit" ? p.gender === "male" : n.succession === "Queens inherit" ? p.gender === "female" : true))
    .sort((a, b) => b.age - a.age || a.id.localeCompare(b.id));
}
export function successionPreview(s: Campaign, h: House) {
  const candidates = successionCandidates(s, h);
  const next = candidates.find((p) => p.id === h.designatedHeir) ?? candidates[0];
  const vassals = s.houses.filter((v) => v.liege === h.id && !v.rebellion);
  const supporters = vassals.filter((v) => v.loyalty >= 60 || !!v.contract?.office || ruler(v)?.traits?.includes("loyal"));
  const opposition = vassals.filter((v) => !supporters.includes(v));
  const law = h.successionLaw ?? "primogeniture";
  const recognized = law === "elective" ? h.legitimacy >= 40 && (!vassals.length || supporters.length > vassals.length / 2) :
    law === "clan" ? h.legitimacy + (h.prestige ?? 0) * 0.25 >= 40 : true;
  const estate = law === "partition" && candidates.length > 1 ? s.districts.find((d) => d.owner === h.id && !d.seat && !d.occupation) : undefined;
  return { next, candidates, supporters, opposition, recognized, estate, regency: !!next && next.age < 16 };
}
export function succeed(s: Campaign, h: House, forced = false) {
  const preview = successionPreview(s, h);
  if (!preview.next || (!preview.recognized && !forced)) throw Error("No recognized heir: raise legitimacy or secure a majority of council support");
  const former = ruler(h)!;
  former.alive = false;
  h.ruler = preview.next.id;
  h.legitimacy = clamp(h.legitimacy - 10);
  h.regent = preview.regency ? preview.supporters[0]?.ruler ?? h.family.find((p) => p.alive && p.age >= 16 && !p.imprisonedBy)?.id : undefined;
  delete h.designatedHeir;
  for (const a of s.armies.filter((a) => a.house === h.id)) a.commander = h.regent ?? h.ruler;
  for (const v of preview.opposition) {
    v.opinion = clamp(v.opinion - (ruler(v)?.traits?.includes("ambitious") ? 15 : 8));
    v.loyalty = Math.round(v.opinion * 0.55 + v.legitimacy * 0.45);
    v.demand = { kind: "council-seat", status: "open", since: campaignRound(s) };
  }
  if (preview.estate) {
    const younger = preview.candidates.find((p) => p.id !== preview.next!.id)!;
    const id = `cadet-${++s.serial}`;
    const cadet: House = { ...structuredClone(h), id, name: `${h.name} of ${preview.estate.name}`, ruler: younger.id,
      family: [structuredClone(younger)], treasury: 40, stock: { ...h.stock, grain: 60 }, liege: h.id,
      role: "claimant", opinion: 55, legitimacy: 60, loyalty: 57, obligation: 200, rebellion: false,
      contract: { taxRate: 0.2 }, bargains: [], regent: undefined, designatedHeir: undefined,
      demand: { kind: "council-seat", status: "open", since: campaignRound(s) }, reasons: [], relations: {}, summons: "No active summons" };
    h.family = h.family.filter((p) => p.id !== younger.id);
    h.treasury = Math.max(0, h.treasury - 40);
    for (const resource of Object.keys(h.stock) as Array<keyof House["stock"]>) {
      const share = Math.floor(h.stock[resource] * 0.15);
      cadet.stock[resource] = share; h.stock[resource] -= share;
    }
    preview.estate.owner = id;
    s.houses.push(cadet);
    // Move the estate's actual reserves into the cadet house; never create troops.
    for (const a of s.armies.filter((a) => a.garrison && a.hex === preview.estate!.id && a.house === h.id)) {
      a.house = id; a.commander = younger.id; a.name = `${cadet.name} garrison`;
    }
  }
  const detail = `${preview.next.name} inherits House ${h.name}${preview.regency ? " under a regency" : ""}. ${preview.opposition.length} houses dispute the succession${preview.estate ? `; ${preview.estate.name} passes to a cadet branch` : ""}.`;
  s.log.unshift(detail);
  event(s, { kind: "succession", house: h.id, person: h.ruler, title: `${preview.next.name} takes the crown`, detail });
}
/** Political upkeep runs once per realm turn; other players' turns do not consume promises. */
export function advanceRealm(s: Campaign, nation?: string) {
  if (!s.strategyRules) return;
  const round = campaignRound(s);
  for (const h of s.houses.filter((h) => !nation || h.nation === nation)) {
    if (h.regent && (ruler(h)?.age ?? 0) >= 16) delete h.regent;
    if (h.liege && !h.rebellion && h.contract) {
      const crown = s.houses.find((v) => v.id === h.liege);
      if (crown) {
        const tax = Math.min(h.treasury, s.districts.filter((d) => d.owner === h.id && !d.occupation).length * h.contract.taxRate * 2);
        h.treasury -= tax; crown.treasury += tax;
      }
    }
    const d = h.demand;
    if (d?.status === "fulfilled" && d.kind === "protect-trade" && d.deadline !== undefined) {
      const blocked = s.routes.some((r) => r.house === h.id && r.status.startsWith("Blockaded"));
      if (blocked || !s.routes.some((r) => r.house === h.id)) {
        d.status = "broken"; h.opinion = clamp(h.opinion - 20); h.contract!.protectedTrade = false;
        event(s, { kind: "politics", house: h.id, other: h.liege ?? undefined, title: "A trade promise is broken", detail: `${h.name} lost protected trade and 20 opinion.` });
      } else if (round > d.deadline) {
        delete d.deadline; h.opinion = clamp(h.opinion + 10);
        event(s, { kind: "politics", house: h.id, other: h.liege ?? undefined, title: "Protected trade promise fulfilled", detail: `${h.name}'s routes stayed open for three rounds: +10 opinion.` });
      }
    }
    if (d?.status === "open" && round - d.since >= 4) h.opinion = clamp(h.opinion - 1);
    h.loyalty = Math.round(h.opinion * 0.55 + h.legitimacy * 0.45);
  }
}
export function growDynasties(s: Campaign) {
  if (!s.strategyRules || s.tick % 120) return;
  const year = Math.floor(s.tick / 120);
  for (const h of s.houses) {
    for (const mother of h.family.filter((p) => p.alive && p.gender === "female" && p.age >= 18 && p.age <= 40 && p.spouse && !p.imprisonedBy)) {
      const father = s.houses.flatMap((v) => v.family).find((p) => p.id === mother.spouse && p.alive && p.gender === "male" && !p.imprisonedBy && p.spouse === mother.id);
      if (!father || year - (mother.lastChildYear ?? -3) < 3 || h.family.filter((p) => p.alive).length >= 12) continue;
      const paternalHouse = s.houses.find((v) => v.family.some((p) => p.id === father.id))!;
      const child: Person = { id: `child-${++s.serial}`, name: `${["Ari", "Rowan", "Sera", "Corin"][s.serial % 4]} ${h.name}`, gender: s.serial % 2 ? "female" : "male", age: 0, alive: true, parents: [mother.id, father.id], claim: h.nation,
        claims: [...new Set([h.nation, paternalHouse.nation, ...(mother.claims ?? []), ...(father.claims ?? [])])] };
      character(child); h.family.push(child); mother.lastChildYear = year;
      event(s, { kind: "succession", house: h.id, person: child.id, title: "A new dynastic heir", detail: `${child.name} is born to ${mother.name} and ${father.name}.` });
    }
  }
}
export function commandBonus(s: Campaign, a: { house: string; commander: string }) {
  const h = s.houses.find((h) => h.id === a.house);
  const p = s.houses.flatMap((h) => h.family).find((p) => p.id === a.commander);
  return s.strategyRules && h ? 1 + ((p?.skills?.command ?? 8) - 8) * 0.01 + (p?.traits?.includes("brave") ? 0.04 : 0) + (councilSkill(s, h, "command") - (ruler(h)?.skills?.command ?? 8)) * 0.01 : 1;
}
