import { Fragment, lazy, type CSSProperties, type ReactNode } from "react";
import { orderGamesForBrowse } from "@/data/games";
import { ui, useUiLanguage } from "@/i18n/ui";
import FeatureSection from "../FeatureSection";
import DemoSlot from "./DemoSlot";
import { AppTileArt, BookArt, PlanetArt } from "../planetary/PlanetScene";
import { landingBookTitle } from "../planetary/landingCopy";
import { planets } from "../planetary/planetConfig";
import { landingBooks, landingTools, type BookDesign } from "../planetary/universeCatalog";
import ArrivalStop from "./ArrivalStop";
import DemoTabs from "./DemoTabs";
import ItemSection from "./ItemSection";
import { bookDescription, bookTopics } from "./flybyCatalog";
import { useLanding } from "./landingContext";
import { useCopy, type CopyKey } from "./copy";
import type { ToneName } from "./tones";
import "./landingSections.css";

// Every demo is its own chunk, fetched only when its section is near the viewport.
const ChessPlayDemo = lazy(() => import("./demos/ChessPlayDemo"));
const ChessVariantsDemo = lazy(() => import("./demos/ChessVariantsDemo"));
const CoachShowcase = lazy(() => import("../CoachShowcase"));
const LearnShowcase = lazy(() => import("../LearnShowcase"));
const GoPlayDemo = lazy(() => import("./demos/GoPlayDemo"));
const GoAnalysisDemo = lazy(() => import("./demos/GoAnalysisDemo"));
const WattenDemo = lazy(() => import("./demos/WattenDemo"));
const SchafkopfDemo = lazy(() => import("./demos/SchafkopfDemo"));
const AtlasFlagDemo = lazy(() => import("./demos/AtlasFlagDemo"));
const NaturaDemo = lazy(() => import("./demos/NaturaDemo"));
const EatItDemo = lazy(() => import("./demos/EatItDemo"));
const ToolsDemo = lazy(() => import("./demos/ToolsDemo"));
const LearnDemo = lazy(() => import("./demos/LearnDemo"));
const CommunityShowcase = lazy(() => import("../CommunityShowcase"));

const slot = (node: ReactNode, height?: number) => <DemoSlot height={height}>{node}</DemoSlot>;

/** The colours of each book's cover, for its button. */
const bookButton: Record<BookDesign, { background: string; color: string }> = {
  math: { background: "#1d4a66", color: "#a9e7eb" },
  foundations: { background: "#1d4a66", color: "#a9e7eb" },
  music: { background: "#7e2a96", color: "#f8e1ff" },
  percentages: { background: "#ee925d", color: "#442d24" },
  guides: { background: "#1f5144", color: "#e5ce9a" },
  analysis: { background: "#5a4580", color: "#e4d9fd" },
  algebra: { background: "#2b5aa0", color: "#dbe8ff" },
  calculus: { background: "#0f766e", color: "#c7f9f1" },
  linear: { background: "#3b3690", color: "#dcdfff" },
  depth: { background: "#e6dcc2", color: "#3a2f1f" },
  chance: { background: "#c2410c", color: "#ffedd5" },
  pitch: { background: "#86198f", color: "#fae8ff" },
  rhythm: { background: "#be185d", color: "#fce7f3" },
  rules: { background: "#15803d", color: "#dcfce7" },
  tactics: { background: "#334155", color: "#e2e8f0" },
};

/** What each game's arrival says: the planet's route, its colour, the short line under its name and the play button. */
const gameArrivals: Record<string, { route: string; tone: ToneName; title: string; line: CopyKey; play: CopyKey; feature?: string }> = {
  "go": { route: "/games/go", tone: "go", title: "Go", line: "blurbGo", play: "playGo" },
  "watten": { route: "/games/watten", tone: "watten", title: "Watten", line: "blurbWatten", play: "playWatten" },
  "schafkopf": { route: "/games/schafkopf", tone: "schafkopf", title: "Schafkopf", line: "blurbSchafkopf", play: "playSchafkopf" },
  "atlas-arena": { route: "/games/atlas-arena", tone: "atlas", title: "Atlas Arena", line: "blurbAtlas", play: "playAtlas", feature: "scan" },
  "natura": { route: "/games/natura", tone: "natura", title: "Natura", line: "blurbNatura", play: "playNatura" },
  "eat-it": { route: "/games/eat-it", tone: "eatit", title: "Eat It", line: "blurbEatIt", play: "playEatIt" },
};

