import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import * as m from "motion/react-m";
import { useAuth } from "@/context/AuthContext";
import { ui, useUiLanguage } from "@/i18n/ui";
import { useCopy } from "./copy";
import { useLandingReducedMotion as useReducedMotion } from "./motionPreference";

/** The last stop of the journey: the planet settles in the middle behind one clear invitation. */
export default function ClosingCta() {
  useUiLanguage();
  const text = useCopy();
  const reducedMotion = useReducedMotion();
  const { user } = useAuth();
  return <section id="start" className="closing-cta" data-journey-stop="11" data-tone="chess" data-side="center">
    <m.div initial={reducedMotion ? false : { opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.4 }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}>
      <h2>{text("ctaTitle")}</h2>
      <p>{text("ctaText")}</p>
      <div className="closing-actions">
        <Link to="/games" className="lp-btn lp-btn--primary lp-btn--lg">{text("startPlaying")}<ArrowRight size={18} aria-hidden="true" /></Link>
        <Link to={user ? "/home" : "/login"} className="lp-btn lp-btn--ghost lp-btn--lg">{user ? text("openDashboard") : ui("Log in")}</Link>
      </div>
    </m.div>
  </section>;
}
