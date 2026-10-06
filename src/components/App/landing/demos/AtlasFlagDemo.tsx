import { useEffect, useMemo, useRef, useState } from "react";
import { Flame } from "lucide-react";
import { ui, useUiLanguage } from "@/i18n/ui";
import { useCopy } from "../copy";
import { useInView } from "../useInView";
import DemoFrame from "./DemoFrame";

// Flags are the real bundled SVGs from /flags/4x3; country names come from the browser's own region names.
const countries = ["de", "fr", "jp", "br", "ca", "in", "za", "au", "es", "it", "mx", "kr", "eg", "ar", "se", "no", "ke", "nz", "ch", "gr"];
const SECONDS = 9;
type Question = { id: number; answer: string; options: string[] };

function makeQuestion(id: number, previous?: string): Question {
  const pool = countries.filter(code => code !== previous);
  const answer = pool[Math.floor(Math.random() * pool.length)];
  const options = [answer, ...countries.filter(code => code !== answer).sort(() => Math.random() - 0.5).slice(0, 3)].sort(() => Math.random() - 0.5);
  return { id, answer, options };
}

/** Guess the country behind the flag against the clock: the Atlas Arena flag drill in miniature. */
export default function AtlasFlagDemo() {
  const { language } = useUiLanguage();
  const text = useCopy();
  const [question, setQuestion] = useState(() => makeQuestion(0));
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [best, setBest] = useState(0);
  const frame = useRef<HTMLDivElement>(null);
  const visible = useInView(frame);
  const names = useMemo(() => new Intl.DisplayNames([language === "bar" ? "de" : language], { type: "region" }), [language]);
  const name = (code: string) => names.of(code.toUpperCase()) ?? code.toUpperCase();

  const settle = (choice: string) => {
    if (picked !== null) return;
    setPicked(choice);
    if (choice === question.answer) { setScore(value => value + 1); setStreak(value => { setBest(top => Math.max(top, value + 1)); return value + 1; }); }
    else setStreak(0);
  };

  // Out of time counts as a miss; after every answer the next flag arrives.
  useEffect(() => {
    if (picked === null && visible) {
      const timer = window.setTimeout(() => { setPicked(""); setStreak(0); }, SECONDS * 1000);
      return () => window.clearTimeout(timer);
    }
    if (picked !== null) {
      const timer = window.setTimeout(() => { setQuestion(current => makeQuestion(current.id + 1, current.answer)); setPicked(null); }, 1100);
      return () => window.clearTimeout(timer);
    }
  }, [picked, visible, question.id]);

  return <DemoFrame tone="atlas" title={ui("Atlas Arena")} href="/games/atlas-arena" action={text("playAtlas")}>
    <div ref={frame} className="atlas-demo">
      <div className="atlas-stats" aria-live="polite"><span>{text("scoreLabel")} <b>{score}</b></span><span><Flame size={14} aria-hidden="true" />{text("streakLabel")} <b>{streak}</b></span><span>{text("bestLabel")} <b>{best}</b></span></div>
      <div className="atlas-timer" aria-hidden="true"><i key={question.id} style={{ animationDuration: `${SECONDS}s`, animationPlayState: picked === null && visible ? "running" : "paused" }} /></div>
      <p className="demo-eyebrow">{text("whichCountry")}</p>
      <img key={question.id} className="atlas-flag" src={`/flags/4x3/${question.answer}.svg`} alt="" />
      <div className="atlas-options">
        {question.options.map(code => {
          const state = picked === null ? "" : code === question.answer ? " is-right" : code === picked ? " is-wrong" : "";
          return <button key={code} type="button" className={`atlas-option${state}`} disabled={picked !== null} onClick={() => settle(code)}>{name(code)}</button>;
        })}
      </div>
    </div>
  </DemoFrame>;
}
