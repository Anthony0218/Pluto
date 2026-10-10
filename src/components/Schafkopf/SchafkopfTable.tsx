import GameXpReward from "@/components/games/GameXpReward";
import { gameUi, useGameLanguage } from "../../i18n/gameUi.ts";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { ArrowDownUp, BookOpen, ChevronLeft, ChevronRight, Fan, Info, LayoutGrid, Layers3, Minimize, Maximize, Palette, Rows3, Settings, PanelsTopLeft, X } from "lucide-react";
import type { CardTheme } from "../../context/CardThemeContext";
import { getWattenCardImage } from "../../utils/WattenCardImages";
import { AI_DIFFICULTY_OPTIONS, BID_NAMES, cardName, collectSecondsFor, contractName, createDeck, isTrump, sortHandForContract as sortHand, DEFAULT_GAME_RULES, PLAY_PHRASES, RUF_SAU_NAMES, SUITS, type Action, type AiDifficulty, type Card, type Contract, type GameRules, type GameView, type Rank, type Suit } from "../../games/schafkopf/schafkopf";
import { CALL_NAME_OPTIONS, DEFAULT_ANNOUNCEMENT_SETTINGS, formatDeclarationAnnouncement, normalizeAnnouncementSettings, type AnnouncementSettings, type CustomAnnouncement } from "../../games/schafkopf/announcements";
import { analyzeSchafkopfTrick, liveSchafkopfTip } from "../../games/schafkopf/coach";
import { readDifficultyProgress, recordDifficultyWin } from "../../games/schafkopf/progression";
import { randomSchafkopfLesson } from "../../games/schafkopf/lessons";
import { botConfig, seededRandom } from "../../games/schafkopf/botConfig";
import SchafkopfCardTabs from "./SchafkopfCardTabs";
import SchafkopfRulebook from "./SchafkopfRulebook";
import SchafkopfBotSettings from "./SchafkopfBotSettings";
import SchafkopfSessions from "./SchafkopfSessions";
import SchafkopfNameplates from "./SchafkopfNameplates";
import SchafkopfSimpleSeat from "./SchafkopfSimpleSeat";
import SchafkopfInterfaceSelector from "./SchafkopfInterfaceSelector";
import { useSchafkopfInterface } from "./useSchafkopfInterface";
import { useSchafkopfAudio, type SoundSettings } from "./schafkopfAudio";
import "./schafkopf.css";
import "./schafkopfMenu.css";
import "./schafkopfSimple.css";
import "./schafkopfResponsive.css";
import useSchafkopfDialog from "./useSchafkopfDialog";

type SchafkopfDeck = CardTheme | "bayerisches-blatt" | "deutsches-blatt" | "wuerttemberger-blatt";

const cardDecks: { id: SchafkopfDeck; name: string }[] = [
  { id: "bayerisches-blatt", name: "Bayerisches Blatt" },
  { id: "deutsches-blatt", name: "Deutsches Blatt" },
  { id: "wuerttemberger-blatt", name: "Württembergisches Blatt" },
  { id: "traditional", name: "Traditionell" },
  { id: "bavarian", name: "Bayerisch" },
  { id: "modern", name: "Modern" },
  { id: "steampunk", name: "Steampunk" },
  { id: "anime", name: "Anime" },
  { id: "horror", name: "Horror" },
];

const GAMES_PER_ROUND = 4;
const ROUNDS_PER_LEDGER_SHEET = 4;
const GAMES_PER_LEDGER_SHEET = GAMES_PER_ROUND * ROUNDS_PER_LEDGER_SHEET;

const avatars = [
  { id: "bavarian", name: "Bayer", holdX: "73%", holdY: "57%", mouthX: "56%", mouthY: "29%" },
  { id: "dirndl", name: "Wirtin", holdX: "45%", holdY: "65%", mouthX: "57%", mouthY: "29%" },
  { id: "sporty", name: "Sportler", holdX: "19%", holdY: "54%", mouthX: "43%", mouthY: "27%" },
  { id: "blonde", name: "Blondine", holdX: "17%", holdY: "52%", mouthX: "55%", mouthY: "34%" },
  { id: "plaid", name: "Stammgast", holdX: "37%", holdY: "69%", mouthX: "52%", mouthY: "31%" },
  { id: "minecraft-boy", name: "Minecraft-Fan", holdX: "20%", holdY: "48%", mouthX: "52%", mouthY: "30%" },
] as const;

function readAvatars(): number[] {
  try {
    const saved = JSON.parse(localStorage.getItem("schafkopf-avatars") ?? "null");
    return Array.isArray(saved) && saved.length === 4 && saved.every(index => Number.isInteger(index) && index >= 0 && index < avatars.length) ? saved : [2, 0, 1, 4];
  } catch { return [2, 0, 1, 4]; }
}

function cardImage(card: Card, deck: SchafkopfDeck) {
  if (deck === "bayerisches-blatt" || deck === "deutsches-blatt" || deck === "wuerttemberger-blatt") {
    const rank = card.rank === "Ass" ? "ace" : card.rank === "König" ? "king" : card.rank.toLowerCase();
    return `/images/schafkopf/${deck}/${card.suit.toLowerCase()}-${rank}.png`;
  }
  return getWattenCardImage(card, deck);
}

function CardFace({ card, cardTheme }: { card: Card; cardTheme: SchafkopfDeck }) {
  useGameLanguage();
  return <img src={cardImage(card, cardTheme)} alt={gameUi(cardName(card))} draggable={false} />;
}

type TablePosition = "south" | "west" | "north" | "east";

/**
 * One opponent seat: portrait, held cards and won tricks stay together here.
 * The matching nameplate and Leger are rendered by the scene overlay, which
 * gives each background one place to tune the complete seat presentation.
 */
function SchafkopfSeatOverlay({
  seat, ownSeat, position, name, avatar, active, cardCount, announcement,
  announcementTitle, wonTricks, points, role, showTrickPoints,
  previousTrickWinner, done, onShownTrickChange,
}: {
  seat: number; ownSeat: number; position: TablePosition; name: string; avatar: typeof avatars[number]; active: boolean; cardCount: number;
  announcement?: string; announcementTitle?: string; wonTricks: number; points: number; role: "Spieler" | "Gegenspieler" | null;
  showTrickPoints: boolean; previousTrickWinner?: number; done: boolean; onShownTrickChange: (seat: number | null) => void;
}) {
  useGameLanguage();
  const avatarStyle = { "--hold-x": avatar.holdX, "--hold-y": avatar.holdY, "--mouth-x": avatar.mouthX, "--mouth-y": avatar.mouthY } as CSSProperties;
  const showOpponent = seat !== ownSeat;
  const canShowPreviousTrick = previousTrickWinner === seat;
  return <div className={`sk-seat-overlay sk-seat-overlay-${position}`}>
    {showOpponent && <div className={`sk-avatar sk-avatar-${position} ${active && !done ? "sk-avatar-active" : ""}`} style={avatarStyle}>
      <img className="sk-avatar-image" src={`/images/schafkopf/avatars/${avatar.id}.png`} alt="" draggable={false} />
      {cardCount > 0 && <div className="sk-held-cards" role="img" aria-label={gameUi(`${name} hält ${cardCount} verdeckte Karten`)}>{Array.from({ length: cardCount }, (_, index) => <span className="sk-card-back" key={index} style={{ "--card-offset": `${(index - (cardCount - 1) / 2) * 11}px`, "--card-angle": `${(index - (cardCount - 1) / 2) * 7}deg` } as CSSProperties} />)}</div>}
      {announcement && <div className="sk-player-speech" title={gameUi(announcementTitle ?? `${name}: ${announcement}`)}><strong>{name}:</strong> {gameUi(announcement)}</div>}
    </div>}
    <span className="sk-visually-hidden">{name}: {gameUi(position === "south" ? "dein Platz" : `Platz ${position}`)}{gameUi(role ? `, ${role}` : "")}</span>
    {showOpponent && wonTricks > 0 && <button className={`sk-trick-stack sk-trick-stack-${position} ${role ? `sk-trick-stack-${role === "Spieler" ? "playing" : "opposing"}` : ""}`} onFocus={() => onShownTrickChange(seat)} onBlur={() => onShownTrickChange(null)} onPointerDown={() => onShownTrickChange(seat)} onPointerUp={() => onShownTrickChange(null)} onPointerCancel={() => onShownTrickChange(null)} onPointerLeave={() => onShownTrickChange(null)} aria-label={gameUi(`Stichstapel von ${name}, ${wonTricks} Stiche${showTrickPoints ? `, ${points} Punkte` : ""}${canShowPreviousTrick ? "; gedrückt halten, um den vorherigen Stich zu sehen" : ""}`)} disabled={!canShowPreviousTrick}><span>♠</span><small>{gameUi(wonTricks)}</small>{showTrickPoints && <small className="sk-trick-points">{gameUi(points)}</small>}</button>}
  </div>;
}

function readSchafkopfDeck(): SchafkopfDeck {
  try {
    const saved = localStorage.getItem("schafkopf-card-deck") as SchafkopfDeck | null;
    return saved && cardDecks.some(deck => deck.id === saved) ? saved : "bayerisches-blatt";
  } catch {
    return "bayerisches-blatt";
  }
}

const gameKindOptions: { kind: Contract["kind"]; label: string; rule?: keyof GameRules }[] = [
  { kind: "rufspiel", label: "Sauspiel", rule: "sauspiel" },
  { kind: "solo", label: "Solo" },
  { kind: "wenz", label: "Wenz" },
  { kind: "farbwenz", label: "Farbwenz", rule: "farbwenz" },
  { kind: "geier", label: "Geier", rule: "geier" },
  { kind: "farbgeier", label: "Farbgeier", rule: "farbgeier" },
  { kind: "bettel", label: "Bettel", rule: "bettel" },
  { kind: "sie", label: "Sie" },
];

type MenuSection = "settings" | "rulebook" | "design" | "interface";
type RulebookTab = "basics" | "setup" | "ui" | "custom" | "sounds" | "bots" | "costs" | "level" | "tips" | "lexicon" | "players" | "background";
const menuSections = {
  settings: { label: "Einstellungen", tabs: [{ id: "custom", label: "Spielregeln" }, { id: "costs", label: "Kosten" }, { id: "level", label: "Level & Bots" }, { id: "sounds", label: "Sounds" }] },
  rulebook: { label: "Regelwerk", tabs: [{ id: "basics", label: "Spielregeln" }, { id: "bots", label: "Bot-Regeln" }, { id: "tips", label: "Tipps" }, { id: "lexicon", label: "Lexikon" }] },
  design: { label: "Design", tabs: [{ id: "players", label: "Spieler" }, { id: "setup", label: "Kartendeck" }, { id: "ui", label: "Kartengröße" }] },
  interface: { label: "Interface", tabs: [{ id: "background", label: "Hintergründe" }] },
} as const;
const popupMenuItems: { section: MenuSection; Icon: typeof Settings }[] = [
  { section: "settings", Icon: Settings },
  { section: "rulebook", Icon: BookOpen },
  { section: "design", Icon: Palette },
  { section: "interface", Icon: PanelsTopLeft },
];
const reviewTabs = [{ id: "tricks", label: "Stich-Review" }, { id: "score", label: "Spielstand" }, { id: "announcements", label: "Ansagen" }];

const sortPreviewCards: Card[] = [
  { id: "Eichel-Ober", suit: "Eichel", rank: "Ober" },
  { id: "Gras-Unter", suit: "Gras", rank: "Unter" },
  { id: "Herz-Ass", suit: "Herz", rank: "Ass" },
  { id: "Herz-10", suit: "Herz", rank: "10" },
  { id: "Eichel-Ass", suit: "Eichel", rank: "Ass" },
  { id: "Gras-10", suit: "Gras", rank: "10" },
  { id: "Schellen-König", suit: "Schellen", rank: "König" },
];

function HandSortPreview({ layout, cardTheme }: { layout: "spread" | "stack" | "fan"; cardTheme: SchafkopfDeck }) {
  useGameLanguage();
  const cards = sortHand(sortPreviewCards, null);
  return <figure className={`sk-sort-preview sk-sort-preview-${layout}`}>
    <div className="sk-sort-preview-cards">{cards.map((card, index) => <span className="sk-sort-preview-card" key={card.id} style={{ "--preview-angle": `${(index - (cards.length - 1) / 2) * 6}deg`, "--preview-rise": `${Math.abs(index - (cards.length - 1) / 2) * 5}px`, zIndex: index + 1 } as CSSProperties}><CardFace card={card} cardTheme={cardTheme} /></span>)}</div>
    <figcaption>{gameUi("Beispiel einer sortierten Hand: Trumpf zuerst, danach die übrigen Farben.")}</figcaption>
  </figure>;
}

function readAnnouncementPreference(): string {
  try {
    const saved = localStorage.getItem("schafkopf-play-announcement");
    return saved && PLAY_PHRASES.some(phrase => phrase === saved) ? saved : "random";
  } catch { return "random"; }
}

function readAnnouncementSettings(): AnnouncementSettings {
  try { return normalizeAnnouncementSettings(JSON.parse(localStorage.getItem("schafkopf-announcement-settings") ?? "null")); }
  catch { return DEFAULT_ANNOUNCEMENT_SETTINGS; }
}

function readTablePreference<T extends string>(key: string, options: readonly T[], fallback: T): T {
  try {
    const value = localStorage.getItem(key) as T | null;
    return value && options.includes(value) ? value : fallback;
  } catch { return fallback; }
}

function readOwnCardScale(): number {
  const defaultScale = defaultCardScales().own;
  try {
    const saved = Number(localStorage.getItem("schafkopf-own-card-scale"));
    if (Number.isFinite(saved) && saved >= 75 && saved <= 220) return saved;
  } catch { /* Use the responsive default below. */ }
  return defaultScale;
}

function readTrickCardScale(): number {
  const defaultScale = defaultCardScales().trick;
  try {
    const saved = Number(localStorage.getItem("schafkopf-trick-card-scale"));
    if (Number.isFinite(saved) && saved >= 75 && saved <= 220) return saved;
  } catch { /* Use the responsive default below. */ }
  return defaultScale;
}

