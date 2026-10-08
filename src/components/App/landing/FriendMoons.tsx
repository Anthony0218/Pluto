import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { useAnimationFrame, useMotionValue, useSpring, useTransform, type MotionValue } from "motion/react";
import * as m from "motion/react-m";
import { ProfileAvatar } from "@/components/social/ProfileAvatarPicker";
import { useLandingReducedMotion as useReducedMotion } from "./motionPreference";
import { ui, useUiLanguage } from "@/i18n/ui";
import { PlanetArt } from "../planetary/PlanetScene";
import type { PlanetConfig } from "../planetary/planetConfig";
import { useCopy } from "./copy";
import { lerp, orbitPoint } from "./landingMath";

export type MoonFriend = { name: string; avatar: string; online: boolean };

const TILT = (-10 * Math.PI) / 180;
const partyPlanet: PlanetConfig = { id: "friends", label: "", route: "", symbol: "♥", tone: "party", position: "", ring: true };
const SPEED = 0.22; // radians per second for the phase; online friends follow it, offline ones lag behind

function Moon({ friend, index, count, phase, width, height, selected, onSelect, reducedMotion }: {
  friend: MoonFriend; index: number; count: number; phase: MotionValue<number>; width: MotionValue<number>; height: MotionValue<number>;
  selected: boolean; onSelect: (name: string) => void; reducedMotion: boolean;
}) {
  const offset = (index / count) * Math.PI * 2 + 0.7;
  const speed = friend.online ? 1 : 0.35;
  // 0 = orbiting, 1 = pulled to the front of the planet.
  const dock = useSpring(selected ? 1 : 0, { stiffness: 170, damping: 22 });
  useEffect(() => {
    if (reducedMotion) dock.jump(selected ? 1 : 0);
    else dock.set(selected ? 1 : 0);
  }, [selected, reducedMotion, dock]);

  const pose = () => orbitPoint(offset + phase.get() * speed, width.get() * 0.4, height.get() * 0.28, TILT);
  const x = useTransform(() => lerp(pose().x, 0, dock.get()));
  const y = useTransform(() => lerp(pose().y, height.get() * 0.34, dock.get()));
  const scale = useTransform(() => lerp(0.82 + 0.22 * (pose().depth + 1) / 2, 1.3, dock.get()));
  const opacity = useTransform(() => lerp(0.7 + 0.3 * (pose().depth + 1) / 2, 1, dock.get()));
  const zIndex = useTransform(() => { const { depth } = pose(); return dock.get() > 0.1 ? 5 : depth > 0 ? 3 : 1; });

  return <m.button type="button" className="moon" aria-pressed={selected} onClick={() => onSelect(friend.name)} style={{ x, y, scale, opacity, zIndex }}>
    <span className={`moon-avatar ${friend.online ? "moon-avatar--online" : "moon-avatar--offline"}`}><ProfileAvatar avatarId={friend.avatar} className="h-full w-full rounded-full" /></span>
    <strong className="text-xs text-white">{friend.name}</strong>
    <small className={`text-[10px] ${friend.online ? "text-emerald-300" : "text-slate-500"}`}>{ui(friend.online ? "Online" : "Offline")}</small>
  </m.button>;
}

/** Friends circling a planet: online friends orbit faster and glow, picking one pulls it to the front. */
export default function FriendMoons({ friends, selected, onSelect }: { friends: MoonFriend[]; selected: string | null; onSelect: (name: string) => void }) {
  useUiLanguage();
  const text = useCopy();
  const reducedMotion = useReducedMotion();
  const stage = useRef<HTMLDivElement>(null);
  const phase = useMotionValue(0);
  const width = useMotionValue(480);
  const height = useMotionValue(270);
  const paused = useRef(false);

  useEffect(() => {
    const element = stage.current;
    if (!element) return;
    const measure = () => { width.set(element.clientWidth); height.set(element.clientHeight); };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [width, height]);

  // Hovering or focusing the scene holds the orbits still so a moon can be picked without chasing it.
  useAnimationFrame((_, delta) => {
    if (!reducedMotion && !paused.current) phase.set(phase.get() + (Math.min(delta, 64) / 1000) * SPEED);
  });

  return <div className="moons" role="group" aria-label={text("friendsOrbit")}>
    <div ref={stage} className="moons-stage" onPointerEnter={() => { paused.current = true; }} onPointerLeave={() => { paused.current = false; }} onFocusCapture={() => { paused.current = true; }} onBlurCapture={() => { paused.current = false; }}>
      <span className="moons-orbit" aria-hidden="true" style={{ width: "80%", height: "56%" }} />
      <span className="moons-orbit" aria-hidden="true" style={{ width: "58%", height: "38%", opacity: 0.55 }} />
      <div className="moons-planet solar-planet solar-planet--party" aria-hidden="true"><PlanetArt config={partyPlanet} /></div>
      {friends.map((friend, index) => <Moon key={friend.name} friend={friend} index={index} count={friends.length} phase={phase} width={width} height={height} selected={selected === friend.name} onSelect={onSelect} reducedMotion={reducedMotion} />)}
    </div>
    <Link to="/friends" className="moons-invite"><Plus size={16} aria-hidden="true" />{ui("Invite")} {ui("Friends")}</Link>
  </div>;
}
