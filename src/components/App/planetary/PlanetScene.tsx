import { Tabs } from "@base-ui/react/tabs";
import { ArrowRight, Binary, BookOpen, Calculator, CalendarClock, ChartLine, ChartNoAxesCombined, CloudSun, CookingPot, Dices, Drum, Dumbbell, Flame, Gift, Gamepad2, Globe, Goal, Grid2X2, Infinity as InfinityIcon, Music4, QrCode, Receipt, Repeat, Ruler, ShieldCheck, Sigma, Spline, Swords, Variable, Waypoints, Wallet } from "lucide-react";
import * as m from "motion/react-m";
import { useId, useRef, type CSSProperties, type ReactNode } from "react";
import { useMotionValueEvent, useTransform } from "motion/react";
import { Link } from "react-router-dom";
import { games } from "@/data/games";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { ui, useUiLanguage } from "@/i18n/ui";
import { heroPlanets, type PlanetConfig } from "./planetConfig";
import { landingBooks, landingTools, universeCategories, type BookDesign, type UniverseCategory } from "./universeCatalog";
import { landingBookTitle, landingCopy } from "./landingCopy";
import { bookDescription } from "../landing/flybyCatalog";
import { useLanding } from "../landing/landingContext";
import { useCopy, type CopyKey } from "../landing/copy";
import { usePlanetLanding } from "../landing/usePlanetLanding";
import "./planetScene.css";
import "./universeScene.css";

export function PlanetArt({ config }: { config: PlanetConfig }) {
  return <span className="solar-art" aria-hidden="true">
    <span className="solar-atmosphere" />
    {config.ring && <span className="solar-ring" />}
    <span className="solar-sphere" />
    <span className="solar-symbol">{config.symbol}</span>
    <span className="solar-detail solar-detail--one" />
    <span className="solar-detail solar-detail--two" />
  </span>;
}

type ItemProps = { id: string; route: string; title: string; className?: string; style?: CSSProperties; children: ReactNode; status?: string; landing?: boolean; blurb?: string; align?: "start" | "center" | "end" };

function UniverseItem({ id, route, title, className = "", style, children, status, landing, blurb, align = "center" }: ItemProps) {
  const reducedMotion = useReducedMotion();
  const land = usePlanetLanding();
  const cardId = useId();
  return <m.div className={`universe-object ${className}`} style={style} data-flyby-id={id} whileHover="hover" whileTap="press">
    <Link to={route} className="universe-item" aria-describedby={blurb ? cardId : undefined} aria-label={`${ui("Open")} ${ui(title)}${status ? ` · ${ui(status)}` : ""}`} onClick={landing ? event => land(event, route) : undefined}>
      <m.span className="universe-art-wrap" variants={reducedMotion ? {} : { hover: { y: -4, scale: 1.035 }, press: { y: 0, scale: .98 } }} transition={{ type: "spring", stiffness: 420, damping: 30 }}>
        {children}
      </m.span>
      <strong className="universe-label">{ui(title)}</strong>
      {status && <span className="universe-status">{ui(status)}</span>}
    </Link>
    {blurb && <span id={cardId} role="tooltip" className={`universe-card universe-card--${align}`}>{blurb}</span>}
  </m.div>;
}

const toolIcons = {
  "percentage-calculator": Calculator, "number-system-converter": Binary, "unit-converter": Ruler, "recipe-scaler": CookingPot,
  "workout-timer": Dumbbell, "bill-splitter": Receipt, "time-zone-planner": Globe, "function-plotter": ChartLine, "budget-tracker": Wallet,
  "subscription-tracker": Repeat, "calorie-tracker": Flame, "weather-explorer": CloudSun, "day-planner": CalendarClock, "qr-code-creator": QrCode, "birthday-reminders": Gift,
};

export function AppTileArt({ toolId }: { toolId: string }) {
  const Icon = toolIcons[toolId as keyof typeof toolIcons] ?? Grid2X2;
  return <span className={`universe-app universe-app--${toolId}`} aria-hidden="true"><span className="universe-app-shine" /><Icon size={36} strokeWidth={1.6} /></span>;
}
const categoryIcons = { games: Gamepad2, tools: Grid2X2, learn: BookOpen };
const bookIcons = {
  math: Sigma, percentages: Calculator, guides: ShieldCheck, analysis: ChartNoAxesCombined,
  algebra: Variable, calculus: Spline, linear: Waypoints, depth: InfinityIcon, chance: Dices,
  pitch: Music4, rhythm: Drum, rules: Goal, tactics: Swords,
};

