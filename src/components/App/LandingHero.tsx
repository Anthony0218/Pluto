import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { ui, useUiLanguage } from "@/i18n/ui";
import PlanetScene from "./planetary/PlanetScene";

export default function LandingHero() {
  useUiLanguage();
  return <section className="relative overflow-hidden border-b border-white/10 bg-[#080d1c] text-white">
    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_72%_35%,rgba(75,85,190,.17),transparent_52%)]" />
    <div className="relative mx-auto grid min-h-[680px] max-w-[1700px] items-center gap-6 px-5 py-12 sm:px-8 lg:grid-cols-[minmax(0,.68fr)_minmax(0,1.32fr)] lg:gap-8 lg:px-10">
      <div className="max-w-xl lg:pr-3">
        <p className="text-xs font-bold uppercase tracking-[0.32em] text-indigo-300">{ui("Games + Learning")}</p>
        <h1 className="mt-5 text-5xl font-black leading-[0.96] tracking-[-0.055em] sm:text-6xl xl:text-[78px]">{ui("Play.")}<br />{ui("Learn.")}<br /><span className="bg-gradient-to-r from-sky-300 via-indigo-300 to-violet-400 bg-clip-text text-transparent">{ui("Improve.")}</span></h1>
        <p className="mt-7 max-w-lg text-base leading-7 text-zinc-400">{ui("Play games, learn new skills and use powerful tools to understand how you can get better.")}</p>
        <Link to="/dashboard" className="mt-8 inline-flex min-h-12 items-center gap-4 rounded-xl bg-indigo-500 px-6 py-3 font-bold text-white transition hover:bg-indigo-400 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-300">{ui("HOME")}<ArrowRight size={18} /></Link>
      </div>
      <PlanetScene />
    </div>
  </section>;
}
