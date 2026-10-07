/* Activity level and the avatar border it earns. The level is the one shown on
   the profile: 100 XP per completed game, 50 XP per completed puzzle, 1,000 XP
   per level. get_public_profile computes the same number for other players. */

export const XP_PER_LEVEL = 1000;

export const activityXp = (gamesPlayed: number, puzzles: number | null) =>
  Math.max(0, gamesPlayed) * 100 + Math.max(0, puzzles ?? 0) * 50;

export const activityLevel = (xp: number) => Math.floor(Math.max(0, xp) / XP_PER_LEVEL) + 1;

export type AvatarFrame = {
  id: "bronze" | "silver" | "gold";
  name: string;
  level: number;
  /** One representative colour, for small markers and text. */
  color: string;
  /** The metal itself, as a CSS gradient. */
  metal: string;
  glow: string;
};

export const AVATAR_FRAMES: readonly AvatarFrame[] = [
  { id: "bronze", name: "Bronze", level: 10, color: "#d08a4e", metal: "linear-gradient(135deg,#f0b27a,#a85f24 38%,#6e3b12 62%,#e09a5b)", glow: "rgba(208,138,78,.45)" },
  { id: "silver", name: "Silver", level: 20, color: "#cbd5e1", metal: "linear-gradient(135deg,#f8fafc,#a8b3c2 38%,#64748b 62%,#e2e8f0)", glow: "rgba(203,213,225,.45)" },
  { id: "gold", name: "Gold", level: 30, color: "#facc15", metal: "linear-gradient(135deg,#fef08a,#eab308 38%,#a16207 62%,#fde047)", glow: "rgba(250,204,21,.5)" },
];

/** The best border this level has earned, or null below level 10. */
export const avatarFrameFor = (level: number): AvatarFrame | null =>
  [...AVATAR_FRAMES].reverse().find((frame) => level >= frame.level) ?? null;

/** The next border still to earn, or null once gold is reached. */
export const nextAvatarFrame = (level: number): AvatarFrame | null =>
  AVATAR_FRAMES.find((frame) => level < frame.level) ?? null;

/** Border, background and glow for an avatar holder whose own fill is `fill`. */
export function avatarFrameStyle(frame: AvatarFrame | null, fill: string) {
  if (!frame) return undefined;
  return {
    border: "3px solid transparent",
    background: `linear-gradient(${fill},${fill}) padding-box, ${frame.metal} border-box`,
    boxShadow: `0 0 24px ${frame.glow}`,
  };
}