export function BookArt({ title, design }: { title: string; design: BookDesign }) {
  const Icon = bookIcons[design];
  return <span className={`universe-book universe-book--${design}`} aria-hidden="true">
    <span className="universe-book-pages" />
    <span className="universe-book-cover">
      <span className="universe-book-imprint">PLUTO</span>
      <span className="universe-book-illustration"><Icon size={35} strokeWidth={1.35} />{design === "percentages" && <span className="universe-book-percent">%</span>}</span>
      <span className="universe-book-title">{ui(title)}</span>
      <span className="universe-book-rule" />
    </span>
    <span className="universe-book-spine" />
  </span>;
}

const planetBlurbs: Record<string, CopyKey> = {
  "/games/chess": "blurbChess", "/games/go": "blurbGo", "/games/watten": "blurbWatten", "/games/schafkopf": "blurbSchafkopf",
  "/games/atlas-arena": "blurbAtlas", "/games/natura": "blurbNatura", "/games/eat-it": "blurbEatIt",
};
const planetAlign: Record<string, "start" | "end"> = { schafkopf: "start", watten: "end", go: "end", atlas: "start" };

export default function PlanetScene({ category, onCategoryChange }: { category: UniverseCategory; onCategoryChange: (category: UniverseCategory) => void }) {
  const { language } = useUiLanguage();
  const text = useCopy();
  const reducedMotion = useReducedMotion();
  const { handoff } = useLanding();
  const root = useRef<HTMLDivElement>(null);
  // As the page scrolls toward the flyby, the hero objects hand over to their flyby twins and fade out.
  const handOver = useTransform(() => 1 - handoff.get());
  useMotionValueEvent(handOver, "change", value => {
    root.current?.style.setProperty("--hero-fade", String(value));
    root.current?.style.setProperty("--hero-events", value < 0.5 ? "none" : "auto");
  });
  const selected = universeCategories.find(item => item.id === category)!;
  return <Tabs.Root ref={root} className="landing-universe" value={category} onValueChange={value => {
    if (value === "games" || value === "tools" || value === "learn") onCategoryChange(value);
  }} data-category={category}>
    <div className="universe-background universe-background--games" aria-hidden="true" />
    <div className="universe-background universe-background--tools" aria-hidden="true" />
    <div className="universe-background universe-background--learn" aria-hidden="true" />
    <div className="universe-header">
      <Tabs.List className="universe-tabs" aria-label={ui("Explore")} activateOnFocus>
        {universeCategories.map(item => {
          const Icon = categoryIcons[item.id];
          return <Tabs.Tab key={item.id} value={item.id} className="universe-tab"><Icon size={16} aria-hidden="true" />{ui(item.label)}</Tabs.Tab>;
        })}
        <Tabs.Indicator className="universe-tab-indicator" />
      </Tabs.List>
      <p className="universe-caption">{landingCopy(language, category)}</p>
    </div>
    <div className="universe-stage">
      <div className="solar-stars" aria-hidden="true" />
      <div className="solar-orbits" aria-hidden="true" />
      {universeCategories.map(item => <Tabs.Panel key={item.id} value={item.id} className="universe-panel" aria-hidden={category !== item.id}>
        <m.div className={`universe-grid universe-grid--${item.id}`} initial={reducedMotion ? false : { opacity: .25, y: 8, scale: .985 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: reducedMotion ? 0 : .22, ease: [.22, 1, .36, 1] }}>
          {item.id === "games" && heroPlanets.map(config => {
            const game = games.find(game => game.route === config.route);
            return <UniverseItem key={config.id} id={config.id} title={config.label} route={config.route} blurb={planetBlurbs[config.route] ? text(planetBlurbs[config.route]) : undefined} align={planetAlign[config.position] ?? "center"} className={`solar-planet solar-planet--${config.tone} solar-position--${config.position}${config.primary ? " solar-planet--primary" : ""}`} status={game && !game.finished ? "In progress" : undefined} landing>
              <PlanetArt config={config} />
            </UniverseItem>;
          })}
          {item.id === "tools" && landingTools.map((tool, index) => <UniverseItem key={tool.id} id={tool.id} title={tool.title} route={tool.route} blurb={ui(tool.description)} align={index % 2 ? "end" : "start"} style={{ "--app-accent": tool.accent } as CSSProperties}>
            <AppTileArt toolId={tool.id} />
          </UniverseItem>)}
          {item.id === "learn" && landingBooks.map((book, index) => <UniverseItem key={book.id} id={book.id} title={book.title} route={book.route} blurb={ui(bookDescription(book.id))} align={index % 2 ? "end" : "start"}>
            <BookArt title={landingBookTitle(language, book.design)} design={book.design} />
          </UniverseItem>)}
        </m.div>
      </Tabs.Panel>)}
    </div>
    <div className="universe-footer"><span className="universe-brand" aria-hidden="true">PLUTO<span className="universe-brand-orbit" /></span><Link to={selected.route}>{ui(selected.browse)}<ArrowRight size={15} aria-hidden="true" /></Link></div>
  </Tabs.Root>;
}
