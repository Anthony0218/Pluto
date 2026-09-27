import { useEffect, useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { Link } from "react-router-dom";
import { ui, useUiLanguage } from "@/i18n/ui";
import { games } from "@/data/games";
import { discoverySlides } from "@/data/dashboard";

export default function DidYouKnowCarousel() {
  useUiLanguage();
  const [index, setIndex] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let timer: number | undefined;
    const schedule = () => {
      window.clearInterval(timer);
      if (!motion.matches && !hovered && !focused && !paused && document.visibilityState === "visible") timer = window.setInterval(() => setIndex(current => (current + 1) % discoverySlides.length), 11_000);
    };
    schedule();
    motion.addEventListener("change", schedule);
    document.addEventListener("visibilitychange", schedule);
    return () => { window.clearInterval(timer); motion.removeEventListener("change", schedule); document.removeEventListener("visibilitychange", schedule); };
  }, [hovered, focused, paused]);
  return <section className="discovery-carousel" aria-label={ui("Did you know?")} aria-roledescription={ui("Carousel")} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onFocusCapture={() => setFocused(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}>
    {discoverySlides.map((slide, slideIndex) => <div key={slide.title} className={`discovery-slide ${index === slideIndex ? "active" : ""}`} inert={index !== slideIndex} aria-hidden={index !== slideIndex}>
      <img src={games.find(game => game.route === slide.gameRoute)?.image} alt="" />
      <div className="discovery-copy"><p className="dash-eyebrow">{ui("Did you know?")}</p><h2>{ui(slide.title)}</h2><p>{ui(slide.description)}</p><Link to={slide.route} className="dash-button primary">{ui("Learn more")}<ArrowRight size={15} /></Link></div>
    </div>)}
    <div className="discovery-controls"><div className="flex items-center gap-1">{discoverySlides.map((slide, slideIndex) => <button key={slide.title} className="carousel-dot" aria-label={ui("Show fact") + ": " + ui(slide.title)} aria-current={index === slideIndex ? "true" : undefined} onClick={() => setIndex(slideIndex)}><span /></button>)}<span className="ml-2 text-xs tabular-nums text-indigo-200">{String(index + 1).padStart(2, "0")} / {String(discoverySlides.length).padStart(2, "0")}</span></div><div className="flex gap-2"><button className="dash-icon-button" onClick={() => setPaused(!paused)} aria-label={ui(paused ? "Resume slideshow" : "Pause slideshow")} aria-pressed={paused}>{paused ? <Play size={15} /> : <Pause size={15} />}</button><button className="dash-icon-button" aria-label={ui("Previous fact")} onClick={() => setIndex((index - 1 + discoverySlides.length) % discoverySlides.length)}><ChevronLeft size={19} /></button><button className="dash-icon-button" aria-label={ui("Next fact")} onClick={() => setIndex((index + 1) % discoverySlides.length)}><ChevronRight size={19} /></button></div></div>
  </section>;
}
