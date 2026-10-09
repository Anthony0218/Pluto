import { useCallback, useEffect, useRef } from 'react';
import type { MinigameInput } from '../../../../games/party/types.ts';
import type { Point } from '../../../../games/party/minigames/arcadeAdditions/common.ts';

export function useArcadeControls(active: boolean, sendInput: (input: MinigameInput) => void, pawn?: Point) {
  const held = useRef(new Set<string>()), aim = useRef({ x: 1, y: 0 }), send = useRef(sendInput), position = useRef(pawn), enabled = useRef(active);
  useEffect(() => { send.current = sendInput; position.current = pawn; enabled.current = active; }, [sendInput, pawn, active]);
  const publish = useCallback(() => { if (!enabled.current) return; const k = held.current; send.current({ type: 'ARCADE_CONTROL', x: Number(k.has('KeyD') || k.has('ArrowRight')) - Number(k.has('KeyA') || k.has('ArrowLeft')), y: Number(k.has('KeyS') || k.has('ArrowDown')) - Number(k.has('KeyW') || k.has('ArrowUp')), aimX: aim.current.x, aimY: aim.current.y, action: k.has('Space'), fire: k.has('KeyF') || k.has('MouseFire') }); }, []);
  const change = useCallback((key: string, pressed: boolean) => { if (pressed) held.current.add(key); else held.current.delete(key); publish(); }, [publish]);
  const aimAt = useCallback((x: number, y: number) => { const p = position.current; if (!p) return; const dx = x - p.x, dy = y - p.y, length = Math.hypot(dx, dy); if (length > .01) aim.current = { x: dx / length, y: dy / length }; }, []);
  const aimDirection = useCallback((x: number, y: number) => { aim.current = { x, y }; publish(); }, [publish]);
  useEffect(() => {
    const keys = held.current, controls = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight', 'Space', 'KeyF']);
    const down = (e: KeyboardEvent) => { if (!enabled.current || !controls.has(e.code) || e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return; e.preventDefault(); if (e.repeat) return; keys.add(e.code); publish(); };
    const up = (e: KeyboardEvent) => { if (keys.delete(e.code)) publish(); }, release = () => { keys.clear(); publish(); };
    const visibility = () => { if (document.hidden) release(); };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('blur', release); document.addEventListener('visibilitychange', visibility);
    const timer = setInterval(publish, 100);
    return () => { release(); clearInterval(timer); window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', release); document.removeEventListener('visibilitychange', visibility); };
  }, [publish]);
  useEffect(() => { if (!active) held.current.clear(); }, [active]);
  return { change, aimAt, aimDirection };
}
