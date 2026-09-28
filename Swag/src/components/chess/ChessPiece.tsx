import { useId } from "react";
import type { PieceTheme } from "@/context/ChessSettingsContext";

type Kind = "p" | "n" | "b" | "r" | "q" | "k";
type ArtTheme = Exclude<PieceTheme, "classic">;

const heads: Record<ArtTheme, Record<Kind, string>> = {
  geometric: {
    k: "M43 5h14l-2 9h10v12H55l-3 11 22 9-12 13H38L26 46l22-9-3-11H35V14h10L43 5Z",
    q: "M50 8 62 23 50 37 38 23 50 8ZM27 35 50 41 73 35 65 57H35L27 35Z",
    b: "M50 12 73 41 62 55H38L27 41 50 12Z",
    n: "M20 59 29 40l17-19 7-9 10 12 12 6 5 22-12 2-12-11-16 12-10 10-10-6Z",
    r: "M23 23h11v10h12V23h8v10h12V23h11v28l-12 9H35l-12-9V23Z",
    p: "M50 25 65 32 69 45 57 55H43L31 45l4-13 15-7Z",
  },
  elegant: {
    k: "M45 5q0-3 5-3t5 3v11h9q5 0 5 5t-5 5h-9v10c12 1 20 8 19 17-1 8-10 12-24 12S27 61 26 53c-1-9 7-16 19-17V26h-9q-5 0-5-5t5-5h9V5Z",
    q: "M27 28a5 5 0 1 1 10 0 5 5 0 0 1-10 0Zm18-12a5 5 0 1 1 10 0 5 5 0 0 1-10 0Zm18 12a5 5 0 1 1 10 0 5 5 0 0 1-10 0ZM29 31l12 12 9-20 9 20 12-12-5 25H34l-5-25Z",
    b: "M50 16a8 8 0 1 0 0 16c-12 7-19 19-15 28 4 8 26 8 30 0 4-9-3-21-15-28a8 8 0 0 0 0-16Z",
    n: "M22 60c1-9 10-18 20-24l5-16 12 3 6 8 12 12c5 6 3 16-4 18l-9-3-8-8c-5 9-13 14-26 15l-8-5Z",
    r: "M25 28h11v9h10v-9h8v9h10v-9h11v25c0 7-10 11-25 11S25 60 25 53V28Z",
    p: "M50 25a15 15 0 1 0 0 30 15 15 0 0 0 0-30Z",
  },
  russian: {
    k: "M45 4h10v10h8v10h-8v8c12 2 19 10 18 20-1 9-10 13-23 13s-22-4-23-13c-1-10 6-18 18-20v-8h-8V14h8V4Z",
    q: "M50 15a6 6 0 1 0 0 12 6 6 0 0 0 0-12ZM27 33l8 8 7-6 8 7 8-7 7 6 8-8-6 25H33l-6-25Z",
    b: "M50 17a7 7 0 1 0 0 14c-12 9-18 20-15 29 4 10 26 10 30 0 3-9-3-20-15-29Z",
    n: "M22 61c0-12 10-22 21-27l4-11 10-3 12 11 9 12c5 8 4 17-3 20l-11-3-7-9c-6 10-14 15-28 16l-7-6Z",
    r: "M23 27h12v11h11V27h8v11h11V27h12v29c0 8-12 12-27 12S23 64 23 56V27Z",
    p: "M50 25a15 15 0 1 0 0 30 15 15 0 0 0 0-30Z",
  },
  jazz: {
    k: "M45 5h10l-2 12h10v10H53l-3 12 23-9-9 28H36l-9-28 23 9-3-12H37V17h10L45 5Z",
    q: "M23 25a5 5 0 1 0 10 0 5 5 0 0 0-10 0Zm22-13a5 5 0 1 0 10 0 5 5 0 0 0-10 0Zm22 13a5 5 0 1 0 10 0 5 5 0 0 0-10 0ZM26 31l17 17 7-28 7 28 17-17-8 27H34l-8-27Z",
    b: "M52 14c12 11 19 22 18 35L59 61H40L29 49c0-13 8-24 23-35Z",
    n: "M18 61 30 42l17-14-4-12 15 9 9 2 14 17-8 14-12-7-12 12-10 5H18Z",
    r: "M22 27h13v10h11V27h8v10h11V27h13l-4 29-15 9H41l-15-9-4-29Z",
    p: "M50 24a16 16 0 1 0 0 32 16 16 0 0 0 0-32Z",
  },
};

