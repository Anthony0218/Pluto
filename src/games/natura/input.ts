import type { Vec } from './naturaData';
export type PlayerIntent = { x: number; y: number; vertical: number; action: boolean; secondary: boolean; target?: Vec; pattern?: 0|1|2|3|4|5; bumpy?: boolean };
export const IDLE_INTENT = (): PlayerIntent => ({ x: 0, y: 0, vertical: 0, action: false, secondary: false });
export const PLAYER_KEYS = [
  { left:'KeyA',right:'KeyD',up:'KeyW',down:'KeyS',rise:'KeyQ',dive:'KeyE',action:'Space',secondary:'ShiftLeft' },
  { left:'ArrowLeft',right:'ArrowRight',up:'ArrowUp',down:'ArrowDown',rise:'PageUp',dive:'PageDown',action:'Enter',secondary:'ShiftRight' },
] as const;
export const KEY_CODES: readonly string[] = PLAYER_KEYS.flatMap(map=>Object.values(map));
/** Keyboard and touch feed the same key set; simulations consume player intent. */
export function readIntents(keys: Set<string>, target?: Vec): [PlayerIntent, PlayerIntent] {
  return PLAYER_KEYS.map((map,i)=>({x:Number(keys.has(map.right))-Number(keys.has(map.left)),y:Number(keys.has(map.down))-Number(keys.has(map.up)),vertical:Number(keys.has(map.rise))-Number(keys.has(map.dive)),action:keys.has(map.action),secondary:keys.has(map.secondary),target:i===0?target:undefined})) as [PlayerIntent,PlayerIntent];
}
export function intentKeys(inputs: [PlayerIntent,PlayerIntent]): Set<string> {
  const keys=new Set<string>();
  inputs.forEach((input,i)=>{const map=PLAYER_KEYS[i];if(input.x<0)keys.add(map.left);if(input.x>0)keys.add(map.right);if(input.y<0)keys.add(map.up);if(input.y>0)keys.add(map.down);if(input.action)keys.add(map.action);if(input.secondary)keys.add(map.secondary);});
  return keys;
}
