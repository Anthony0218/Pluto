import { useCallback, useEffect, useRef, type RefObject } from "react";
import { CIRCLE_SHOT_WINDOW, type CircleShotView } from "../../../../games/party/minigames/circleShot/index.ts";
import { COLORS } from "../../../../games/party/config.ts";
import type { MinigameViewProps } from "./views.ts";
import { useServerClock, useServerOffset } from "./useServerClock.ts";

const estimatedTime = (offset: RefObject<number | null>) => Date.now() + (offset.current ?? 0);

export default function CircleShotScreen({ minigame, match, playerId, online, sendInput }: MinigameViewProps) {
  const state = minigame.state as CircleShotView, live = useRef(state);
  const offset = useServerOffset(minigame.serverNow), time = useServerClock(minigame.serverNow, 50);
  const circles = useRef(new Map<string, SVGCircleElement>()), guns = useRef(new Map<string, SVGGElement>());
  const fired = useRef(-1);
  useEffect(() => { live.current = state; }, [state]);
  const shoot = useCallback(() => {
    const s = live.current, circle = s.players[playerId]?.circle, at = estimatedTime(offset);
    if (!online || !circle || fired.current === circle.id || at < s.startedAt || at >= s.endsAt || at >= circle.at + CIRCLE_SHOT_WINDOW) return;
    fired.current = circle.id;
    guns.current.get(playerId)?.animate([{ transform: "translateY(0)" }, { transform: "translateY(7px)" }, { transform: "translateY(0)" }], { duration: 180 });
    sendInput({ type: "CIRCLE_SHOOT", circleId: circle.id });
  }, [online, playerId, offset, sendInput]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      e.preventDefault(); if (!e.repeat) shoot();
    };
    window.addEventListener("keydown", key); return () => window.removeEventListener("keydown", key);
  }, [shoot]);
  useEffect(() => {
    let frame: number;
    const draw = () => {
      const at = Date.now() + (offset.current ?? 0);
      for (const [id, p] of Object.entries(live.current.players)) {
        const node = circles.current.get(id); if (!node) continue;
        // Equal radius 28 circles: exactly one diameter travels in the scoring window.
        node.setAttribute("cy", String(215 + ((at - (p.circle?.at ?? at)) / CIRCLE_SHOT_WINDOW) * 56));
        node.style.opacity = !p.circle || at >= p.circle.at + CIRCLE_SHOT_WINDOW || (id === playerId && fired.current === p.circle.id) ? "0" : "1";
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw); return () => cancelAnimationFrame(frame);
  }, [offset, playerId]);
  return <div className="quickshot-game new-minigame">
    <header className="new-game-header"><div><span className="pp-eyebrow">FOUR PLAYERS · ONE SHOT PER CIRCLE</span><h2>Circle Quickshot</h2></div><strong>{Math.max(0, Math.ceil((state.endsAt - time) / 1000))}s</strong></header>
    <div className="quickshot-quadrants">
      {match.players.filter((p) => state.players[p.id]).map((player) => {
        const p = state.players[player.id], mine = player.id === playerId, color = COLORS[player.avatarId % COLORS.length];
        const last = p.last && time - p.last.at < 1100 ? p.last : null;
        const value = p.circle?.value ?? 1, ink = value === 5 ? "#c8a5ff" : value === 3 ? "#ffd478" : "#d5f8ff";
        return <section key={player.id} className={"quickshot-seat" + (mine ? " is-you" : "")} style={{ borderColor: color }}>
          <div className="quickshot-player"><span><i style={{ background: color }}/>{player.name}{mine ? " · YOU" : ""}</span><b>{p.score.toFixed(2)}</b></div>
          <svg viewBox="0 0 240 290" aria-label={`${player.name}'s falling circle and target`} onPointerDown={mine ? (e) => { e.preventDefault(); shoot(); } : undefined}>
            <defs><linearGradient id={`shot-bg-${player.id}`} x2="0" y2="1"><stop stopColor="#1b304e"/><stop offset="1" stopColor="#0a1426"/></linearGradient></defs>
            <rect width="240" height="290" rx="15" fill={`url(#shot-bg-${player.id})`}/>
            {[80, 120, 160].map((y) => <path key={y} d={`M105 ${y} L120 ${y + 10} L135 ${y}`} fill="none" stroke="#a9ccef" strokeOpacity=".12" strokeWidth="2"/>)}
            <path d="M120 45 V245" stroke={color} strokeDasharray="3 9" opacity=".3"/>
            <circle cx="120" cy="215" r="28" fill={color} fillOpacity=".08" stroke={color} strokeWidth="3"/>
            <circle cx="120" cy="215" r="34" fill="none" stroke={color} opacity=".2"/>
            <circle ref={(el) => { if (el) circles.current.set(player.id, el); else circles.current.delete(player.id); }} cx="120" cy="47" r="28" fill={ink} fillOpacity=".45" stroke={ink} strokeWidth="2" style={{ opacity: p.circle ? 1 : 0 }}/>
            <text x="205" y="35" textAnchor="middle" fill={ink} fontSize="18" fontWeight="800">×{value}</text>
            <g ref={(el) => { if (el) guns.current.set(player.id, el); else guns.current.delete(player.id); }}>
              <path d="M108 290 L111 269 L116 266 L116 250 L124 250 L124 266 L129 269 L132 290Z" fill="#344962" stroke={color} strokeWidth="2"/>
              <rect x="118" y="252" width="4" height="15" rx="1" fill={color}/><path d="M113 279 H127" stroke="#c2d5ea" strokeWidth="3"/>
            </g>
            <text x="120" y="20" textAnchor="middle" fill="#a9bfd8" fontSize="10">{p.circle ? "TIME YOUR SHOT" : "NEXT CIRCLE INCOMING"}</text>
          </svg>
          <div className="quickshot-judgement" aria-live={mine ? "polite" : "off"}>{last ? <><b>{Math.round(last.overlap * 100)}%</b><span> × {last.value} = +{last.points.toFixed(2)}</span></> : <span>Overlap × value</span>}</div>
        </section>;
      })}
    </div>
    <button className="pp-btn primary quickshot-fire" disabled={!online || !state.players[playerId]?.circle || time >= state.endsAt} onPointerDown={(e) => { e.preventDefault(); shoot(); }} onClick={(e) => { if (e.detail === 0) shoot(); }}>FIRE <span>Click / Space / tap</span></button>
    <p className="new-game-tip">80% overlap × 3 = 2.4 points · white 1 · gold 3 · violet 5</p>
  </div>;
}