const palettes: Record<ArtTheme, { light: [string, string, string]; dark: [string, string, string]; outline: string; darkOutline: string }> = {
  geometric: { light: ["#fff2d4", "#d8bc91", "#927457"], dark: ["#515155", "#28282b", "#090a0b"], outline: "#795e42", darkOutline: "#08090a" },
  elegant: { light: ["#fffdf2", "#f3d9aa", "#bd8b53"], dark: ["#66676a", "#333438", "#121316"], outline: "#604426", darkOutline: "#07080a" },
  russian: { light: ["#fff0bd", "#efbb65", "#a76c2b"], dark: ["#636466", "#2c2d30", "#08090a"], outline: "#82551e", darkOutline: "#060708" },
  jazz: { light: ["#fff9e7", "#f1e3c5", "#c2aa80"], dark: ["#232323", "#0d0d0d", "#010101"], outline: "#101010", darkOutline: "#e9dec7" },
};

export default function ChessPiece({ type, color, theme }: { type: Kind; color: "w" | "b"; theme: ArtTheme }) {
  const id = useId().replace(/:/g, "");
  const white = color === "w";
  const angular = theme === "geometric" || theme === "jazz";
  const palette = white ? palettes[theme].light : palettes[theme].dark;
  const outline = white ? palettes[theme].outline : palettes[theme].darkOutline;
  const sheen = white ? "#fffef1" : theme === "jazz" ? "#f9efd9" : "#a7a8aa";
  const body = angular
    ? "M39 55h22l-7 8 13 20H33l13-20-7-8Z"
    : "M39 55h22c-4 9-5 18 8 28H31c13-10 12-19 8-28Z";
  const base = angular
    ? "M34 79h32l7 7H27l7-7Zm-9 8h50l8 9H17l8-9Z"
    : "M32 77h36l4 7c0 3-9 5-22 5s-22-2-22-5l4-7Zm-5 10h46c6 3 10 6 10 9H17c0-3 4-6 10-9Z";
  return <svg viewBox="0 0 100 100" width="91%" height="91%" preserveAspectRatio="xMidYMid meet" aria-hidden="true" className="overflow-visible drop-shadow-[0_3px_2px_rgba(0,0,0,.55)]">
    <defs>
      <linearGradient id={`${id}-main`} x1="0" x2="1" y1="0" y2=".7"><stop stopColor={palette[0]} /><stop offset=".5" stopColor={palette[1]} /><stop offset="1" stopColor={palette[2]} /></linearGradient>
      <linearGradient id={`${id}-base`} x1="0" x2="1" y1="0" y2="0"><stop stopColor={palette[2]} /><stop offset=".28" stopColor={palette[0]} /><stop offset=".63" stopColor={palette[1]} /><stop offset="1" stopColor={palette[2]} /></linearGradient>
    </defs>
    <g stroke={outline} strokeWidth={theme === "jazz" ? 1.8 : 1.4} strokeLinejoin="round">
      <path d={body} fill={`url(#${id}-main)`} />
      <path d={heads[theme][type]} fill={`url(#${id}-main)`} />
      <path d="M32 58h36l-4 5H36l-4-5Z" fill={`url(#${id}-base)`} />
      <path d={base} fill={`url(#${id}-base)`} />
    </g>
    {angular ? <>
      <path d="M50 60v22H35l11-20 4-2ZM50 89v7H19l7-8 24 1Z" fill={white ? "#fff7e4" : "#77787b"} opacity={theme === "jazz" ? .92 : .55} />
      {theme === "geometric" && <path d="M50 17v39l-16-8 16-31ZM50 17l19 27-19 12V17Z" fill={white ? "#a78a64" : "#0d0e10"} opacity=".46" />}
      {theme === "jazz" && <path d="M41 61c-2 9-8 17-11 21m24-20c-2 8-7 16-18 21m-10 9h50" fill="none" stroke={sheen} strokeWidth="2.5" opacity=".9" />}
    </> : <>
      <path d="M36 80c-5 4 7 7 20 5M42 61c1 8-1 14-6 19" fill="none" stroke={sheen} strokeWidth="2.5" strokeLinecap="round" opacity={white ? .8 : .55} />
      <path d="M25 91c12-4 38-3 50 0" fill="none" stroke={sheen} strokeWidth="2" opacity=".65" />
      {theme === "russian" && <path d="M34 70h32M31 76h38" stroke={sheen} strokeWidth="1.5" opacity=".7" />}
    </>}
    {type === "b" && <path d={theme === "jazz" ? "M62 28 39 51" : "M58 31 43 51"} fill="none" stroke={theme === "jazz" ? sheen : outline} strokeWidth={theme === "jazz" ? 3 : 4} strokeLinecap="round" />}
    {type === "n" && <><circle cx="54" cy="36" r="2.2" fill={theme === "jazz" ? sheen : outline} /><path d="M27 56q8 3 15-2" fill="none" stroke={outline} strokeWidth="1.8" /></>}
    {theme === "jazz" && type !== "n" && type !== "p" && <path d="M50 24 39 55h20L50 24Z" fill={white ? "#111" : "#f8edda"} opacity=".55" />}
    {(type === "q" || type === "k" || type === "r") && !angular && <path d="M34 57c8 3 24 3 32 0" fill="none" stroke={sheen} strokeWidth="2" opacity=".65" />}
  </svg>;
}