/** A couple of the tool's features or the book's topics: the arrival says what is inside, the section then says what it is for. */
const peek = (items: readonly string[] | undefined) => (items ?? []).slice(0, 2).map(item => ui(item)).join(" · ");

const numbered = (position: number) => String(position + 1).padStart(2, "0");

/**
 * The sections the journey planet travels through: the ones that belong to the selected hero tab, then always the
 * community. Numbers follow the visible order, so each tab reads as its own 01, 02, 03…
 */
export default function LandingSections() {
  const { language } = useUiLanguage();
  const text = useCopy();
  const { category } = useLanding();
  const explore = (name: string) => text("exploreGame").replace("{name}", ui(name));
  const tabsLabel = text("demoTabsLabel");

  const sections: Record<string, (index: string) => ReactNode> = {
    "chess": index => (
      <FeatureSection id="chess" index={index} tone="chess" eyebrow={ui("Chess").toUpperCase()} lines={[{ text: text("chessL1") }, { text: text("chessL2"), accent: true }]}
        description={text("chessDesc")} href="/games/chess" action={explore("Chess")}>
        <DemoTabs tone="chess" label={tabsLabel} tabs={[
          { id: "chess", label: ui("Chess"), content: slot(<ChessPlayDemo />, 440) },
          { id: "variants", label: ui("Chess Variants"), content: slot(<ChessVariantsDemo />, 360) },
          { id: "analysis", label: text("chessAnalysisTab"), content: slot(<CoachShowcase />, 620) },
          { id: "puzzle", label: text("chessPuzzleTab"), content: slot(<LearnShowcase bare />, 520) },
        ]} />
      </FeatureSection>
    ),
    "go": index => (
      <FeatureSection id="go" index={index} tone="go" eyebrow="GO" lines={[{ text: text("goL1") }, { text: text("goL2"), accent: true }]}
        description={text("goDesc")} href="/games/go" action={explore("Go")}>
        <DemoTabs tone="go" label={tabsLabel} tabs={[
          { id: "go", label: ui("Go"), content: slot(<GoPlayDemo />, 480) },
          { id: "analysis", label: text("analysisTab"), content: slot(<GoAnalysisDemo />, 480) },
        ]} />
      </FeatureSection>
    ),
    "watten": index => (
      <FeatureSection id="watten" index={index} tone="watten" eyebrow="WATTEN" lines={[{ text: text("wattenL1") }, { text: text("wattenL2"), accent: true }]}
        description={text("wattenDesc")} href="/games/watten" action={explore("Watten")}>
        {slot(<WattenDemo />, 520)}
      </FeatureSection>
    ),
    "schafkopf": index => (
      <FeatureSection id="schafkopf" index={index} tone="schafkopf" eyebrow="SCHAFKOPF" lines={[{ text: text("schafkopfL1") }, { text: text("schafkopfL2"), accent: true }]}
        description={text("schafkopfDesc")} href="/games/schafkopf" action={explore("Schafkopf")}>
        {slot(<SchafkopfDemo />, 520)}
      </FeatureSection>
    ),
    "atlas-arena": index => (
      <FeatureSection id="atlas-arena" index={index} tone="atlas" feature="scan" eyebrow="ATLAS ARENA" lines={[{ text: text("atlasL1") }, { text: text("atlasL2"), accent: true }]}
        description={text("atlasDesc")} href="/games/atlas-arena" action={explore("Atlas Arena")}>
        {slot(<AtlasFlagDemo />, 460)}
      </FeatureSection>
    ),
    "natura": index => (
      <FeatureSection id="natura" index={index} tone="natura" eyebrow="NATURA" lines={[{ text: text("naturaL1") }, { text: text("naturaL2"), accent: true }]}
        description={text("naturaDesc")} href="/games/natura" action={explore("Natura")}>
        {slot(<NaturaDemo />, 660)}
      </FeatureSection>
    ),
    "eat-it": index => (
      <FeatureSection id="eat-it" index={index} tone="eatit" eyebrow="EAT IT" lines={[{ text: text("eatitL1") }, { text: text("eatitL2"), accent: true }]}
        description={text("eatitDesc")} href="/games/eat-it" action={explore("Eat It")}>
        {slot(<EatItDemo />, 480)}
      </FeatureSection>
    ),
    "community": index => (
      <FeatureSection id="community" index={index} tone="party" feature="moons" eyebrow={ui("COMMUNITY")} lines={[{ text: ui("Play together.") }, { text: `${ui("Learn")} ${ui("together.")}`, accent: true }]}
        description={ui("Challenge friends, complete daily goals and share the experience with other players.")} href="/friends" action={ui("Explore community")}>
        {slot(<CommunityShowcase />, 520)}
      </FeatureSection>
    ),
  };

  const arrival = (id: string) => {
    const game = gameArrivals[id];
    const planet = planets.find(config => config.route === game.route)!;
    return <ArrivalStop key={`arrive-${id}`} id={id} tone={game.tone} feature={game.feature} title={ui(game.title)} line={text(game.line)} href={game.route} action={text(game.play)}
      art={<span className={`solar-planet solar-planet--${planet.tone}`}><PlanetArt config={planet} /></span>} />;
  };
  // Tools and learning get one section per tool or book: the item itself, its text, and a button in the item's colour.
  // Every one but the first (which the flyby delivers) is announced by an arrival, as the games are.
  const items: ReactNode[] = category === "tools" ? landingTools.flatMap((tool, k) => [
    ...(k ? [<ArrivalStop key={`arrive-${tool.id}`} id={tool.id} tone="tools" ownArt title={ui(tool.title)} line={peek(tool.features)} href={tool.route} action={text("openTool")}
      button={{ background: tool.accent, color: "#0f172a" }} art={<span style={{ "--app-accent": tool.accent } as CSSProperties}><AppTileArt toolId={tool.id} /></span>} />] : []),
    <ItemSection key={tool.id} id={tool.id} tone="tools" reverse={k % 2 === 1} title={ui(tool.title)} line={peek(tool.features)} description={ui(tool.description)} href={tool.route} action={text("openTool")}
      button={{ background: tool.accent, color: "#0f172a" }}>
      {slot(<ToolsDemo toolId={tool.id} />, 520)}
    </ItemSection>]) : category === "learn" ? landingBooks.flatMap((book, k) => [
    ...(k ? [<ArrivalStop key={`arrive-${book.id}`} id={`book-${book.id}`} tone="learn" ownArt title={ui(book.title)} href={book.route} action={text("openBook")}
      line={peek(bookTopics(book))}
      button={bookButton[book.design]} art={<BookArt title={landingBookTitle(language, book.design)} design={book.design} />} />] : []),
    <ItemSection key={book.id} id={`book-${book.id}`} tone="learn" reverse={k % 2 === 1} title={ui(book.title)} line={peek(bookTopics(book))} description={ui(bookDescription(book.id))} href={book.route} action={text("openBook")}
      button={bookButton[book.design]}>
      {slot(<LearnDemo bookId={book.id} />, 360)}
    </ItemSection>]) : [];
  const games = category === "games" ? orderGamesForBrowse(["chess", "go", "watten", "schafkopf", "atlas-arena", "natura", "eat-it"].map(id => ({ id, route: `/games/${id}` }))).map(game => game.id) : [];
  const community = games.length + (category === "tools" ? landingTools.length : category === "learn" ? landingBooks.length : 0);

  return <>
    {games.map((id, position) => <Fragment key={id}>{position > 0 && arrival(id)}{sections[id](numbered(position))}</Fragment>)}
    {items}
    <Fragment key="community">{sections.community(numbered(community))}</Fragment>
  </>;
}
