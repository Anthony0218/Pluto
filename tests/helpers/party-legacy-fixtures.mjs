// Existing tests exercise scoring, items and race-to-target rules. New ready-check and fixed-round
// behavior is tested separately in party-festival-upgrade.test.mjs. Explicitly ready fixture players
// at the old countdown boundary so these tests continue to focus on their original rule contract.
import { DEFAULT_SETTINGS as currentDefaults, MINIGAME_FLOW } from '../../src/games/party/config.ts';
import { advance as engineAdvance, applyAction as engineAction } from '../../src/games/party/engine/engine.ts';
import { readyMinigame, startMinigame as begin } from '../../src/games/party/minigames/flow.ts';
export const DEFAULT_SETTINGS = {...currentDefaults, roundLimit:0};
function prepared(state, random) {
 if (!state.minigame?.awaitingReady || !['MINIGAME_INTRO','DUEL_INTRO'].includes(state.phase)) return state;
 const at = state.minigame.startedAt - MINIGAME_FLOW.countdownMs;
 const original = state.minigame.state;
 let next=state;
 for(const id of state.minigame.participants) if(!next.minigame.readyPlayerIds.includes(id)) next=readyMinigame(next,id,random,at);
 next.minigame.state = original;
 return next;
}
export function advance(state,settings,random,now) { return prepared(engineAdvance(state,settings,random,now),random); }
export function applyAction(state,id,action,settings,random,now) { return prepared(engineAction(state,id,action,settings,random,now),random); }
export function startMinigame(state,id,random,now,registry) { begin(state,id,random,now,registry); Object.assign(state,prepared(state,random)); }