function defaultCardScales() {
  const compact = typeof window !== "undefined" && window.matchMedia("(max-width: 700px), (max-height: 500px) and (pointer: coarse)").matches;
  return { own: compact ? 200 : 100, trick: compact ? 150 : 100 };
}

function readAutoSort(): boolean {
  try { return localStorage.getItem("schafkopf-auto-sort") === "true"; }
  catch { return false; }
}

function readCollectSeconds(difficulty?: AiDifficulty): number {
  try {
    const stored = Number(localStorage.getItem("schafkopf-collect-seconds"));
    return Number.isInteger(stored) && stored >= 1 && stored <= 10 ? stored : collectSecondsFor(difficulty ?? "amateur");
  } catch { return collectSecondsFor(difficulty ?? "amateur"); }
}

type NoteInk = "pen" | "pencil";

function readLedgerNote(): string {
  try { return localStorage.getItem("schafkopf-ledger-note") ?? ""; }
  catch { return ""; }
}

function readLedgerInk(): NoteInk {
  try { return localStorage.getItem("schafkopf-ledger-ink") === "pencil" ? "pencil" : "pen"; }
  catch { return "pen"; }
}

function formatLedgerAmount(amount: number): string {
  return `${amount > 0 ? "+" : ""}${amount}`;
}

function Toggle({ checked, onChange, children, disabled = false }: { checked: boolean; onChange?: (checked: boolean) => void; children: ReactNode; disabled?: boolean }) {
  useGameLanguage();
  return <label className={`sk-toggle ${disabled ? "is-disabled" : ""}`}>
    <span className="sk-toggle-copy">{gameUi(children)}</span>
    <input type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={event => onChange?.(event.target.checked)} />
    <span className="sk-toggle-track" aria-hidden="true" />
  </label>;
}

export function SchafkopfRules({ embedded = false }: { embedded?: boolean }) {
  useGameLanguage();
  const content = <SchafkopfRulebook />;
  return embedded
    ? <div className="sk-rules-content"><h3>{gameUi("Spielregeln & Wertung")}</h3>{gameUi(content)}</div>
    : <details className="sk-panel sk-rules"><summary>{gameUi("Spielregeln & Wertung")}</summary>{gameUi(content)}</details>;
}

