import { ArrowRight, House } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { ui, useUiLanguage } from "@/i18n/ui";
import "./landing/landingHero.css";
import PlanetScene from "./planetary/PlanetScene";
import { universeCategories } from "./planetary/universeCatalog";
import { useLanding } from "./landing/landingContext";
import { useCopy } from "./landing/copy";
import ReturningStrip from "./landing/ReturningStrip";
import { landingCopy } from "./planetary/landingCopy";

export default function LandingHero() {
  const { language } = useUiLanguage();
  const text = useCopy();
  const { user } = useAuth();
  const { category, setCategory } = useLanding();
  const selected = universeCategories.find(item => item.id === category)!;
  const homeButton = <Link to="/home" aria-label={ui("Home")} title={ui("Home")} className="lp-btn lp-btn--ghost lp-btn--lg lp-btn--icon"><House size={19} aria-hidden="true" /></Link>;
  return <section className="relative overflow-hidden border-b border-white/10 bg-[#080d1c] text-white">
    <div className="hero-sky" aria-hidden="true">
      <div className="hero-sky-glow" />
      <div className="hero-sky-drift" />
      <div className="hero-sky-twinkle" />
      <div className="hero-sky-twinkle hero-sky-twinkle--b" />
    </div>
    <div className="relative mx-auto grid min-h-[680px] max-w-[1700px] items-center gap-6 px-5 py-12 sm:px-8 lg:grid-cols-[minmax(0,.68fr)_minmax(0,1.32fr)] lg:gap-8 lg:px-10">
      {/* Pinned to the height of the Games panel, so the headline sits in the same place whichever tab is open (the Tools and Learn panels are taller). */}
      <div className="max-w-xl lg:flex lg:min-h-[637px] lg:flex-col lg:justify-center lg:self-start lg:pr-3">
        <p className="lp-pill"><span className="lp-pill-dot" aria-hidden="true" />{text("heroStats").replace("{games}", String(universeCategories[0].count)).replace("{tools}", String(universeCategories[1].count)).replace("{paths}", String(universeCategories[2].count))}</p>
        <h1 className="mt-5 text-5xl font-black leading-[0.96] tracking-[-0.04em] sm:text-6xl xl:text-[78px]">{ui("Play.")}<br />{ui("Learn.")}<br /><span className="bg-gradient-to-r from-sky-300 via-indigo-300 to-violet-400 bg-clip-text text-transparent">{ui("Improve.")}</span></h1>
        <p className="mt-7 max-w-md text-base leading-7 text-zinc-300">{text("heroSub")}</p>
        <div className="lp-actions lp-actions--hero mt-8">
          <Link to={selected.route} className="lp-btn lp-btn--primary lp-btn--lg">{category === "tools" ? landingCopy(language, "exploreTools") : ui(selected.action)}<ArrowRight size={18} aria-hidden="true" /></Link>
          {/* Guests: Log in, then Home. Signed in: Home, then Dashboard. */}
          {user && homeButton}
          <Link to={user ? "/dashboard" : "/login"} className="lp-btn lp-btn--ghost lp-btn--lg">{user ? ui("Dashboard") : ui("Log in")}</Link>
          {!user && homeButton}
        </div>
        <ReturningStrip />
      </div>
      <PlanetScene category={category} onCategoryChange={setCategory} />
    </div>
  </section>;
}
