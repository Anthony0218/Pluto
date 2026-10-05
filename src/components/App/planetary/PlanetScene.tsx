import { Tabs } from "@base-ui/react/tabs";
import { ArrowRight, Binary, BookOpen, Calculator, ChartNoAxesCombined, CookingPot, Gamepad2, Grid2X2, Ruler, ShieldCheck, Sigma } from "lucide-react";
import * as m from "motion/react-m";
import type { CSSProperties, ReactNode } from "react";
import { Link } from "react-router-dom";
import { games } from "@/data/games";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { ui, useUiLanguage } from "@/i18n/ui";
import { planets, type PlanetConfig } from "./planetConfig";
import { universeBooks, universeCategories, universeTools, type BookDesign, type UniverseCategory } from "./universeCatalog";
import { landingBookTitle, landingCopy } from "./landingCopy";
import "./planetScene.css";
import "./universeScene.css";

function PlanetArt({ config }: { config: PlanetConfig }) {
  return <span className="solar-art" aria-hidden="true">
    <span className="solar-atmosphere" />
    {config.ring && <span className="solar-ring" />}
    <span className="solar-sphere" />
    <span className="solar-symbol">{config.symbol}</span>
    <span className="solar-detail solar-detail--one" />
    <span className="solar-detail solar-detail--two" />
  </span>;
}

function UniverseItem({ route, title, className = "", style, children, status }: { route: string; title: string; className?: string; style?: CSSProperties; children: ReactNode; status?: string }) {
  const reducedMotion = useReducedMotion();
  return <m.div className={`universe-object ${className}`} style={style} whileHover="hover" whileTap="press">
    <Link to={route} className="universe-item" aria-label={`${ui("Open")} ${ui(title)}${status ? ` · ${ui(status)}` : ""}`}>
      <m.span className="universe-art-wrap" variants={reducedMotion ? {} : { hover: { y: -4, scale: 1.035 }, press: { y: 0, scale: .98 } }} transition={{ type: "spring", stiffness: 420, damping: 30 }}>
        {children}
      </m.span>
      <strong className="universe-label">{ui(title)}</strong>
      {status && <span className="universe-status">{ui(status)}</span>}
    </Link>
  </m.div>;
}

const toolIcons = { "percentage-calculator": Calculator, "number-system-converter": Binary, "unit-converter": Ruler, "recipe-scaler": CookingPot };
const categoryIcons = { games: Gamepad2, tools: Grid2X2, learn: BookOpen };
const bookIcons = { math: Sigma, percentages: Calculator, guides: ShieldCheck, analysis: ChartNoAxesCombined };

function BookArt({ title, design }: { title: string; design: BookDesign }) {
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

export default function PlanetScene({ category, onCategoryChange }: { category: UniverseCategory; onCategoryChange: (category: UniverseCategory) => void }) {
  const { language } = useUiLanguage();
  const reducedMotion = useReducedMotion();
  const selected = universeCategories.find(item => item.id === category)!;
  return <Tabs.Root className="landing-universe" value={category} onValueChange={value => {
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
          {item.id === "games" && planets.map(config => {
            const game = games.find(game => game.route === config.route);
            return <UniverseItem key={config.id} title={config.label} route={config.route} className={`solar-planet solar-planet--${config.tone} solar-position--${config.position}${config.primary ? " solar-planet--primary" : ""}`} status={game && !game.finished ? "In progress" : undefined}>
              <PlanetArt config={config} />
            </UniverseItem>;
          })}
          {item.id === "tools" && universeTools.map(tool => {
            const Icon = toolIcons[tool.id as keyof typeof toolIcons] ?? Grid2X2;
            return <UniverseItem key={tool.id} title={tool.title} route={tool.route} style={{ "--app-accent": tool.accent } as CSSProperties}>
              <span className={`universe-app universe-app--${tool.id}`} aria-hidden="true"><span className="universe-app-shine" /><Icon size={36} strokeWidth={1.6} /></span>
            </UniverseItem>;
          })}
          {item.id === "learn" && universeBooks.map(book => <UniverseItem key={book.id} title={book.title} route={book.route}>
            <BookArt title={landingBookTitle(language, book.design)} design={book.design} />
          </UniverseItem>)}
        </m.div>
      </Tabs.Panel>)}
    </div>
    <div className="universe-footer"><span className="universe-brand" aria-hidden="true">PLUTO<span className="universe-brand-orbit" /></span><Link to={selected.route}>{ui(selected.browse)}<ArrowRight size={15} aria-hidden="true" /></Link></div>
  </Tabs.Root>;
}