export default function SchafkopfTable({ view, onAction, busy = false, error, hidden = false, onReveal, allowNext = true, subtitle, onRulesChange, onRename, aiDifficulty, onAiDifficultyChange, collectSecondsValue, onCollectSecondsChange, onlineSession = false, onlineCode, alwaysLegen = false, untimedLegen = false, playerAvatars, onAvatarSave, hasBots = true }: {
  view: GameView; onAction: (action: Action) => void; busy?: boolean; error?: string | null;
  hidden?: boolean; onReveal?: () => void; allowNext?: boolean; subtitle?: string; onRulesChange?: (rules: GameRules) => void; onRename?: (seat: number, name: string) => void;
  aiDifficulty?: AiDifficulty; onAiDifficultyChange?: (difficulty: AiDifficulty) => void;
  collectSecondsValue?: number; onCollectSecondsChange?: (seconds: number) => void | Promise<void>;
  hasBots?: boolean;
  playerAvatars?: (number | undefined)[];
  onAvatarSave?: (avatar: number, name: string) => Promise<boolean>;
  onlineSession?: boolean;
  onlineCode?: string;
  alwaysLegen?: boolean;
  untimedLegen?: boolean;
}) {
  useGameLanguage();
  const [interfaceMode, selectInterface, simpleBackground, selectSimpleBackground] = useSchafkopfInterface();
  const simpleInterface = interfaceMode === "simple";
  const pageRef = useRef<HTMLElement>(null);
  const [nativeFullscreen, setNativeFullscreen] = useState(false);
  const [appFullscreen, setAppFullscreen] = useState(false);
  const fullscreen = nativeFullscreen || appFullscreen;
  const [focusedCardId, setFocusedCardId] = useState<string | null>(null);
  const [fullscreenError, setFullscreenError] = useState("");
  const [handLayouts, setHandLayouts] = useState<Record<string, string[]>>({});
  const [handLayout, setHandLayoutState] = useState<"spread" | "stack" | "fan">(() => readTablePreference("schafkopf-hand-layout", ["spread", "stack", "fan"], "fan"));
  const [ownCardScale, setOwnCardScaleState] = useState(readOwnCardScale);
  const [trickCardScale, setTrickCardScaleState] = useState(readTrickCardScale);
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null);
  const [collectingTrickRevision, setCollectingTrickRevision] = useState(-1);
  const [dealing, setDealing] = useState(true);
  const roundRef = useRef(view.round);
  const [rulebookOpen, setRulebookOpen] = useState(false);
  const [rulebookTab, setRulebookTab] = useState<RulebookTab>("basics");
  const [menuSection, setMenuSection] = useState<MenuSection>("rulebook");
  const [reviewTab, setReviewTab] = useState("tricks");
  const [ownLevel, setOwnLevel] = useState<AiDifficulty>(() => readTablePreference("schafkopf-own-level", ["beginner", "amateur", "advanced", "pro", "legend"], "beginner"));
  const [hidePlayers, setHidePlayers] = useState(() => readTablePreference("schafkopf-hide-players", ["true", "false"], "false") === "true");
  const [tipOpen, setTipOpen] = useState(false);
  const progressRef = useRef(readDifficultyProgress());
  const [difficultyOffer, setDifficultyOffer] = useState<AiDifficulty | null>(null);
  useEffect(() => {
    if (!aiDifficulty || !onAiDifficultyChange || !hasBots) return;
    const result = recordDifficultyWin(progressRef.current, view, aiDifficulty, view.seat, onlineCode ?? "local-ai");
    if (result.progress === progressRef.current) return;
    progressRef.current = result.progress;
    try { localStorage.setItem("schafkopf-difficulty-progress", JSON.stringify(result.progress)); } catch { /* Session progress. */ }
    if (result.offer) setDifficultyOffer(result.offer);
  }, [view, aiDifficulty, onAiDifficultyChange, hasBots, onlineCode]);
  const [savingPlayers, setSavingPlayers] = useState(false);
  const [avatarSeats, setAvatarSeats] = useState(readAvatars);
  const [draftAvatars, setDraftAvatars] = useState(readAvatars);
  const [draftNames, setDraftNames] = useState<string[]>(view.names);
  const [scoreboardOpen, setScoreboardOpen] = useState(false);
  const [ledgerPage, setLedgerPage] = useState<number | null>(null);
  const [ledgerNote, setLedgerNote] = useState(readLedgerNote);
  const [ledgerInk, setLedgerInk] = useState<NoteInk>(readLedgerInk);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [collectSecondsDraft, setCollectSecondsDraft] = useState<number | null>(null);
  const collectSeconds = collectSecondsDraft ?? collectSecondsValue ?? readCollectSeconds(aiDifficulty);
  // A completed game must always keep its summary visible. This also restores
  // the summary when a finished saved or multiplayer game is opened again.
  const done = view.phase === "finished" || view.phase === "redeal";
  const [announcementsOpen, setAnnouncementsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [autoSort, setAutoSort] = useState(readAutoSort);
  const onActionRef = useRef(onAction);
  const [announcementPreference, setAnnouncementPreference] = useState(readAnnouncementPreference);
  const [announcementSettings, setAnnouncementSettings] = useState(readAnnouncementSettings);
  const [cardTheme, setCardThemeState] = useState<SchafkopfDeck>(readSchafkopfDeck);
  const [spritzWithCard, setSpritzWithCard] = useState(false);
  const sounds = useSchafkopfAudio(view.round, view.announcements, view.tricks.length * 4 + view.trick.length);
  const [ambience, setAmbienceState] = useState<"garden" | "beach" | "bar" | "mountain">(() => readTablePreference("schafkopf-ambience", ["garden", "beach", "bar", "mountain"], "garden"));
  const [shownTrickSeat, setShownTrickSeat] = useState<number | null>(null);
  const [turnReminderRevision, setTurnReminderRevision] = useState(-1);
  const turnReminderOpen = turnReminderRevision === view.revision && view.phase === "play" && view.turn === view.seat && !busy;
  const [chosenKind, setChosenKind] = useState<Contract["kind"] | "">("");
  const [chosenSuit, setChosenSuit] = useState<Suit | "">("");
  const [chosenCallRank, setChosenCallRank] = useState<Rank | "">("");
  const [chosenDu, setChosenDu] = useState(false);
  const [detailStepKey, setDetailStepKey] = useState("");
  const currentAnnouncementSettings = announcementSettings;
  const contextualTip = useMemo(() => !hidden ? liveSchafkopfTip(view) : null, [hidden, view]);
  const [lessonSeed] = useState(() => Math.floor(Math.random() * 4294967296));
  const lesson = useMemo(() => randomSchafkopfLesson(ownLevel, seededRandom(lessonSeed + view.round * 101 + view.revision * 17 + view.seat), view), [ownLevel, lessonSeed, view]);
  const activeRules = { ...DEFAULT_GAME_RULES, ...(view.rules ?? {}) };
  const activeRulesKey = JSON.stringify(activeRules);
  const rulebook = activeRules;
  useEffect(() => { onActionRef.current = onAction; }, [onAction]);
  useEffect(() => { localStorage.setItem("schafkopf-rulebook", activeRulesKey); }, [activeRulesKey]);
  useEffect(() => { try { localStorage.setItem("schafkopf-ledger-note", ledgerNote); } catch { /* Keep the note for this session. */ } }, [ledgerNote]);
  useEffect(() => { try { localStorage.setItem("schafkopf-ledger-ink", ledgerInk); } catch { /* Kugelschreiber remains the default in this session. */ } }, [ledgerInk]);
  useEffect(() => { try { localStorage.setItem("schafkopf-announcement-settings", JSON.stringify(announcementSettings)); } catch { /* Keep settings for this session. */ } }, [announcementSettings]);
  const updateAnnouncementSettings = (change: (current: AnnouncementSettings) => AnnouncementSettings) => setAnnouncementSettings(current => change(current));
  const setCustomAnnouncement = (key: CustomAnnouncement, value: string) => updateAnnouncementSettings(current => ({ ...current, custom: { ...current.custom, [key]: value.slice(0, 100) } }));
  const updateRulebook = (update: (current: GameRules) => GameRules) => {
    if (!onRulesChange) return;
    const next = update(rulebook);
    onRulesChange(next);
  };
  const setCardTheme = (theme: SchafkopfDeck) => {
    setCardThemeState(theme);
    try { localStorage.setItem("schafkopf-card-deck", theme); } catch { /* Session selection remains active. */ }
  };
  const setHandLayout = (layout: "spread" | "stack" | "fan") => {
    setHandLayoutState(layout);
    try { localStorage.setItem("schafkopf-hand-layout", layout); } catch { /* Session selection remains active. */ }
  };
  const setOwnCardScale = (scale: number) => {
    const next = Math.min(220, Math.max(75, scale));
    setOwnCardScaleState(next);
    try { localStorage.setItem("schafkopf-own-card-scale", String(next)); } catch { /* Keep this session's setting. */ }
  };
  const setTrickCardScale = (scale: number) => {
    const next = Math.min(220, Math.max(75, scale));
    setTrickCardScaleState(next);
    try { localStorage.setItem("schafkopf-trick-card-scale", String(next)); } catch { /* Keep this session's setting. */ }
  };
  const restoreDefaultCardScales = () => {
    const defaults = defaultCardScales();
    setOwnCardScale(defaults.own);
    setTrickCardScale(defaults.trick);
  };
  const setAmbience = (setting: "garden" | "beach" | "bar" | "mountain") => {
    setAmbienceState(setting);
    try { localStorage.setItem("schafkopf-ambience", setting); } catch { /* Session selection remains active. */ }
  };
  const commitCollectSeconds = (seconds: number) => {
    if (!onlineSession || !onCollectSecondsChange || seconds === collectSecondsValue) return;
    void Promise.resolve(onCollectSecondsChange(seconds)).finally(() => setCollectSecondsDraft(null));
  };
  const displayedAvatars = onlineSession ? view.names.map((_, seat) => playerAvatars?.[seat] ?? [2, 0, 1, 4][seat]) : avatarSeats;
  const openMenu = (section: MenuSection, tab?: RulebookTab) => {
    setScoreboardOpen(false); setReviewOpen(false); setAnnouncementsOpen(false); setSortMenuOpen(false); setTurnReminderRevision(-1);
    setMenuSection(section);
    setRulebookTab(tab ?? menuSections[section].tabs[0].id);
    setDraftNames([...view.names]); setDraftAvatars([...displayedAvatars]);
    setRulebookOpen(true);
  };
  const openReview = (tab: string) => {
    setRulebookOpen(false); setSortMenuOpen(false); setTurnReminderRevision(-1); setReviewTab(tab);
    setReviewOpen(tab === "tricks"); setScoreboardOpen(tab === "score"); setAnnouncementsOpen(tab === "announcements");
  };
  const popupNavigation = (active: MenuSection | "review") => <nav className="sk-popup-menu-navigation" aria-label={gameUi("Bereiche im Schafkopfmenü")}>
    {popupMenuItems.map(({ section, Icon }) => <button key={section} type="button" className={active === section ? "is-active" : undefined} aria-current={active === section ? "page" : undefined} onClick={() => openMenu(section)} title={gameUi(menuSections[section].label)}><Icon size={17} aria-hidden="true" /><span>{gameUi(menuSections[section].label)}</span></button>)}
    <button type="button" className={active === "review" ? "is-active" : undefined} aria-current={active === "review" ? "page" : undefined} onClick={() => openReview("tricks")} title={gameUi("Stich-Review")}><Layers3 size={17} aria-hidden="true" /><span>{gameUi("Stich-Review")}</span></button>
  </nav>;
  const savePlayers = async () => {
    setSavingPlayers(true);
    try {
      if (onlineSession) {
        if (!onAvatarSave || !await onAvatarSave(draftAvatars[view.seat], draftNames[view.seat])) return;
      } else {
        setAvatarSeats([...draftAvatars]);
        try { localStorage.setItem("schafkopf-avatars", JSON.stringify(draftAvatars)); } catch { /* Keep this session's selection. */ }
        if (onRename) draftNames.forEach((name, seat) => { if (name.trim() && name.trim() !== view.names[seat]) onRename(seat, name); });
      }
      setRulebookOpen(false);
    } finally { setSavingPlayers(false); }
  };
  const scoreboardVisible = !difficultyOffer && (scoreboardOpen || done) && !rulebookOpen && !tipOpen && !helpOpen && !announcementsOpen && !sortMenuOpen;
  const dialogKey = difficultyOffer ? "difficulty" : rulebookOpen ? "menu" : tipOpen ? "tip" : helpOpen ? "help" : sortMenuOpen ? "sort" : scoreboardVisible || reviewOpen || announcementsOpen ? "review" : turnReminderOpen ? "reminder" : null;
  useSchafkopfDialog(dialogKey, () => {
    if (difficultyOffer) { setDifficultyOffer(null); return; }
    if (done && dialogKey === "review") { setReviewOpen(false); return; }
    setRulebookOpen(false); setTipOpen(false); setHelpOpen(false);
    setScoreboardOpen(false); setReviewOpen(false); setAnnouncementsOpen(false);
    setTurnReminderRevision(-1); setSortMenuOpen(false);
  });
  useEffect(() => {
    if (!appFullscreen) return;
    const page = pageRef.current;
    if (!page) return;
    const siblings = new Map<HTMLElement, boolean>();
    let branch = page;
    while (branch.parentElement) {
      for (const sibling of branch.parentElement.children) {
        if (sibling === branch || !(sibling instanceof HTMLElement) || /^(SCRIPT|STYLE|LINK)$/.test(sibling.tagName)) continue;
        siblings.set(sibling, sibling.inert);
        sibling.inert = true;
      }
      branch = branch.parentElement;
      if (branch === document.body) break;
    }
    const viewport = pageRef.current?.closest<HTMLElement>(".app-viewport");
    const previousOverflow = viewport?.style.overflow;
    if (viewport) viewport.style.overflow = "hidden";
    const exit = (event: KeyboardEvent) => { if (event.key === "Escape" && !event.defaultPrevented) setAppFullscreen(false); };
    document.addEventListener("keydown", exit);
    return () => {
      siblings.forEach((inert, element) => { element.inert = inert; });
      if (viewport) viewport.style.overflow = previousOverflow ?? "";
      document.removeEventListener("keydown", exit);
    };
  }, [appFullscreen]);
  useEffect(() => {
    const sync = () => setNativeFullscreen(document.fullscreenElement === pageRef.current);
    sync();
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);
  useEffect(() => {
    if (roundRef.current === view.round) return;
    roundRef.current = view.round;
    setDealing(true);
  }, [view.round]);
  useEffect(() => {
    if (!dealing) return;
    const timer = window.setTimeout(() => setDealing(false), 1250);
    return () => window.clearTimeout(timer);
  }, [dealing]);
  const toggleFullscreen = async () => {
    setFullscreenError("");
    if (appFullscreen) { setAppFullscreen(false); return; }
    try {
      if (document.fullscreenElement === pageRef.current) await document.exitFullscreen();
      else if (pageRef.current?.requestFullscreen) await pageRef.current.requestFullscreen({ navigationUI: "hide" });
      else setAppFullscreen(true);
    } catch {
      // iPhone browsers and embedded webviews may not support element fullscreen.
      if (!nativeFullscreen) setAppFullscreen(true);
      else setFullscreenError("Vollbild konnte nicht beendet werden. Nutze die Vollbildtaste deines Browsers.");
    }
  };
  const [actionClock, setActionClock] = useState(() => Date.now());
  useEffect(() => {
    if (!view.legenDeadline && !(onlineSession && view.turnDeadline)) return;
    const interval = window.setInterval(() => setActionClock(Date.now()), 250);
    return () => window.clearInterval(interval);
  }, [view.legenDeadline, view.turnDeadline, onlineSession]);
  const canDecideLegen = view.phase === "legen" && view.legenDecisions?.[view.seat] === null;
  const legenSecondsLeft = view.legenDeadline ? Math.max(0, Math.ceil((view.legenDeadline - actionClock) / 1000)) : null;
  const turnSecondsLeft = onlineSession && view.turnDeadline ? Math.max(0, Math.ceil((view.turnDeadline - actionClock) / 1000)) : null;
  const clockText = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  const mine = view.turn === view.seat || canDecideLegen;
  const active = mine && !hidden && !busy && !dealing && (view.phase !== "legen" || untimedLegen || legenSecondsLeft === null || legenSecondsLeft > 0);
  const legenDecisionActive = canDecideLegen && !hidden && !busy && (untimedLegen || active);
  const needsPlayerAction = active && !done && view.phase !== "trick";
  const compactInfo = !needsPlayerAction && !done && !hidden && !activeRules.showPlayedTrumps && view.phase === "trick";
  useEffect(() => {
    if (!active || done || view.phase !== "play") return;
    const timer = window.setInterval(() => setTurnReminderRevision(view.revision), aiDifficulty && !onlineSession ? 60_000 : 30_000);
    return () => window.clearInterval(timer);
  }, [active, done, view.phase, view.revision, aiDifficulty, onlineSession]);
  const ledgerEntries = view.history ?? [];
  const latestLedgerEntry = ledgerEntries.at(-1);
  const ledgerPageCount = Math.max(1, Math.ceil(ledgerEntries.length / GAMES_PER_LEDGER_SHEET));
  const currentLedgerPage = Math.min(ledgerPage ?? ledgerPageCount - 1, ledgerPageCount - 1);
  const visibleLedgerEntries = ledgerEntries.slice(currentLedgerPage * GAMES_PER_LEDGER_SHEET, (currentLedgerPage + 1) * GAMES_PER_LEDGER_SHEET);
  const baseHandOrder = `${view.round}:${view.seat}`;
  const selectionKey = baseHandOrder;
  const availableKinds = gameKindOptions.filter(option => view.contracts.some(contract => contract.kind === option.kind));
  const selectedKind = availableKinds.some(option => option.kind === chosenKind) ? chosenKind : availableKinds[0]?.kind;
  const variants = view.contracts.filter(contract => contract.kind === selectedKind);
  const suits = SUITS.filter(suit => variants.some(contract => contract.suit === suit));
  const selectedSuit = suits.includes(chosenSuit as Suit) ? chosenSuit : suits[0];
  const callRanks = variants.filter(contract => contract.suit === selectedSuit).map(contract => contract.calledRank ?? "Ass");
  const selectedCallRank = callRanks.includes(chosenCallRank as Rank) ? chosenCallRank : callRanks[0];
  const matchingSuitVariants = variants.filter(contract => (!suits.length || contract.suit === selectedSuit) && (!view.forcedCaller || contract.kind !== "rufspiel" || (contract.calledRank ?? "Ass") === selectedCallRank));
  const selectedDu = matchingSuitVariants.some(contract => Boolean(contract.tout) === chosenDu) ? chosenDu : Boolean(matchingSuitVariants[0]?.tout);
  const chosenContract = matchingSuitVariants.find(contract => Boolean(contract.tout) === selectedDu);
  const previewContract = view.phase === "declare" && detailStepKey === selectionKey ? chosenContract : undefined;
  const contractNeedsSort = Boolean(view.contract && view.contract.kind !== "rufspiel" && !(view.contract.kind === "solo" && view.contract.suit === "Herz"));
  const contractHandOrder = `${baseHandOrder}:contract`;
  const handOrder = previewContract ? `${baseHandOrder}:choice:${previewContract.kind}:${previewContract.suit ?? "none"}:${Boolean(previewContract.tout)}` : autoSort && contractNeedsSort ? contractHandOrder : baseHandOrder;
  const savedOrder = handLayouts[handOrder] ?? (previewContract || autoSort ? sortHand(view.hand, previewContract ?? (handOrder === contractHandOrder ? view.contract : null)) : view.hand).map(card => card.id);
  const currentOrder = [...savedOrder, ...view.hand.filter(card => !savedOrder.includes(card.id)).map(card => card.id)];
  const sortedHand = sortHand(view.hand, previewContract ?? view.contract);
  const hand = [...view.hand].sort((a, b) => currentOrder.indexOf(a.id) - currentOrder.indexOf(b.id));
  const alreadySorted = hand.every((card, index) => card.id === sortedHand[index]?.id);
  const changeAutoSort = (enabled: boolean) => {
    // Changing the preference affects the next deal, never the current hand.
    setHandLayouts(layouts => ({ ...layouts, [baseHandOrder]: hand.map(card => card.id), ...(view.contract ? { [contractHandOrder]: hand.map(card => card.id) } : {}) }));
    setAutoSort(enabled);
    try { localStorage.setItem("schafkopf-auto-sort", String(enabled)); } catch { /* Session selection remains active. */ }
  };
  const closeSortMenu = () => {
    setSortMenuOpen(false);
  };
  const reorderCard = (sourceId: string, targetId: string) => {
    const current = hand.map(card => card.id);
    const from = current.indexOf(sourceId);
    const to = current.indexOf(targetId);
    if (from < 0 || to < 0 || from === to) return;
    current.splice(from, 1);
    current.splice(to, 0, sourceId);
    setHandLayouts(layouts => ({ ...layouts, [handOrder]: current }));
  };
  useEffect(() => {
    if (view.phase !== "trick") return;
    const duration = collectSeconds * 1000;
    const animation = !(reviewOpen || tipOpen) ? window.setTimeout(() => setCollectingTrickRevision(view.revision), Math.max(0, duration - 800)) : undefined;
    const collect = mine && !busy && !reviewOpen && !tipOpen ? window.setTimeout(() => onActionRef.current({ type: "collect" }), duration) : undefined;
    return () => { if (animation) window.clearTimeout(animation); if (collect) window.clearTimeout(collect); };
  }, [view.phase, view.revision, mine, busy, collectSeconds, reviewOpen, tipOpen]);
  const collectingTrick = view.phase === "trick" && collectingTrickRevision === view.revision;
  const dispatch = (action: Action) => { if (!busy) { setTurnReminderRevision(-1); if (action.type === "play") setSpritzWithCard(false); onAction(action); } };
  const tablePosition = (seat: number) => (["south", "west", "north", "east"] as const)[(seat - view.seat + 4) % 4];
  const partyFor = (seat: number): "Spieler" | "Gegenspieler" | null => {
    if (!view.contract || view.contract.kind === "ramsch" || view.declarer < 0) return null;
    if (seat === view.declarer) return "Spieler";
    if (view.contract.kind !== "rufspiel") return "Gegenspieler";
    // In a Rufspiel, only the declarer is public until the called ace reveals the partner.
    if (!view.partnerRevealed && !done && seat !== view.seat) return null;
    if (view.partner === null) return null;
    return seat === view.partner ? "Spieler" : "Gegenspieler";
  };
  const calledCardSeen = Boolean(view.contract?.kind === "rufspiel" && [...view.tricks.flatMap(trick => trick.plays), ...view.trick].some(play => play.card.suit === view.contract?.suit && play.card.rank === (view.contract?.calledRank ?? "Ass")));
  const teamsKnown = Boolean(view.contract && view.contract.kind !== "ramsch" && (view.contract.kind !== "rufspiel" || calledCardSeen || done));
  const showTurnNotice = needsPlayerAction && Boolean(view.contract);
  const playingSeats = teamsKnown ? [view.declarer, ...(view.partner !== null ? [view.partner] : [])] : [];
  const opposingSeats = teamsKnown ? view.names.map((_, seat) => seat).filter(seat => !playingSeats.includes(seat)) : [];
  const teamEyes = (seats: number[]) => seats.reduce((sum, seat) => sum + view.points[seat], 0);
  const ownParty = teamsKnown ? partyFor(view.seat) : null;
  const ownTeamSeats = ownParty ? view.names.map((_, seat) => seat).filter(seat => partyFor(seat) === ownParty) : [view.seat];
  const ownTeamPoints = teamEyes(ownTeamSeats);
  const teamPointsFor = (seat: number) => {
    if (!teamsKnown) return view.points[seat];
    const party = partyFor(seat);
    return party ? teamEyes(view.names.map((_, index) => index).filter(index => partyFor(index) === party)) : view.points[seat];
  };
  const cutterSeat = (view.dealer + 3) % 4;
  const displayTrick = view.trick;
  // The previous completed trick stays available for the entire following trick.
  const previousTrick = view.phase === "play" ? view.tricks.at(-1) : undefined;
  const revealedTrick = shownTrickSeat === previousTrick?.winner ? previousTrick : undefined;
  const ownWonTricks = view.tricks.filter(trick => trick.winner === view.seat);
  // Browsers only display descendants of the active fullscreen element. Keep
  // the dialog in the page while fullscreen, but use body otherwise so it is
  // not clipped by the table scene.
  const scoreDialogContainer = document.fullscreenElement ?? (appFullscreen ? document.querySelector(".sk-game-page") : null) ?? document.body;
  const spritzCount = view.spritzCount ?? 0;
  const sauspielInHand = view.contracts.some(contract => contract.kind === "rufspiel");
  const playedTrumpCount = view.contract ? [...view.tricks.flatMap(trick => trick.plays), ...view.trick].filter(play => isTrump(play.card, view.contract!)).length : 0;
  const totalTrumpCount = view.contract ? createDeck().filter(card => isTrump(card, view.contract!)).length : 0;
  const phaseHelp = [
    canDecideLegen ? `${legenSecondsLeft === null ? "Du hast unbegrenzt Zeit für deine Entscheidung." : `Du hast noch ${legenSecondsLeft} Sekunden für deine Entscheidung.`} Danach bekommst du sofort deine zweite Hand; alle anderen können unabhängig und gleichzeitig entscheiden.` : null,
    hidden && !done ? "Die nächste Hand bleibt verdeckt, bis der Spieler bereit ist." : null,
    mine && view.phase === "intent" ? view.canIntent ? "Der erste Interessent bietet zuerst. Farbe und genaue Ansage bleiben bis nach dem Bieten geheim." : "Mit dieser Hand ist kein zugelassenes Spiel möglich." : null,
    mine && view.phase === "auction" && !view.canPassBid ? "Deine Spielabsicht ist verbindlich. Nenne zuerst einen zulässigen Spielrang." : null,
    mine && view.phase === "declare" && detailStepKey !== selectionKey && activeRules.sauspiel && !sauspielInHand ? "Sauspiel: Du kannst nur eine Farbe rufen, die du als Fehlfarbe auf der Hand hast. Herz ist Trumpf und kann nicht gerufen werden." : null,
    mine && view.phase === "declare" && detailStepKey !== selectionKey && activeRules.sauspiel && sauspielInHand && !view.contracts.some(contract => contract.kind === "rufspiel") ? "Sauspiel ist durch das aktuelle Gebot bereits überboten." : null,
    mine && view.phase === "declare" && detailStepKey === selectionKey ? `${gameKindOptions.find(option => option.kind === selectedKind)?.label} · ${view.bidLevel > 1 ? `Mindestgebot ${BID_NAMES[view.bidLevel]}` : "wähle die genaue Ansage"}${selectedKind === "wenz" || selectedKind === "geier" ? ". Dieses Spiel hat keine Trumpffarbe." : ""}` : null,
    view.phase === "play" ? mine ? "Helle Karten sind spielbar. Gesperrte Karten zeigen den Grund darunter." : "Deine Karten bleiben sichtbar; spielen kannst du, sobald du am Zug bist." : null,
  ].filter((message): message is string => Boolean(message));
  const selectedRulebookTab = menuSections[menuSection].tabs.find(tab => tab.id === rulebookTab);
  const selectedReviewTab = done && !reviewOpen && !announcementsOpen ? "score" : reviewTab;
  const reviewNavigation = <SchafkopfCardTabs tabs={reviewTabs} selected={selectedReviewTab} onSelect={openReview} cardTheme={cardTheme} frontImage={cardImage(sortPreviewCards[0], cardTheme)} label={gameUi("Stich-Review und Spielstand")} panelId="sk-review-panel" idPrefix="sk-review-tab" />;
  const reviewCounters = <div className="sk-review-counters">{rulebook.showPoints && <div className="sk-team-scores" aria-label={gameUi("Gezählte Punkte")}>{view.names.map((name, seat) => <div key={seat}><span>{name}</span><strong>{gameUi(view.points[seat])}{gameUi(" / 120 Augen")}</strong><meter min={0} max={120} value={view.points[seat]} aria-label={gameUi(`Punkte von ${name}`)} /></div>)}</div>}{rulebook.showPlayedTrumps && <div className="sk-trump-counter"><strong>{gameUi(playedTrumpCount)} / {gameUi(totalTrumpCount)}</strong><span>{gameUi("gefallene Trümpfe")}</span><meter min={0} max={Math.max(1,totalTrumpCount)} value={playedTrumpCount} aria-label={gameUi("Gefallene Trümpfe")} /></div>}</div>;
  const reviewContent = <><p className="sk-review-guide">{gameUi("Regeln und Tipps werden aus deiner Hand und den Informationen vor deinem damaligen Zug geprüft.")}</p>{view.tricks.length ? <ol className="sk-review-list">{view.tricks.map((trick, index) => {
    const review = analyzeSchafkopfTrick(view, trick);
    return <li key={index}><strong>{gameUi("Stich ")}{gameUi(index + 1)} · {view.names[trick.winner]} · {gameUi(trick.points)}{gameUi(" Punkte")}</strong><div className="sk-review-cards">{trick.plays.map(play => <span key={play.seat}><small>{view.names[play.seat]}</small><CardFace card={play.card} cardTheme={cardTheme} /></span>)}</div><p>{gameUi(review.summary)}</p>{review.actual && review.suggested && <p>{gameUi("Deine Karte: ")}<b>{gameUi(cardName(review.actual))}</b>. {gameUi(review.actual.id === review.suggested.id ? "Passt zur Empfehlung." : <>{gameUi("Empfehlung aus damaliger Sicht: ")}<b>{gameUi(cardName(review.suggested))}</b>.</>)} {gameUi(!review.withinRules && "Weicht von den Bot-Grundsätzen ab.")}</p>}{review.lessons.map(item => <details key={item.id}><summary>{gameUi(item.code)} · {gameUi(item.kind === "rule" ? "Regel" : "Tipp")} · {gameUi(item.title)}</summary><p>{gameUi(item.text)}</p></details>)}</li>;
  })}</ol> : <p>{gameUi("Noch kein Stich gespielt.")}</p>}</>;
  return <main className={`sk-page sk-game-page ${fullscreen ? "sk-immersive" : ""} ${appFullscreen ? "sk-app-fullscreen" : ""} ${simpleInterface ? `sk-interface-simple sk-simple-background-${simpleBackground}` : `sk-ambience-${ambience}`} ${hidePlayers ? "sk-hide-players" : ""}`} ref={pageRef} style={{ "--sk-own-card-scale": ownCardScale / 100, "--sk-trick-card-scale": trickCardScale / 100 } as CSSProperties}>
    {!simpleInterface && <SchafkopfNameplates scene={ambience} pageRef={pageRef} labels={{ south: { name: view.names[view.seat], role: partyFor(view.seat), glow: teamsKnown }, west: { name: view.names[(view.seat + 1) % 4], role: partyFor((view.seat + 1) % 4), glow: teamsKnown }, north: { name: view.names[(view.seat + 2) % 4], role: partyFor((view.seat + 2) % 4), glow: teamsKnown }, east: { name: view.names[(view.seat + 3) % 4], role: partyFor((view.seat + 3) % 4), glow: teamsKnown } }} knocked={{ south: Boolean(view.legenDecisions?.[view.seat]), west: Boolean(view.legenDecisions?.[(view.seat + 1) % 4]), north: Boolean(view.legenDecisions?.[(view.seat + 2) % 4]), east: Boolean(view.legenDecisions?.[(view.seat + 3) % 4]) }} spritzed={{ south: (view.spritzSeats ?? []).includes(view.seat), west: (view.spritzSeats ?? []).includes((view.seat + 1) % 4), north: (view.spritzSeats ?? []).includes((view.seat + 2) % 4), east: (view.spritzSeats ?? []).includes((view.seat + 3) % 4) }} cardCounts={{ south: view.counts[view.seat], west: view.counts[(view.seat + 1) % 4], north: view.counts[(view.seat + 2) % 4], east: view.counts[(view.seat + 3) % 4] }} />}
    <header className="sk-header sk-game-menu"><div className="sk-game-menu-title"><strong title={gameUi(subtitle ?? "Schafkopf")}>{gameUi("Schafkopf")}</strong><span>{gameUi("Runde ")}{gameUi(view.round)}{gameUi(view.contract ? ` · ${contractName(view.contract)}` : "")}</span></div><nav className="sk-header-actions" aria-label={gameUi("Schafkopf-Menü")}>
      {popupMenuItems.map(({ section, Icon }) => <button key={section} className="sk-button sk-secondary sk-icon-button sk-menu-icon" onClick={() => openMenu(section)} aria-label={gameUi(`${menuSections[section].label} öffnen`)} title={gameUi(menuSections[section].label)}><Icon size={19} /><span>{gameUi(menuSections[section].label)}</span><span className="sk-menu-tooltip" role="tooltip">{gameUi(menuSections[section].label)}</span></button>)}
      <button className="sk-button sk-secondary sk-icon-button sk-menu-icon" onClick={() => openReview("tricks")} aria-label={gameUi("Stich-Review öffnen")} title={gameUi("Stich-Review")}><Layers3 size={19} /><span>{gameUi("Stich-Review")}</span><span className="sk-menu-tooltip" role="tooltip">{gameUi("Stich-Review")}</span></button>
      <button className="sk-button sk-secondary sk-fullscreen-button" onClick={() => void toggleFullscreen()} aria-label={gameUi(fullscreen ? "Vollbild verlassen" : "Vollbild")} title={gameUi(fullscreen ? "Vollbild verlassen" : "Vollbild")}>{fullscreen ? <Minimize size={16} /> : <Maximize size={16} />}<span>{gameUi(fullscreen ? "Verkleinern" : "Vollbild")}</span></button><Link className="sk-button sk-secondary" to="/games/schafkopf">{gameUi("Menü")}</Link></nav></header>
    {!fullscreen && !simpleInterface && <div className="sk-fullscreen-hint"><Maximize size={15} /><span>{gameUi("Für die beste Sicht am Tisch empfehlen wir den Vollbildmodus.")}</span><button type="button" onClick={() => void toggleFullscreen()}>{gameUi("Vollbild starten")}</button></div>}
    {lesson && !hidden && <details className="sk-learning-banner"><summary><span>{gameUi(lesson.kind === "rule" ? "Regel" : "Tipp")} · {gameUi(lesson.code)}</span><strong>{gameUi(lesson.title)}</strong></summary><p>{gameUi(contextualTip ?? lesson.text)}</p></details>}
    {rulebookOpen && createPortal(<div className="sk-rulebook-backdrop" role="presentation" onMouseDown={() => setRulebookOpen(false)}>
      <section className="sk-rulebook" data-sk-dialog="menu" role="dialog" aria-modal="true" tabIndex={-1} aria-labelledby="sk-rulebook-title" onMouseDown={event => event.stopPropagation()}>
        <header>
          <div><span className="sk-eyebrow">{gameUi("Euer Tisch")}</span><h2 id="sk-rulebook-title">{gameUi(menuSections[menuSection].label)}</h2></div>
          <button className="sk-close-button" onClick={() => setRulebookOpen(false)} aria-label={gameUi(`${menuSections[menuSection].label} schließen`)}><X size={20} /></button>
        </header>
        {gameUi(popupNavigation(menuSection))}
        <SchafkopfCardTabs tabs={menuSections[menuSection].tabs} selected={rulebookTab} onSelect={id => setRulebookTab(id as RulebookTab)} cardTheme={cardTheme} frontImage={cardImage(sortPreviewCards[0], cardTheme)} label={gameUi(`Tabs in ${menuSections[menuSection].label}`)} panelId="sk-menu-panel" idPrefix="sk-menu-tab" />
        <div id="sk-menu-panel" role="tabpanel" aria-labelledby={`sk-menu-tab-${rulebookTab}`} tabIndex={0}>
        <h3 className="sk-menu-panel-title">{gameUi(selectedRulebookTab?.label)}</h3>
        {rulebookTab === "background" && <div className="sk-rule-panel">          <fieldset className="sk-design-setting"><legend>{gameUi("Spielansicht")}</legend><SchafkopfInterfaceSelector value={interfaceMode} onChange={selectInterface} /><small>{gameUi("Schlicht zeigt den Tisch von oben ohne Spielerfiguren: auf Filz oder mit Tischdecke und Brotzeit. Deine Auswahl gilt auf diesem Gerät für alle Spielmodi.")}</small></fieldset>
          <fieldset className="sk-design-setting"><legend>{gameUi("Hintergrund")}</legend><div className="sk-background-options" role="group" aria-label={gameUi("Tischhintergrund")}>
            <button type="button" className={simpleInterface && simpleBackground === "felt" ? "is-selected" : ""} aria-pressed={simpleInterface && simpleBackground === "felt"} onClick={() => selectSimpleBackground("felt")}><span className="sk-background-simple-preview" aria-hidden="true" /><span>{gameUi("Filz")}</span></button>
            <button type="button" className={simpleInterface && simpleBackground === "table" ? "is-selected" : ""} aria-pressed={simpleInterface && simpleBackground === "table"} onClick={() => selectSimpleBackground("table")}><img className="sk-background-table-preview" src="/images/schafkopf-table-topdown.png" alt="" loading="lazy" /><span>{gameUi("Schafkopftisch")}</span></button>
            {([['garden', 'Garten', '/images/schafkopf-garden-first-person.png'], ['beach', 'Strand', '/images/schafkopf-beach-first-person.png'], ['bar', 'Bar', '/images/schafkopf-bar-stools-empty.png'], ['mountain', 'Berghütte', '/images/schafkopf-mountain-balcony.png']] as const).map(([id, label, image]) => <button key={id} type="button" className={!simpleInterface && ambience === id ? "is-selected" : ""} aria-pressed={!simpleInterface && ambience === id} onClick={() => { setAmbience(id); selectInterface("scene"); }}><img src={image} alt="" loading="lazy" /><span>{gameUi(label)}</span></button>)}
          </div></fieldset>
{!simpleInterface && <Toggle checked={hidePlayers} onChange={checked => { setHidePlayers(checked); try { localStorage.setItem("schafkopf-hide-players", String(checked)); } catch { /* Session choice. */ } }}>{gameUi("Ohne Spielerfiguren")}</Toggle>}<p>{gameUi("Namen, Karten und Ansagen bleiben am Tisch sichtbar.")}</p></div>}
        {rulebookTab === "lexicon" && <div className="sk-rule-panel"><SchafkopfRulebook section="lexicon" renderCard={card => <CardFace card={card} cardTheme={cardTheme} />} />          <fieldset className="sk-announcement-setting">
            <legend>{gameUi("Deine Ansagen")}</legend>
            <p>{gameUi("Ohne eigene Texte werden die gewählten oder zufälligen Formulierungen verwendet. Die Einstellungen gelten nur auf diesem Gerät.")}</p>
            <div className="sk-announcement-grid">
              <label>{gameUi("Spielabsicht")}<select value={announcementPreference} onChange={event => { setAnnouncementPreference(event.target.value); try { localStorage.setItem("schafkopf-play-announcement", event.target.value); } catch { /* Keep this selection for the session. */ } }}><option value="random">{gameUi("Zufällig")}</option>{PLAY_PHRASES.map(phrase => <option key={phrase} value={phrase}>{gameUi(phrase)}</option>)}</select></label>
              <label>{gameUi("Eigener Text für „Spielen“")}<input maxLength={100} value={announcementSettings.custom.intent} onChange={event => setCustomAnnouncement("intent", event.target.value)} placeholder={gameUi("Zum Beispiel: I dad scho!")} /></label>
              <label>{gameUi("Vorsatz beim Suchen")}<select value={announcementSettings.callPrefix} onChange={event => updateAnnouncementSettings(current => ({ ...current, callPrefix: event.target.value as AnnouncementSettings["callPrefix"] }))}><option value="random">{gameUi("Zufällig")}</option><option value="auf">{gameUi("I spui auf die …")}</option><option value="mit">{gameUi("I spui mit der …")}</option><option value="none">{gameUi("Ohne Vorsatz")}</option></select></label>
              <label>{gameUi("Solo ansagen als")}<select value={announcementSettings.soloWord} onChange={event => updateAnnouncementSettings(current => ({ ...current, soloWord: event.target.value as AnnouncementSettings["soloWord"] }))}><option value="random">{gameUi("Zufällig")}</option><option value="Solo">{gameUi("Farbe-Solo")}</option><option value="Sticht">{gameUi("Farbe-Sticht")}</option></select></label>
            </div>
            <div className="sk-call-settings">{(["Eichel", "Gras", "Schellen"] as const).map(suit => <div key={suit}><label>{gameUi(suit)}{gameUi("-Ass nennen als")}<select value={announcementSettings.callNames[suit]} onChange={event => updateAnnouncementSettings(current => ({ ...current, callNames: { ...current.callNames, [suit]: event.target.value } }))}><option value="random">{gameUi("Zufällig")}</option>{CALL_NAME_OPTIONS[suit].map(option => <option key={option.id} value={option.id}>{gameUi(option.label)}</option>)}</select></label><label>{gameUi("Eigene Ansage für ")}{gameUi(suit)}{gameUi("-Ass")}<input maxLength={100} value={announcementSettings.custom[suit]} onChange={event => setCustomAnnouncement(suit, event.target.value)} placeholder={gameUi("Leer = Name und Vorsatz verwenden")} /></label></div>)}</div>
            <label>{gameUi("Eigene Spielansage")}<input maxLength={100} value={announcementSettings.custom.solo} onChange={event => updateAnnouncementSettings(current => ({ ...current, custom: { ...current.custom, solo: event.target.value, wenz: event.target.value, farbwenz: event.target.value, other: event.target.value } }))} placeholder={gameUi("Leer = gewählter Spielname")} /></label>
            <small>{gameUi("Beim Überfahren einer Spielansage siehst du den eindeutigen Spielnamen, beim Sauspiel das gerufene Ass.")}</small>
          </fieldset>
</div>}
        {rulebookTab === "costs" && <div className="sk-rule-panel sk-rulebook-grid"><fieldset disabled={!onRulesChange}>            <legend>{gameUi("Grundwerte in Cent")}</legend>{(["rufspielValue", "soloValue", "wenzValue", "farbwenzValue", "geierValue", "farbgeierValue", "bettelValue", "ramschValue", "schneiderValue", "schwarzValue", "laufendeValue"] as const).map(value => <label key={value}>{gameUi({ rufspielValue: "Sauspiel", soloValue: "Solo", wenzValue: "Wenz", farbwenzValue: "Farbwenz", geierValue: "Geier", farbgeierValue: "Farbgeier", bettelValue: "Bettel", ramschValue: "Ramsch", schneiderValue: "Schneider", schwarzValue: "Schwarz", laufendeValue: "Je Laufendem" }[value])}<input type="number" min={value === "schneiderValue" || value === "schwarzValue" || value === "laufendeValue" ? 0 : 1} max="999" value={rulebook[value] ?? rulebook.soloValue} onChange={event => updateRulebook(current => ({ ...current, farbwenzValue: current.farbwenzValue ?? current.soloValue, geierValue: current.geierValue ?? current.soloValue, farbgeierValue: current.farbgeierValue ?? current.soloValue, bettelValue: current.bettelValue ?? current.soloValue, [value]: Math.min(999, Math.max(value === "schneiderValue" || value === "schwarzValue" || value === "laufendeValue" ? 0 : 1, Number(event.target.value) || 0)) }))} /></label>)}<p>{gameUi("Tout verdoppelt den jeweiligen Spielwert. Sie vervierfacht den Solo-Tarif einschließlich der Laufenden. Klopfen und Spritzen verdoppeln zusätzlich.")}</p></fieldset></div>}
        {rulebookTab === "level" && <div className="sk-rule-panel"><fieldset className="sk-ai-difficulty-setting"><legend>{gameUi("Dein Level")}</legend><label>{gameUi("Lernstufe")}<select value={ownLevel} onChange={event => { const level = event.target.value as AiDifficulty; setOwnLevel(level); try { localStorage.setItem("schafkopf-own-level", level); } catch { /* Session choice. */ } }}>{AI_DIFFICULTY_OPTIONS.map(option => <option key={option.id} value={option.id}>{gameUi(option.label)}</option>)}</select></label><p>{gameUi("Anfänger bis Fortgeschritten erhalten Lernhinweise während des Spiels. Dein Level und die Bot-Stufe können unabhängig eingestellt werden.")}</p></fieldset>          {aiDifficulty && <fieldset className="sk-ai-difficulty-setting"><legend>{gameUi("KI-Schwierigkeit")}</legend><label htmlFor="sk-ai-difficulty">{gameUi("Spielstärke")}<select id="sk-ai-difficulty" value={aiDifficulty} disabled={!onAiDifficultyChange || busy} onChange={event => onAiDifficultyChange?.(event.target.value as AiDifficulty)}>{AI_DIFFICULTY_OPTIONS.map(option => <option key={option.id} value={option.id}>{gameUi(option.label)}</option>)}</select></label><small>{gameUi(onlineSession && !onAiDifficultyChange ? "Die Bot-Stufe stellt der Gastgeber ein. " : "")}{gameUi("Anfänger spielt regelgerecht, entscheidet sich aber oft für die schwächere Karte. Profi und Legende beachten Punkte und bereits gespielte Trümpfe.")}</small></fieldset>}
</div>}
        {rulebookTab === "players" && <div className="sk-rule-panel"><div className="sk-player-settings">{view.names.map((name, seat) => <section className="sk-player-setting" key={seat}><h3>{gameUi(seat === view.seat ? "Dein Platz" : `Platz ${seat + 1}`)}</h3>{(onRename || onlineSession && seat === view.seat) ? <label>{gameUi("Name")}<input value={draftNames[seat] ?? name} maxLength={24} onChange={event => setDraftNames(current => current.map((value, index) => index === seat ? event.target.value : value))} /></label> : <strong>{name}</strong>}{!simpleInterface && <div className="sk-avatar-options" role="group" aria-label={gameUi(`Avatar für ${name}`)}>{avatars.map((avatar, index) => <button key={avatar.id} type="button" disabled={onlineSession && (seat !== view.seat || !onAvatarSave)} className={`sk-avatar-option ${draftAvatars[seat] === index ? "is-selected" : ""}`} aria-label={gameUi(avatar.name)} aria-pressed={draftAvatars[seat] === index} onClick={() => setDraftAvatars(current => current.map((value, i) => i === seat ? index : value))}><img src={`/images/schafkopf/avatars/${avatar.id}.png`} alt="" loading="lazy" /></button>)}</div>}</section>)}</div><p>{gameUi(simpleInterface ? "Änderungen an Namen werden erst beim Speichern aktiv." : onlineSession ? "Jeder Mitspieler wählt seinen eigenen Avatar. Änderungen werden nach dem Speichern für alle sichtbar." : "Änderungen an Namen und Avataren werden erst beim Speichern aktiv.")}</p><div className="sk-actions"><button className="sk-button" disabled={savingPlayers || onlineSession && busy || draftNames.some(name => !name.trim())} onClick={() => void savePlayers()}>{gameUi(savingPlayers ? "Wird gespeichert …" : "Speichern")}</button><button className="sk-button sk-secondary" onClick={() => setRulebookOpen(false)}>{gameUi("Abbrechen")}</button></div>{error && <p className="sk-error" role="alert">{gameUi(error)}</p>}</div>}
        {rulebookTab === "bots" && <div className="sk-rule-panel"><SchafkopfRulebook section="bots" renderCard={card => <CardFace card={card} cardTheme={cardTheme} />} /><details><summary>{gameUi("Bot-Verhalten im Detail einstellen")}</summary><SchafkopfBotSettings value={botConfig(rulebook.bot)} disabled={!onRulesChange} onChange={bot => updateRulebook(current => ({ ...current, bot }))} /></details></div>}
        {rulebookTab === "basics" && <div className="sk-rule-panel"><SchafkopfRulebook section="basics" renderCard={card => <CardFace card={card} cardTheme={cardTheme} />} /></div>}
        {rulebookTab === "tips" && <div className="sk-rule-panel"><SchafkopfRulebook section="tips" renderCard={card => <CardFace card={card} cardTheme={cardTheme} />} /></div>}
        {rulebookTab === "sounds" && <div className="sk-rule-panel sk-sound-panel"><div className="sk-sound-heading"><div><h3>{gameUi("Klänge am Tisch")}</h3><p>{gameUi("Hier kannst du Klaviermusik, Ansagen und Spielgeräusche wie Mischen, Kartenlegen und Klopfen getrennt einstellen oder ganz ausschalten. Ansagen bleiben vorerst stumm, bis natürliche bayerische Audiodateien verfügbar sind.")}</p></div><button type="button" className="sk-button sk-secondary sk-sound-mute" aria-pressed={sounds.muted} onClick={sounds.toggleMute}>{gameUi(sounds.muted ? "Ton an" : "Stumm")}</button></div><div className="sk-sound-selection"><label>{gameUi("Musik-Auswahl")}<select value={sounds.selection.music} onChange={event => sounds.selectSound("music", event.target.value as "piano" | "soft")}><option value="piano">{gameUi("Klaviermelodie")}</option><option value="soft">{gameUi("Sanfte Melodie")}</option></select></label><label>{gameUi("Spielgeräusche")}<select value={sounds.selection.effects} onChange={event => sounds.selectSound("effects", event.target.value as "classic" | "soft")}><option value="classic">{gameUi("Klassisch")}</option><option value="soft">{gameUi("Dezent")}</option></select></label></div>{([ ["music", "Musik"], ["announcements", "Ansagen"], ["effects", "Spielgeräusche"] ] as [keyof SoundSettings, string][]).map(([key, label]) => <label key={key}>{gameUi(label)}<input type="range" min="0" max="100" disabled={key === "announcements"} value={sounds.settings[key]} onChange={event => sounds.update(key, Number(event.target.value))} aria-label={gameUi(`${label} Lautstärke`)} /><output>{gameUi(sounds.muted ? "stumm" : `${sounds.settings[key]} %`)}</output></label>)}</div>}
        {rulebookTab === "ui" && <div className="sk-rule-panel"><fieldset className="sk-ui-setting"><legend>{gameUi("Kartengröße")}</legend><label htmlFor="sk-own-card-scale"><span>{gameUi("Deine Handkarten")}</span><input id="sk-own-card-scale" type="range" min="75" max="220" step="5" value={ownCardScale} onChange={event => setOwnCardScale(Number(event.target.value))} /><output>{gameUi(ownCardScale)} %</output></label><label htmlFor="sk-trick-card-scale"><span>{gameUi("Karten im aktuellen Stich")}</span><input id="sk-trick-card-scale" type="range" min="75" max="220" step="5" value={trickCardScale} onChange={event => setTrickCardScale(Number(event.target.value))} /><output>{gameUi(trickCardScale)} %</output></label><button type="button" className="sk-button sk-secondary sk-card-scale-reset" onClick={restoreDefaultCardScales}>{gameUi("Standardgröße wiederherstellen")}</button><small>{gameUi("Auf dem Handy sind standardmäßig 200 % für deine Hand und 150 % für Karten im Stich eingestellt; auf größeren Bildschirmen jeweils 100 %.")}</small></fieldset></div>}
        {rulebookTab === "setup" && <div className="sk-rule-panel">
          <div className="sk-deck-options">{cardDecks.map(deck => <button key={deck.id} type="button" data-deck={deck.id} className={`sk-deck-option ${cardTheme === deck.id ? "is-selected" : ""}`} aria-pressed={cardTheme === deck.id} onClick={() => { setCardTheme(deck.id); }}><span className="sk-deck-art"><img src={cardImage({ id: "Herz-König", suit: "Herz", rank: "König" }, deck.id)} alt="" loading="lazy" draggable={false} /><span className="sk-deck-back" aria-hidden="true">✦</span></span><span>{gameUi(deck.name)}</span></button>)}</div>
          <fieldset className="sk-design-setting"><legend>{gameUi("Kartenanordnung")}</legend><div className="sk-hand-layout-toggle" role="group" aria-label={gameUi("Darstellung der Hand")}><button type="button" className={handLayout === "spread" ? "is-selected" : ""} aria-pressed={handLayout === "spread"} onClick={() => setHandLayout("spread")}><LayoutGrid size={15} />{gameUi("Nebeneinander")}</button><button type="button" className={handLayout === "stack" ? "is-selected" : ""} aria-pressed={handLayout === "stack"} onClick={() => setHandLayout("stack")}><Rows3 size={15} />{gameUi("Gerade")}</button><button type="button" className={handLayout === "fan" ? "is-selected" : ""} aria-pressed={handLayout === "fan"} onClick={() => setHandLayout("fan")}><Fan size={15} />{gameUi("Halbkreis")}</button></div><HandSortPreview layout={handLayout} cardTheme={cardTheme} /><small>{gameUi("Die Vorschau zeigt die gewählte Anordnung mit nach Trumpf und Wert sortierten Karten. Automatisches Sortieren gilt nur beim Austeilen; danach kannst du Karten verschieben.")}</small></fieldset>
          <fieldset className="sk-collect-setting"><legend>{gameUi("Stiche einsammeln")}</legend><label htmlFor="sk-collect-seconds">{gameUi("Wartezeit ")}<input id="sk-collect-seconds" type="range" min="1" max="10" step="1" value={collectSeconds} disabled={busy || onlineSession && !onCollectSecondsChange} onChange={event => { const seconds = Number(event.target.value); if (onlineSession) setCollectSecondsDraft(seconds); else { onCollectSecondsChange?.(seconds); try { localStorage.setItem("schafkopf-collect-seconds", String(seconds)); } catch { /* Keep this session's choice. */ } } }} onPointerUp={event => commitCollectSeconds(Number(event.currentTarget.value))} onKeyUp={event => commitCollectSeconds(Number(event.currentTarget.value))} /><output htmlFor="sk-collect-seconds">{gameUi(collectSeconds)} s</output></label><span className="sk-info-hover" tabIndex={0} aria-label={gameUi("Stiche können jederzeit im Stich-Review nachträglich angesehen werden")}><Info size={15} /><span role="tooltip">{gameUi("Alle gespielten Stiche kannst du jederzeit im Stich-Review nachträglich ansehen.")}{gameUi(onlineSession && !onCollectSecondsChange ? " Die Wartezeit stellt der Gastgeber ein." : "")}</span></span></fieldset>
        </div>}
        {rulebookTab === "custom" && <div className="sk-rule-panel">
          <p>{gameUi("Solo und Wenz sind immer erlaubt. Sauspiel und Farbwenz sind als Standard aktiv; weitere Varianten kannst du für eure Runde wählen.")}</p>
          <fieldset disabled={!onRulesChange} className="sk-settings-lock"><div className="sk-rulebook-grid">
            <fieldset><legend>{gameUi("Erlaubte Spiele")}</legend><Toggle checked disabled>{gameUi("Solo")}</Toggle><Toggle checked disabled>{gameUi("Wenz")}</Toggle><Toggle checked={rulebook.sauspiel} onChange={checked => updateRulebook(current => ({ ...current, sauspiel: checked }))}>{gameUi("Sauspiel")}</Toggle>{(["farbwenz", "geier", "farbgeier", "hochzeit", "bettel"] as const).map(game => <Toggle key={game} checked={game === "hochzeit" ? false : rulebook[game]} disabled={game === "hochzeit"} onChange={checked => updateRulebook(current => ({ ...current, [game]: checked }))}>{gameUi({ farbwenz: "Farbwenz", geier: "Geier", farbgeier: "Farbgeier", hochzeit: "Hochzeit · Ablauf noch zu klären", bettel: "Bettel" }[game])}</Toggle>)}</fieldset>
            <fieldset><legend>{gameUi("Rundenregeln")}</legend><Toggle checked={rulebook.ramsch} onChange={checked => updateRulebook(current => ({ ...current, ramsch: checked }))}>{gameUi("Ramsch nach viermal Weiter")}</Toggle><small>{gameUi("Bei einer Jungfrau ohne Stich erhält dieser Spieler im Ramsch den doppelten Betrag.")}</small><Toggle checked={rulebook.eichelOberMuss} onChange={checked => updateRulebook(current => ({ ...current, eichelOberMuss: checked }))}>{gameUi("Eichel-Ober muss spielen, wenn alle weiter sagen")}</Toggle><Toggle checked={alwaysLegen || rulebook.legen} disabled={alwaysLegen} onChange={checked => updateRulebook(current => ({ ...current, legen: checked }))}>{gameUi(alwaysLegen ? "Legen · im Einzelspieler immer aktiv" : "Legen ab der nächsten Runde")}</Toggle><Toggle checked={rulebook.spritzen !== "nie"} onChange={checked => updateRulebook(current => ({ ...current, spritzen: checked ? "jederzeit" : "nie" }))}>{gameUi("Spritzen · Kontra, Re, Sub, Hirsch")}</Toggle></fieldset>
            <fieldset><legend>{gameUi("Anzeigen")}</legend><Toggle checked={rulebook.showPoints} onChange={checked => updateRulebook(current => ({ ...current, showPoints: checked }))}>{gameUi("Punktestand anzeigen")}</Toggle><Toggle checked={rulebook.showTrickPoints} onChange={checked => updateRulebook(current => ({ ...current, showTrickPoints: checked }))}>{gameUi("Punkte je Stichstapel anzeigen")}</Toggle><Toggle checked={rulebook.showPlayedTrumps} onChange={checked => updateRulebook(current => ({ ...current, showPlayedTrumps: checked }))}>{gameUi("Gespielte Trümpfe zählen")}</Toggle><small>{gameUi("Der Trumpfzähler ist standardmäßig ausgeschaltet.")}</small></fieldset>

          </div>
          <fieldset className="sk-document-options"><legend>{gameUi("Hausregeln aus dem Dokument")}</legend>
            <Toggle checked={rulebook.davonlaufen !== false} onChange={checked => updateRulebook(current => ({ ...current, davonlaufen: checked }))}>{gameUi("Davonlaufen erlauben")}</Toggle>
            <Toggle checked={rulebook.toutAbbrechen !== false} onChange={checked => updateRulebook(current => ({ ...current, toutAbbrechen: checked }))}>{gameUi("Verlorenen Tout nach dem ersten verlorenen Stich beenden")}</Toggle>
            <p>{gameUi("Die letzte Spritzpartei braucht immer 61 Punkte zum Sieg und 31 für schneiderfrei. Tout zählt ×2, Sie ×4; beide ohne Schneider-/Schwarz-Zuschlag.")}</p>
            <Toggle checked={rulebook.laufendeAktiv !== false} onChange={checked => updateRulebook(current => ({ ...current, laufendeAktiv: checked }))}>{gameUi("Laufende werten")}</Toggle>
            <Toggle checked={rulebook.klopferMussSpiel !== false} onChange={checked => updateRulebook(current => ({ ...current, klopferMussSpiel: checked }))}>{gameUi("Letzter Klopfer muss nach viermal Weiter spielen")}</Toggle>
            <small>{gameUi("Ohne Muss-Spiel gelten Ramsch oder Eichel-Ober-Pflichtspiel gemäß den Rundenregeln, einschließlich sämtlicher Klopfverdopplungen. Sind beide aus, wird zusammengeworfen.")}</small>
            {([["rufsauAbwerfenAbStich","Rufsau abwerfen ab Stich",7,1,8],["laufendeAbFarbspiel","Laufende im Farbspiel ab",3,1,14],["laufendeAbWenzGeier","Laufende im Wenz/Geier ab",2,1,4],["hotseatKlopfSekunden","Hotseat · Klopfzeit (Sekunden)",20,5,180],["multiplayerKlopfSekunden","Multiplayer · Klopfzeit (Sekunden)",30,5,180]] as const).map(([key,label,fallback,min,max]) => <label key={key}>{gameUi(label)}<input type="number" min={min} max={max} value={rulebook[key] ?? fallback} onChange={event => updateRulebook(current => ({ ...current, [key]: Math.max(min,Math.min(max,Number(event.target.value))) }))}/></label>)}
          </fieldset>
          </fieldset>
          {!onRulesChange && <p>{gameUi("Die Tischregeln legt der Gastgeber fest.")}</p>}
          <p className="sk-rulebook-note">{gameUi("Die Werte werden gespeichert. Klopfzeiten gelten ab dem nächsten Geben. Im Einzelspieler bleibt Klopfen ohne Zeitlimit; die Zug-Erinnerung kommt nach 60 Sekunden.")}</p>
        </div>}
        </div>
      </section>
    </div>, scoreDialogContainer)}
    {gameUi(difficultyOffer && createPortal(<div className="sk-rulebook-backdrop sk-difficulty-offer"><section className="sk-score-dialog" data-sk-dialog="difficulty" tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="sk-level-offer-title"><h2 id="sk-level-offer-title">{gameUi("Bereit für die nächste Stufe?")}</h2><p>{gameUi("Du hast weitere 20 Spiele auf der Bot-Stufe ")}{gameUi(AI_DIFFICULTY_OPTIONS.find(option => option.id === aiDifficulty)?.label)}{gameUi(" gewonnen. Möchtest du die Bots auf ")}{gameUi(AI_DIFFICULTY_OPTIONS.find(option => option.id === difficultyOffer)?.label)}{gameUi(" erhöhen?")}</p><div className="sk-actions"><button className="sk-button" onClick={() => { onAiDifficultyChange?.(difficultyOffer); setDifficultyOffer(null); }}>{gameUi("Schwierigkeit erhöhen")}</button><button className="sk-button sk-secondary" onClick={() => setDifficultyOffer(null)}>{gameUi("Später")}</button></div></section></div>, scoreDialogContainer))}
    {fullscreenError && <p className="sk-error" role="alert">{gameUi(fullscreenError)}</p>}
    {(scoreboardVisible || reviewOpen || announcementsOpen) && !rulebookOpen && !tipOpen && !helpOpen && !sortMenuOpen && createPortal(<div className="sk-rulebook-backdrop sk-scoreboard-backdrop" role="presentation" onMouseDown={done ? undefined : () => { setScoreboardOpen(false); setReviewOpen(false); setAnnouncementsOpen(false); }}>
      <section data-sk-score-dialog data-sk-dialog={dialogKey ?? "score"} tabIndex={-1} className={`sk-score-dialog sk-review-hub ${selectedReviewTab === "score" ? "sk-ledger-dialog sk-bavarian-ledger-book" : "sk-review-dialog"} ${done && selectedReviewTab === "score" ? "sk-bavarian-summary" : ""}`} role="dialog" aria-modal="true" aria-labelledby="sk-score-title" onMouseDown={event => event.stopPropagation()}>
        <div className={selectedReviewTab === "score" ? "sk-bavarian-ledger-page" : ""}>
        <header><div><span className="sk-eyebrow">{gameUi("Runde ")}{gameUi(view.round)}</span><h2 id="sk-score-title">{gameUi(done ? "Spiel-Zusammenfassung" : "Stich-Review")}</h2></div>{!done && <button className="sk-close-button" onClick={() => { setScoreboardOpen(false); setReviewOpen(false); setAnnouncementsOpen(false); }} aria-label={gameUi("Stich-Review schließen")}><X size={20} /></button>}</header>
        {done && <GameXpReward amount={onlineSession && view.phase === "finished" ? 100 : 0} />}
        {gameUi(popupNavigation("review"))}
        {gameUi(reviewNavigation)}
        <div id="sk-review-panel" role="tabpanel" aria-labelledby={`sk-review-tab-${selectedReviewTab}`} tabIndex={0}>
        {selectedReviewTab === "tricks" && <>{gameUi(reviewCounters)}{gameUi(reviewContent)}</>}
        {selectedReviewTab === "score" && <><Toggle checked={ledgerInk === "pencil"} onChange={checked => setLedgerInk(checked ? "pencil" : "pen")}>{gameUi(ledgerInk === "pencil" ? "Bleistift" : "Kugelschreiber")}</Toggle>
        {rulebook.showPoints && <div className="sk-team-scores" aria-label={gameUi("Punktestand")}>{teamsKnown ? <><div><span>{gameUi("Spieler · ")}{playingSeats.map(seat => view.names[seat]).join(" & ")}</span><strong>{gameUi(teamEyes(playingSeats))}{gameUi(" Punkte")}</strong></div><div><span>{gameUi("Gegenspieler · ")}{opposingSeats.map(seat => view.names[seat]).join(" & ")}</span><strong>{gameUi(teamEyes(opposingSeats))}{gameUi(" Punkte")}</strong></div></> : view.names.map((name, seat) => <div key={seat}><span>{name}</span><strong>{gameUi(view.points[seat])}{gameUi(" Punkte")}</strong></div>)}</div>}
        {done && latestLedgerEntry?.price && <section className="sk-score-breakdown" aria-label={gameUi("Berechnung des Spielwerts")}><strong>{gameUi("Spielwert · Runde ")}{gameUi(latestLedgerEntry.round)}</strong><span>{gameUi(latestLedgerEntry.price)}</span></section>}
        <div className={`sk-ledger-paged sk-ledger-ink-${ledgerInk}`}><div className="sk-ledger-scroll"><table className="sk-ledger"><thead><tr>{view.names.map((name, seat) => <th scope="col" key={seat}>{name}</th>)}</tr></thead><tbody>
          {visibleLedgerEntries.map((entry, index) => { const entryNumber = currentLedgerPage * GAMES_PER_LEDGER_SHEET + index + 1; return <tr key={`${entry.round}-${index}`} className={[entryNumber === ledgerEntries.length ? "sk-ledger-latest" : "", entryNumber % GAMES_PER_ROUND === 0 && entryNumber < ledgerEntries.length ? "sk-ledger-round-end" : ""].filter(Boolean).join(" ")}>
            {entry.deltas.map((amount, seat) => <td key={seat}>{gameUi(formatLedgerAmount(amount))}</td>)}
          </tr>; })}
          <tr className="sk-ledger-total">{view.totals.map((amount, seat) => <td key={seat}><strong>{gameUi(formatLedgerAmount(amount))}</strong></td>)}</tr>
        </tbody></table></div>{ledgerPageCount > 1 && <nav className="sk-ledger-pagination" aria-label={gameUi("Seiten des Wirtshauszettels")}><button type="button" className="sk-button sk-secondary sk-ledger-page-arrow sk-ledger-page-arrow-previous" aria-label={gameUi("Vorheriges Blatt")} disabled={currentLedgerPage === 0} onClick={() => setLedgerPage(page => Math.max(0, (page ?? ledgerPageCount - 1) - 1))}><ChevronLeft size={25} aria-hidden="true" /></button><span className="sk-visually-hidden">{gameUi("Blatt ")}{gameUi(currentLedgerPage + 1)}{gameUi(" von ")}{gameUi(ledgerPageCount)}{gameUi(" · 4 Runden · 16 Spiele")}</span><button type="button" className="sk-button sk-secondary sk-ledger-page-arrow sk-ledger-page-arrow-next" aria-label={gameUi("Nächstes Blatt")} disabled={currentLedgerPage === ledgerPageCount - 1} onClick={() => setLedgerPage(page => Math.min(ledgerPageCount - 1, (page ?? ledgerPageCount - 1) + 1))}><ChevronRight size={25} aria-hidden="true" /></button></nav>}</div>
        <section className={`sk-ledger-notepad sk-ledger-notepad-${ledgerInk}`} aria-labelledby="sk-ledger-notepad-title">
          <div className="sk-ledger-notepad-heading"><div><span aria-hidden="true">🥨</span><h3 id="sk-ledger-notepad-title">{gameUi("Notizblock")}</h3></div><span>{gameUi(ledgerInk === "pencil" ? "Bleistift" : "Kugelschreiber")}</span></div>
          <textarea value={ledgerNote} onChange={event => setLedgerNote(event.target.value.slice(0, 1000))} placeholder={gameUi("Eigene Notizen zum Spieltag …")} aria-label={gameUi("Eigene Notizen zum Spieltag")} />
        </section>

        {!done && onlineSession && <SchafkopfSessions currentCode={onlineCode} />}</>}
        {gameUi(selectedReviewTab === "announcements" && (view.announcements.length ? <ol className="sk-log sk-compact-announcements">{view.announcements.map((text, index) => <li key={index} title={gameUi(view.announcementTitles?.[index] ? `Standardform: ${view.announcementTitles[index]}` : undefined)}>{gameUi(text)}</li>)}</ol> : <p>{gameUi("Noch keine Ansage.")}</p>))}
        </div>
        {done && <footer className="sk-ledger-actions"><Link className="sk-button sk-menu-return" to="/games/schafkopf">{gameUi("Menü")}</Link><button className="sk-button" disabled={busy || !allowNext} title={gameUi(allowNext ? undefined : "Nur der Gastgeber kann ein neues Spiel starten.")} onClick={() => { setLedgerPage(null); setReviewOpen(false); setAnnouncementsOpen(false); setScoreboardOpen(false); dispatch({ type: "next" }); }}>{gameUi("Neues Spiel")}</button></footer>}
        </div>
      </section>
    </div>, scoreDialogContainer)}
    {gameUi(tipOpen && createPortal(<div className="sk-rulebook-backdrop" onMouseDown={() => setTipOpen(false)}><section className="sk-score-dialog sk-help-dialog" data-sk-dialog="tip" role="dialog" aria-modal="true" tabIndex={-1} aria-labelledby="sk-live-tip-title" onMouseDown={event => event.stopPropagation()}><header><h2 id="sk-live-tip-title">{gameUi("Tipp zum aktuellen Stich")}</h2><button className="sk-close-button" onClick={() => setTipOpen(false)} aria-label={gameUi("Tipp schließen")}><X size={20} /></button></header><p>{gameUi(hidden ? "Zeige zuerst deine Hand, um einen Tipp zu erhalten." : contextualTip ?? phaseHelp[0] ?? "Warte, bis du am Zug bist. Dann erhältst du eine Empfehlung zu deiner Hand und zum aktuellen Stich.")}</p>{!hidden && <div className="sk-review-cards">{view.hand.map(card => <span key={card.id}><CardFace card={card} cardTheme={cardTheme} /></span>)}</div>}</section></div>, scoreDialogContainer))}
    {gameUi(helpOpen && createPortal(<div className="sk-rulebook-backdrop" role="presentation" onMouseDown={() => setHelpOpen(false)}><section className="sk-score-dialog sk-help-dialog" data-sk-dialog="help" role="dialog" aria-modal="true" tabIndex={-1} aria-labelledby="sk-help-title" onMouseDown={event => event.stopPropagation()}><header><h2 id="sk-help-title">{gameUi("Spielhinweise")}</h2><button className="sk-close-button" onClick={() => setHelpOpen(false)} aria-label={gameUi("Spielhinweise schließen")}><X size={20} /></button></header>{phaseHelp.map((message, index) => <p key={index}>{gameUi(message)}</p>)}<p>{gameUi("Tab wechselt zwischen Bereichen. In deiner Hand wählst du mit ← / →, Pos1 und Ende eine Karte; Enter oder Leertaste spielt sie. Mit Alt + ← / → verschiebst du eine Karte. Escape schließt Dialoge.")}</p></section></div>, scoreDialogContainer))}
    {gameUi(turnReminderOpen && !rulebookOpen && !tipOpen && !helpOpen && !sortMenuOpen && !reviewOpen && !announcementsOpen && !scoreboardVisible && createPortal(<div className="sk-rulebook-backdrop sk-turn-reminder-backdrop" role="presentation" onMouseDown={() => setTurnReminderRevision(-1)}><section className="sk-score-dialog sk-turn-reminder" data-sk-dialog="reminder" role="dialog" aria-modal="true" tabIndex={-1} aria-labelledby="sk-turn-reminder-title" onMouseDown={event => event.stopPropagation()}><h2 id="sk-turn-reminder-title">{gameUi("Du bist an der Reihe")}</h2><p>{gameUi("Wähle deine nächste Aktion.")}</p><button className="sk-button" autoFocus onClick={() => setTurnReminderRevision(-1)}>{gameUi("Verstanden")}</button></section></div>, scoreDialogContainer))}
    <div className="sk-game-stage">
    {!done && <div className="sk-trick-progress" aria-label={gameUi(`Stich ${Math.min(8, view.tricks.length + (view.phase === "trick" ? 0 : 1))} von 8`)}>{gameUi("Stich ")}{gameUi(Math.min(8, view.tricks.length + (view.phase === "trick" ? 0 : 1)))}/8</div>}
    <section className="sk-table" data-deck={cardTheme} aria-label={gameUi("Spieltisch")}>
      {view.names.map((name, seat) => {
        const prefix = `${name}: `;
        const announcementIndex = view.announcements.findLastIndex(text => text.startsWith(prefix));
        const announcement = announcementIndex >= 0 ? view.announcements[announcementIndex].slice(prefix.length) : undefined;
        const position = tablePosition(seat);
        const avatar = avatars[displayedAvatars[seat] ?? 0];
        if (simpleInterface) return <SchafkopfSimpleSeat key={seat} position={position} name={name}
          own={seat === view.seat} active={seat === view.turn && !done} cardCount={view.counts[seat]}
          wonTricks={view.tricks.filter(trick => trick.winner === seat).length} points={teamPointsFor(seat)}
          role={partyFor(seat)} showPoints={activeRules.showTrickPoints} knocked={Boolean(view.legenDecisions?.[seat])}
          spritzed={(view.spritzSeats ?? []).includes(seat)} announcement={announcement}
          canShowPreviousTrick={previousTrick?.winner === seat} onShownTrickChange={show => setShownTrickSeat(show ? seat : null)} />;
        return <SchafkopfSeatOverlay key={seat} seat={seat} ownSeat={view.seat} position={position} name={name} avatar={avatar} active={seat === view.turn} cardCount={view.counts[seat]} announcement={announcement} announcementTitle={view.announcementTitles?.[announcementIndex] ? `Standardform: ${view.announcementTitles[announcementIndex]}` : undefined} wonTricks={view.tricks.filter(trick => trick.winner === seat).length} points={teamPointsFor(seat)} role={partyFor(seat)} showTrickPoints={activeRules.showTrickPoints} previousTrickWinner={previousTrick?.winner} done={done} onShownTrickChange={setShownTrickSeat} />;
      })}
      <div className={`sk-trick ${collectingTrick ? `sk-trick-collecting sk-trick-collecting-${tablePosition(view.turn)}` : ""}`}>{displayTrick.map(play => <div className={`sk-played sk-played-${tablePosition(play.seat)}`} key={play.seat}><CardFace card={play.card} cardTheme={cardTheme} /></div>)}{!displayTrick.length && (simpleInterface ? <span className="sk-simple-table-status">{gameUi(view.contract ? contractName(view.contract) : "Ansage")}<small>{gameUi(done ? "Runde beendet" : `${view.names[view.turn]} ${view.phase === "legen" ? "· Klopfen" : "ist am Zug"}`)}</small></span> : <span className="sk-table-mark" aria-hidden="true">♧</span>)}</div>
      {revealedTrick && <div className="sk-held-trick"><strong>{gameUi("Vorheriger Stich · ")}{view.names[revealedTrick.winner]}</strong><div>{revealedTrick.plays.map(play => <span key={play.seat}><small>{view.names[play.seat]}</small><CardFace card={play.card} cardTheme={cardTheme} /></span>)}</div></div>}
    </section>

    </div>
    {error && <p className="sk-error" role="alert">{gameUi(error)}</p>}
    <section className="sk-hand-area" data-deck={cardTheme}>
      {dealing && <div className="sk-shuffle-overlay sk-hand-deck" aria-live="polite"><div className="sk-shuffle-deck"><span /><span /><span /><span /></div><strong>{view.names[cutterSeat]}{gameUi(" hebt ab")}</strong><small>{view.names[view.dealer]}{gameUi(" gibt die Karten")}</small></div>}
      {!done && !hidden && <><h2 className="sk-visually-hidden">{gameUi("Deine Hand")}</h2><div className={`sk-hand sk-hand-${handLayout}`} data-deck={cardTheme} style={{ "--fan-count": hand.length } as CSSProperties}>{hand.map((card, index) => {
          const locked = view.phase === "play" && mine ? view.locks[card.id] : undefined;
          const playable = active && view.legalCards.includes(card.id);
          return <div className={`sk-hand-slot ${draggingCardId === card.id ? "sk-hand-slot-dragging" : ""}`} key={card.id} style={{ "--fan-angle": `${(index - (hand.length - 1) / 2) * 6}deg`, "--fan-rise": `${Math.abs(index - (hand.length - 1) / 2) * 10}px`, zIndex: draggingCardId === card.id ? 1000 : index + 1 } as CSSProperties} draggable onDragStart={event => { setDraggingCardId(card.id); event.dataTransfer.setData("text/plain", card.id); event.dataTransfer.effectAllowed = "move"; }} onDragEnter={() => { if (draggingCardId && draggingCardId !== card.id) reorderCard(draggingCardId, card.id); }} onDragOver={event => { event.preventDefault(); if (draggingCardId && draggingCardId !== card.id) reorderCard(draggingCardId, card.id); }} onDragEnd={() => setDraggingCardId(null)} onDrop={event => { event.preventDefault(); setDraggingCardId(null); }}><button className={`sk-card ${locked ? "sk-card-locked" : ""}`} data-card-id={card.id} aria-disabled={!playable} tabIndex={(focusedCardId && hand.some(item => item.id === focusedCardId) ? focusedCardId : hand.find(item => view.legalCards.includes(item.id))?.id ?? hand[0]?.id) === card.id ? 0 : -1} onFocus={() => setFocusedCardId(card.id)} onKeyDown={event => {
            const targetIndex = event.key === "ArrowRight" ? Math.min(hand.length - 1, index + 1) : event.key === "ArrowLeft" ? Math.max(0, index - 1) : event.key === "Home" ? 0 : event.key === "End" ? hand.length - 1 : -1;
            if (targetIndex < 0) return;
            event.preventDefault();
            if (event.altKey) reorderCard(card.id, hand[targetIndex].id);
            else pageRef.current?.querySelector<HTMLButtonElement>(`[data-card-id="${hand[targetIndex].id}"]`)?.focus();
          }} aria-describedby="sk-hand-feedback" title={gameUi(locked ?? cardName(card))} aria-label={gameUi(`${cardName(card)}${locked ? ` – gesperrt: ${locked}` : ""}`)} onClick={event => { if (!playable) { setFocusedCardId(card.id); return; } dispatch({ type: "play", cardId: card.id, spritz: view.canDouble && spritzWithCard, phrase: view.canDouble && spritzWithCard ? announcementSettings.custom[(["kontra", "re", "sub", "hirsch"] as const)[spritzCount]].trim() || undefined : undefined }); if (event.detail === 0) requestAnimationFrame(() => pageRef.current?.querySelector<HTMLButtonElement>('.sk-card[tabindex="0"]')?.focus()); }}><CardFace card={card} cardTheme={cardTheme} />{locked && <span className="sk-lock">{gameUi("Gesperrt")}</span>}</button></div>;
        })}{!simpleInterface && ownWonTricks.length > 0 && <button className={`sk-trick-stack sk-trick-stack-hand ${partyFor(view.seat) ? `sk-trick-stack-${partyFor(view.seat) === "Spieler" ? "playing" : "opposing"}` : ""}`} onFocus={() => setShownTrickSeat(view.seat)} onBlur={() => setShownTrickSeat(null)} onPointerDown={() => setShownTrickSeat(view.seat)} onPointerUp={() => setShownTrickSeat(null)} onPointerCancel={() => setShownTrickSeat(null)} onPointerLeave={() => setShownTrickSeat(null)} aria-label={gameUi(`Dein Stichstapel, ${ownWonTricks.length} Stiche${activeRules.showTrickPoints ? `, ${teamsKnown ? ownTeamPoints : view.points[view.seat]} Punkte` : ""}${previousTrick?.winner === view.seat ? "; gedrückt halten, um den vorherigen Stich zu sehen" : ""}`)} disabled={previousTrick?.winner !== view.seat}><span>♠</span><small>{gameUi(ownWonTricks.length)}</small>{activeRules.showTrickPoints && <small className="sk-trick-points">{gameUi(teamsKnown ? ownTeamPoints : view.points[view.seat])}</small>}</button>}</div><p id="sk-hand-feedback" className="sk-hand-feedback" role="status">{gameUi(focusedCardId && hand.some(card => card.id === focusedCardId) ? `${cardName(hand.find(card => card.id === focusedCardId)!)}${view.phase === "play" && view.locks[focusedCardId] ? ` · ${view.locks[focusedCardId]}` : view.phase === "play" && !mine ? " · Warte, bis du am Zug bist." : ""}` : "Deine Hand · ← / → wählen · Enter spielen")}</p><div className="sk-hand-toolbar"><div className="sk-sort-control"><button type="button" className="sk-button sk-secondary sk-icon-button sk-sort-trigger" onClick={() => setSortMenuOpen(open => !open)} aria-expanded={sortMenuOpen} aria-haspopup="dialog" aria-label={gameUi("Karten sortieren")} title={gameUi("Karten sortieren")}><ArrowDownUp size={18} /><span>{gameUi("Sortieren")}</span></button>{gameUi(sortMenuOpen && createPortal(<div className="sk-rulebook-backdrop" onMouseDown={closeSortMenu}><div className="sk-sort-popover sk-sort-dialog" data-sk-dialog="sort" role="dialog" aria-modal="true" tabIndex={-1} aria-label={gameUi("Karten sortieren")} onMouseDown={event => event.stopPropagation()}><div className="sk-sort-popover-heading"><strong>{gameUi("Karten sortieren")}</strong><button type="button" className="sk-close-button" onClick={closeSortMenu} aria-label={gameUi("Sortierauswahl schließen")}><X size={18} /></button></div><button className="sk-button sk-sort-confirm" onClick={() => { setHandLayouts(layouts => ({ ...layouts, [handOrder]: sortedHand.map(card => card.id) })); closeSortMenu(); }} disabled={alreadySorted}><ArrowDownUp size={16} />{gameUi(alreadySorted ? "Bereits sortiert" : "Jetzt sortieren")}</button><label className="sk-auto-sort-setting"><span>{gameUi("Beim Austeilen automatisch sortieren")}</span><input type="checkbox" role="switch" checked={autoSort} onChange={event => changeAutoSort(event.target.checked)} /><span className="sk-auto-sort-track" aria-hidden="true" /></label><small>{gameUi("Sortiert einmal beim Austeilen. Danach kannst du die Karten frei verschieben.")}</small><button type="button" className="sk-sort-design-link" onClick={() => { openMenu("design", "setup"); closeSortMenu(); }}>{gameUi("Kartenanordnung im Design ändern")}</button></div></div>, scoreDialogContainer))}</div><button type="button" className="sk-button sk-secondary sk-icon-button" onClick={() => setHelpOpen(true)} aria-label={gameUi("Spielhinweise und Tastaturbedienung")} title={gameUi("Spielhinweise und Tastaturbedienung")}><BookOpen size={19} /></button><button type="button" className="sk-button sk-secondary sk-icon-button" aria-label={gameUi("Tipp für deine aktuellen Karten")} title={gameUi("Tipp zum aktuellen Stich")} onClick={() => setTipOpen(true)}><Info size={19} /></button></div></>}
    <aside className={`sk-table-sidebar ${canDecideLegen ? "sk-table-sidebar-legen" : ""} ${mine && view.phase === "intent" ? "sk-table-sidebar-intent" : ""} ${mine && view.phase === "declare" ? "sk-table-sidebar-declare" : ""} ${detailStepKey === selectionKey ? "sk-table-sidebar-detail" : ""} ${view.contract && !done ? "sk-table-sidebar-in-game" : ""} ${showTurnNotice && view.phase === "play" && !view.canDouble ? "sk-table-sidebar-turn-only" : ""} ${needsPlayerAction ? "sk-table-sidebar-turn" : ""} ${compactInfo ? "sk-table-sidebar-compact" : ""}`} aria-label={gameUi("Spielaktionen")}>
      {showTurnNotice && <p className="sk-your-turn" role="status">{gameUi("Du bist am Zug")}</p>}
      {onlineSession && mine && turnSecondsLeft !== null && <p className={`sk-action-timer ${turnSecondsLeft === 0 ? "is-expired" : ""}`} role="timer" aria-label={gameUi(`Verbleibende Zugzeit: ${clockText(turnSecondsLeft)}`)}>{gameUi("Zugzeit ")}<strong>{gameUi(clockText(turnSecondsLeft))}</strong>{gameUi(turnSecondsLeft === 0 && " · Bitte ziehe jetzt.")}</p>}
      {activeRules.showPlayedTrumps && view.contract && <p className="sk-trump-counter" aria-live="polite">{gameUi("Trümpfe gespielt: ")}<strong>{gameUi(playedTrumpCount)} / {gameUi(totalTrumpCount)}</strong></p>}
      {view.phase === "trick" && <p className="sk-trick-result">{view.names[view.turn]}{gameUi(" gewinnt den Stich · ")}{gameUi(view.tricks.at(-1)?.points)}{gameUi(" Punkte")}</p>}
      <div className={`sk-table-actions sk-table-actions-${tablePosition(view.turn)}`} aria-live="polite">
        {hidden && !done ? <div className="sk-handoff"><h2>{gameUi("Weitergeben an ")}{view.names[view.seat]}</h2><button className="sk-button" onClick={onReveal}>{gameUi("Ich bin ")}{view.names[view.seat]}{gameUi(" – Karten zeigen")}</button></div> : <>
          {canDecideLegen && <><h2>{gameUi("Mit vier Karten klopfen?")}{!untimedLegen && legenSecondsLeft !== null && <span className={`sk-action-timer sk-legen-timer ${legenSecondsLeft === 0 ? "is-expired" : ""}`} role="timer">{gameUi(clockText(legenSecondsLeft))}</span>}</h2><div className="sk-actions sk-legen-actions"><button className="sk-button" disabled={!legenDecisionActive} onClick={() => dispatch({ type: "legen", knock: true })}>{gameUi("Klopfen · 1 € · ×2")}</button><button className="sk-button sk-secondary" disabled={!legenDecisionActive} onClick={() => dispatch({ type: "legen", knock: false })}>{gameUi("Zweite Hand")}</button></div></>}
          {mine && view.phase === "intent" && <><h2>{gameUi(view.intents.length ? "Möchtest du auch spielen?" : "Möchtest du spielen?")}</h2><div className="sk-actions sk-intent-actions"><button className="sk-button" disabled={!active || !view.canIntent} onClick={() => dispatch({ type: "intent", play: true, phrase: announcementSettings.custom.intent.trim() || (announcementPreference === "random" ? PLAY_PHRASES[Math.floor(Math.random() * PLAY_PHRASES.length)] : announcementPreference) })}>{gameUi(view.intents.length ? "Auch spielen" : "Spielen")}</button><button className="sk-button sk-secondary" disabled={!active} onClick={() => dispatch({ type: "intent", play: false, phrase: announcementSettings.custom.pass.trim() || undefined })}>{gameUi("Weiter")}</button></div></>}
          {mine && view.phase === "auction" && <><h2>{gameUi(view.bidLevel ? `Aktuelles Gebot: ${BID_NAMES[view.bidLevel]}` : "Du bietest zuerst: Nenne deine Spielart.")}</h2><div className="sk-actions">{view.bidLevels.map(level => <button className="sk-button" key={level} disabled={!active} onClick={() => dispatch({ type: "bid", level, phrase: announcementSettings.custom.bid.trim() || undefined })}>{gameUi(BID_NAMES[level])}</button>)}<button className="sk-button sk-secondary" disabled={!active || !view.canPassBid} onClick={() => dispatch({ type: "bid", level: null, phrase: announcementSettings.custom.pass.trim() || undefined })}>{gameUi("Weiter")}</button></div></>}
          {mine && view.phase === "declare" && <>
            {detailStepKey !== selectionKey && <h2>{gameUi("Spielart wählen")}</h2>}
            {view.forcedCallerReason === "legen" && <p className="sk-forced-game-note">{gameUi("Du hast geklopft: Wähle dein Spiel.")}</p>}
            {detailStepKey !== selectionKey ? <div className="sk-contract-kinds" role="group" aria-label={gameUi("Spielart wählen")}>{gameKindOptions.slice(0, 4).map(option => { const available = availableKinds.some(kind => kind.kind === option.kind); return <button type="button" key={option.kind} className="sk-contract-kind" disabled={!active || !available} title={gameUi(available ? option.label : `${option.label} ist mit dieser Hand oder dem aktuellen Gebot nicht möglich`)} onClick={() => { setChosenKind(option.kind); setChosenSuit(""); setChosenDu(false); setDetailStepKey(selectionKey); }}>{gameUi(option.label)}</button>; })}{availableKinds.filter(option => !gameKindOptions.slice(0, 4).some(primary => primary.kind === option.kind)).map(option => <button type="button" key={option.kind} className="sk-contract-kind" disabled={!active} onClick={() => { setChosenKind(option.kind); setChosenSuit(""); setChosenDu(false); setDetailStepKey(selectionKey); }}>{gameUi(option.label)}</button>)}</div> : <>
              {gameUi(view.forcedCallerReason === "eichel-ober" && selectedKind === "rufspiel" ? <div className="sk-suit-picker" role="group" aria-label={gameUi("Gerufene Karte wählen")}><strong>{gameUi("Welche")}<br />{gameUi("Karte?")}</strong><div className="sk-suit-cards">{variants.map(contract => { const rank = contract.calledRank ?? "Ass"; const card: Card = { id: `${contract.suit}-${rank}`, suit: contract.suit!, rank }; const selected = selectedSuit === contract.suit && selectedCallRank === rank; return <button type="button" key={card.id} className={`sk-suit-card ${selected ? "is-selected" : ""}`} aria-pressed={selected} onClick={() => { setChosenSuit(contract.suit!); setChosenCallRank(rank); }}><CardFace card={card} cardTheme={cardTheme} /><span>{gameUi(contract.suit)}-{gameUi(rank)}</span></button>; })}</div></div> : suits.length > 0 && <div className="sk-suit-picker" role="group" aria-label={gameUi(selectedKind === "rufspiel" ? "Gerufene Sau wählen" : "Trumpffarbe wählen")}><strong>{selectedKind === "rufspiel" ? <>{gameUi("Auf welches")}<br />{gameUi("Ass spielst du?")}</> : <>{gameUi("Trumpffarbe")}<br />{gameUi("wählen")}</>}</strong><div className="sk-suit-cards">{SUITS.map(suit => { const enabled = suits.includes(suit); const card: Card = { id: `${suit}-Ass`, suit, rank: "Ass" }; return <button type="button" key={suit} className={`sk-suit-card ${selectedSuit === suit ? "is-selected" : ""}`} disabled={!active || !enabled} aria-pressed={enabled && selectedSuit === suit} aria-label={gameUi(enabled && selectedKind === "rufspiel" ? RUF_SAU_NAMES[suit as Exclude<Suit, "Herz">] : `${suit}${enabled ? "" : " nicht verfügbar"}`)} title={gameUi(enabled ? suit : `${suit} ist für diese Ansage nicht verfügbar`)} onClick={() => { setChosenSuit(suit); setChosenDu(false); }}><CardFace card={card} cardTheme={cardTheme} /><span>{gameUi(suit)}</span></button>; })}</div></div>)}
              {matchingSuitVariants.some(contract => contract.tout) && <Toggle checked={selectedDu} disabled={!matchingSuitVariants.some(contract => !contract.tout)} onChange={setChosenDu}>{gameUi("DU · alle acht Stiche")}</Toggle>}
              <div className="sk-actions sk-contract-confirm"><button className="sk-button sk-secondary" onClick={() => setDetailStepKey("")}>{gameUi("Zurück")}</button><button className="sk-button" disabled={!active || !chosenContract} aria-label={gameUi(chosenContract ? `${contractName(chosenContract)} ansagen` : "Spiel ansagen")} onClick={() => { if (!chosenContract) return; const order = sortHand(view.hand, chosenContract).map(card => card.id); setHandLayouts(layouts => ({ ...layouts, [baseHandOrder]: order, [contractHandOrder]: order })); dispatch({ type: "declare", contract: chosenContract, phrase: formatDeclarationAnnouncement(chosenContract, currentAnnouncementSettings) }); }}>{gameUi("Ansagen")}</button></div>
            </>}
          </>}
          {mine && (view.phase === "kontra" || view.phase === "re") && <><h2>{gameUi(spritzCount === 1 ? "Re geben?" : spritzCount === 2 ? "Re wurde gegeben" : "Kontra geben?")}</h2><div className="sk-actions">{view.canDouble && <button className="sk-button" disabled={!active} onClick={() => dispatch({ type: "double", accept: true, phrase: (spritzCount === 0 ? announcementSettings.custom.kontra : announcementSettings.custom.re).trim() || undefined })}>{gameUi(spritzCount === 0 ? "Kontra" : "Re")}</button>}<button className="sk-button sk-secondary" disabled={!active} onClick={() => dispatch({ type: "double", accept: false })}>{gameUi("Weiter")}</button></div></>}
          {view.phase === "play" && mine && view.canDouble && <div className="sk-spritz-choice"><Toggle checked={spritzWithCard} onChange={setSpritzWithCard}>{gameUi(["I geb a Spritzn!", "Re", "Sub", "Hirsch"][spritzCount])}{gameUi(" mit dieser Karte ansagen")}</Toggle></div>}
          {mine && view.phase === "trick" && <button className="sk-button" disabled={!active} onClick={() => dispatch({ type: "collect" })}>{gameUi("Stich einsammeln")}</button>}
        </>}
            </div>
    </aside>
    {!fullscreen && !simpleInterface && <button type="button" className="sk-button sk-secondary sk-bottom-fullscreen-button" onClick={() => void toggleFullscreen()}><Maximize size={16} />{gameUi("Vollbild starten")}</button>}
      {view.result && <div className="sk-result sk-bavarian-result"><div className="sk-result-garland" aria-hidden="true">✦ · ✦ · ✦</div><span className="sk-result-kicker">{gameUi("Wirtshauszettel · Runde ")}{gameUi(view.round)}</span><h2>{gameUi(view.contract?.kind === "ramsch" ? `Ramsch · ${view.result.team.map(seat => view.names[seat]).join(" & ")} ${view.result.team.length === 1 ? "zahlt" : "zahlen"}` : view.result.declarerWon ? (view.result.team.length === 1 ? "Ois g'winnt · Spieler gewinnt" : "Ois g'winnt · Spieler gewinnen") : "Die Gegenseit ham's g'macht")}</h2><p className="sk-result-score">{gameUi(view.contract?.kind === "ramsch" ? `${view.names.map((name, seat) => `${name}: ${view.points[seat]} Punkte`).join(" · ")}` : `${view.result.team.map(seat => view.names[seat]).join(" & ")} · ${view.result.declarerPoints} : ${view.result.opponentPoints} Punkte`)}</p><p className="sk-result-details">{gameUi(view.contract?.kind === "ramsch" ? `${view.result.ramschDoubleWinners?.length ? `Jungfrau ×2 · ${view.result.ramschDoubleWinners.map(seat => view.names[seat]).join(" & ")} · ` : ""}Ramsch · ` : view.contract?.kind === "sie" ? "Sie · " : view.contract?.tout ? "Tout · " : `${view.result.schwarz ? "Schwarz · " : view.result.schneider ? "Schneider · " : ""}`)}{gameUi(view.contract?.kind !== "ramsch" && `${view.result.laufende} Laufende · `)}{gameUi("Spielwert ")}{gameUi(view.result.value)}</p><div className="sk-result-ledger">{view.names.map((name, seat) => <span key={seat}><small>{name}</small><strong>{gameUi(view.result!.deltas[seat] > 0 ? "+" : "")}{gameUi(view.result!.deltas[seat])}</strong></span>)}</div><small className="sk-result-footer">{gameUi("Der Zettel ist geschrieben. Auf zur nächsten Rund'!")}</small></div>}
    </section>
  </main>;
}
