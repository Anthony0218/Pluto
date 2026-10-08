import type { Army, Campaign, District, House } from "../../../games/MedievalKingdoms/edravane/types.ts";
import { canControl } from "../../../games/MedievalKingdoms/edravane/simulation.ts";

export function territoryControl(state: Campaign, player: House, district: District) {
  const owner = state.houses.find((h) => h.id === (district.occupation ?? district.owner));
  return !owner ? "unclaimed" : owner.id === player.id ? "domain" : owner.liege === player.id && !owner.rebellion ? "vassal" : "foreign";
}

export function armyControl(state: Campaign, player: House, army: Army) {
  const owner = state.houses.find((h) => h.id === army.house);
  if (army.rebel || owner && state.wars.includes([player.nation, owner.nation].sort().join("|"))) return "hostile";
  if (army.pledgedTo === player.id && (army.serviceUntil ?? 0) > state.tick && army.delay > 0) return "awaiting";
  if (canControl(state, { house: player.id }, army)) return army.house === player.id ? "own" : "pledged";
  return owner?.liege === player.id && !owner.rebellion ? "vassal" : "foreign";
}

export const CONTROL_LABELS = {
  own: "Your host · direct orders", pledged: "Pledged contingent · temporary command",
  awaiting: "Pledged contingent · awaiting arrival",
  vassal: "Vassal host · request a task", foreign: "Foreign host · no command", hostile: "Hostile host · no command",
};
