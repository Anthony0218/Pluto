import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { ArrowDownUp, BookOpen, ChevronLeft, ChevronRight, Fan, Info, LayoutGrid, Layers3, ListOrdered, MessageSquareText, Minimize, Maximize, Palette, Rows3, Settings2, SlidersHorizontal, UsersRound, Volume2, X } from "lucide-react";
import type { CardTheme } from "../../context/CardThemeContext";
import { getWattenCardImage } from "../../utils/WattenCardImages";
import { AI_DIFFICULTY_OPTIONS, BID_NAMES, cardName, collectSecondsFor, contractName, createDeck, isTrump, sortHandForContract as sortHand, DEFAULT_GAME_RULES, PLAY_PHRASES, RUF_SAU_NAMES, SUITS, type Action, type AiDifficulty, type Card, type Contract, type GameRules, type GameView, type Rank, type Suit } from "../../games/schafkopf/schafkopf";
import { CALL_NAME_OPTIONS, DEFAULT_ANNOUNCEMENT_SETTINGS, SIMPLE_ANNOUNCEMENT_SETTINGS, formatDeclarationAnnouncement, normalizeAnnouncementSettings, type AnnouncementSettings, type CustomAnnouncement } from "../../games/schafkopf/announcements";
import { analyzeSchafkopfTrick } from "../../games/schafkopf/coach";
import { randomSchafkopfLesson } from "../../games/schafkopf/lessons";
import { botConfig, seededRandom } from "../../games/schafkopf/botConfig";
import SchafkopfRulebook from "./SchafkopfRulebook";
import SchafkopfBotSettings from "./SchafkopfBotSettings";
import SchafkopfSessions from "./SchafkopfSessions";
import SchafkopfNameplates from "./SchafkopfNameplates";
import { useSchafkopfAudio, type SoundSettings } from "./schafkopfAudio";
import "./schafkopf.css";

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
  return <img src={cardImage(card, cardTheme)} alt={cardName(card)} draggable={false} />;
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
  const avatarStyle = { "--hold-x": avatar.holdX, "--hold-y": avatar.holdY, "--mouth-x": avatar.mouthX, "--mouth-y": avatar.mouthY } as CSSProperties;
  const showOpponent = seat !== ownSeat;
  const canShowPreviousTrick = previousTrickWinner === seat;
  return <div className={`sk-seat-overlay sk-seat-overlay-${position}`}>
    {showOpponent && <div className={`sk-avatar sk-avatar-${position} ${active && !done ? "sk-avatar-active" : ""}`} style={avatarStyle}>
      <img className="sk-avatar-image" src={`/images/schafkopf/avatars/${avatar.id}.png`} alt="" draggable={false} />
      {cardCount > 0 && <div className="sk-held-cards" role="img" aria-label={`${name} hält ${cardCount} verdeckte Karten`}>{Array.from({ length: cardCount }, (_, index) => <span className="sk-card-back" key={index} style={{ "--card-offset": `${(index - (cardCount - 1) / 2) * 11}px`, "--card-angle": `${(index - (cardCount - 1) / 2) * 7}deg` } as CSSProperties} />)}</div>}
      {announcement && <div className="sk-player-speech" title={announcementTitle ?? `${name}: ${announcement}`}><strong>{name}:</strong> {announcement}</div>}
    </div>}
    <span className="sk-visually-hidden">{name}: {position === "south" ? "dein Platz" : `Platz ${position}`}{role ? `, ${role}` : ""}</span>
    {showOpponent && wonTricks > 0 && <button className={`sk-trick-stack sk-trick-stack-${position} ${role ? `sk-trick-stack-${role === "Spieler" ? "playing" : "opposing"}` : ""}`} onPointerDown={() => onShownTrickChange(seat)} onPointerUp={() => onShownTrickChange(null)} onPointerCancel={() => onShownTrickChange(null)} onPointerLeave={() => onShownTrickChange(null)} aria-label={`Stichstapel von ${name}, ${wonTricks} Stiche${showTrickPoints ? `, ${points} Punkte` : ""}${canShowPreviousTrick ? "; gedrückt halten, um den vorherigen Stich zu sehen" : ""}`} disabled={!canShowPreviousTrick}><span>♠</span><small>{wonTricks}</small>{showTrickPoints && <small className="sk-trick-points">{points}</small>}</button>}
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

type RulebookTab = "basics" | "setup" | "ui" | "custom" | "sounds" | "bots";
const rulebookTabs: { id: RulebookTab; label: string; Icon: typeof BookOpen }[] = [
  { id: "basics", label: "Grundregeln", Icon: BookOpen },
  { id: "setup", label: "Design", Icon: Palette },
  { id: "ui", label: "Ansicht", Icon: SlidersHorizontal },
  { id: "custom", label: "Regeln anpassen", Icon: Settings2 },
  { id: "sounds", label: "Sounds", Icon: Volume2 },
  { id: "bots", label: "Bot/KI", Icon: Settings2 },
];

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
  const cards = sortHand(sortPreviewCards, null);
  return <figure className={`sk-sort-preview sk-sort-preview-${layout}`}>
    <div className="sk-sort-preview-cards">{cards.map((card, index) => <span className="sk-sort-preview-card" key={card.id} style={{ "--preview-angle": `${(index - (cards.length - 1) / 2) * 6}deg`, "--preview-rise": `${Math.abs(index - (cards.length - 1) / 2) * 5}px`, zIndex: index + 1 } as CSSProperties}><CardFace card={card} cardTheme={cardTheme} /></span>)}</div>
    <figcaption>Beispiel einer sortierten Hand: Trumpf zuerst, danach die übrigen Farben.</figcaption>
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
  return <label className={`sk-toggle ${disabled ? "is-disabled" : ""}`}>
    <span className="sk-toggle-copy">{children}</span>
    <input type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={event => onChange?.(event.target.checked)} />
    <span className="sk-toggle-track" aria-hidden="true" />
  </label>;
}

export function SchafkopfRules({ embedded = false }: { embedded?: boolean }) {
  const content = <SchafkopfRulebook />;
  return embedded
    ? <div className="sk-rules-content"><h3>Spielregeln & Wertung</h3>{content}</div>
    : <details className="sk-panel sk-rules"><summary>Spielregeln & Wertung</summary>{content}</details>;
}

export default function SchafkopfTable({ view, onAction, busy = false, error, hidden = false, onReveal, allowNext = true, subtitle, onRulesChange, onRename, aiDifficulty, onAiDifficultyChange, collectSecondsValue, onCollectSecondsChange, onlineSession = false, onlineCode, alwaysLegen = false, untimedLegen = false }: {
  view: GameView; onAction: (action: Action) => void; busy?: boolean; error?: string | null;
  hidden?: boolean; onReveal?: () => void; allowNext?: boolean; subtitle?: string; onRulesChange?: (rules: GameRules) => void; onRename?: (seat: number, name: string) => void;
  aiDifficulty?: AiDifficulty; onAiDifficultyChange?: (difficulty: AiDifficulty) => void;
  collectSecondsValue?: number; onCollectSecondsChange?: (seconds: number) => void | Promise<void>;
  onlineSession?: boolean;
  onlineCode?: string;
  alwaysLegen?: boolean;
  untimedLegen?: boolean;
}) {
  const pageRef = useRef<HTMLElement>(null);
  const [fullscreen, setFullscreen] = useState(false);
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
  const [deckPickerOpen, setDeckPickerOpen] = useState(false);
  const [playersOpen, setPlayersOpen] = useState(false);
  const [avatarSeats, setAvatarSeats] = useState(readAvatars);
  const [draftNames, setDraftNames] = useState<string[]>(view.names);
  const [scoreboardOpen, setScoreboardOpen] = useState(false);
  const [ledgerPage, setLedgerPage] = useState(0);
  const [ledgerNote, setLedgerNote] = useState(readLedgerNote);
  const [ledgerInk, setLedgerInk] = useState<NoteInk>(readLedgerInk);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [collectSecondsDraft, setCollectSecondsDraft] = useState<number | null>(null);
  const collectSeconds = collectSecondsDraft ?? collectSecondsValue ?? readCollectSeconds(aiDifficulty);
  // A completed game must always keep its summary visible. This also restores
  // the summary when a finished saved or multiplayer game is opened again.
  const done = view.phase === "finished" || view.phase === "redeal";
  const scoreboardVisible = scoreboardOpen || done;
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
  const [turnReminderOpen, setTurnReminderOpen] = useState(false);
  const [chosenKind, setChosenKind] = useState<Contract["kind"] | "">("");
  const [chosenSuit, setChosenSuit] = useState<Suit | "">("");
  const [chosenCallRank, setChosenCallRank] = useState<Rank | "">("");
  const [chosenDu, setChosenDu] = useState(false);
  const [detailStepKey, setDetailStepKey] = useState("");
  const simpleLanguage = aiDifficulty === "beginner" || aiDifficulty === "amateur";
  const currentAnnouncementSettings = simpleLanguage ? { ...announcementSettings, callPrefix: "auf" as const, callNames: SIMPLE_ANNOUNCEMENT_SETTINGS.callNames, soloWord: "Solo" as const } : announcementSettings;
  const [lessonSeed] = useState(() => Math.floor(Math.random() * 4294967296));
  const lesson = useMemo(() => aiDifficulty ? randomSchafkopfLesson(aiDifficulty, seededRandom(lessonSeed + view.round * 101 + view.revision * 17 + view.seat), view) : null, [aiDifficulty, lessonSeed, view]);
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
  const selectAvatar = (seat: number, avatar: number) => {
    const next = [...avatarSeats];
    next[seat] = avatar;
    setAvatarSeats(next);
    try { localStorage.setItem("schafkopf-avatars", JSON.stringify(next)); } catch { /* Keep this session's selection. */ }
  };
  const savePlayers = () => {
    if (onRename) draftNames.forEach((name, seat) => { if (name.trim() && name.trim() !== view.names[seat]) onRename(seat, name); });
    setPlayersOpen(false);
  };
  useEffect(() => {
    if (!rulebookOpen && !deckPickerOpen && !playersOpen && !scoreboardVisible && !reviewOpen && !announcementsOpen && !helpOpen && !turnReminderOpen) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = scoreboardVisible ? document.querySelector<HTMLElement>("[data-sk-score-dialog]") : pageRef.current?.querySelector<HTMLElement>('[role="dialog"][aria-modal="true"]');
    dialog?.querySelector<HTMLElement>("button")?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setRulebookOpen(false);
        setDeckPickerOpen(false);
        setPlayersOpen(false);
        setScoreboardOpen(false);
        setReviewOpen(false);
        setAnnouncementsOpen(false);
        setHelpOpen(false);
        setTurnReminderOpen(false);
      }
      if (event.key !== "Tab" || !dialog) return;
      const focusable = [...dialog.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), summary')]
        .filter(element => element.getClientRects().length > 0);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [rulebookOpen, deckPickerOpen, playersOpen, scoreboardVisible, reviewOpen, announcementsOpen, helpOpen, turnReminderOpen]);
  useEffect(() => {
    const sync = () => setFullscreen(document.fullscreenElement === pageRef.current);
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
    try {
      if (document.fullscreenElement === pageRef.current) await document.exitFullscreen();
      else await pageRef.current?.requestFullscreen();
    } catch {
      setFullscreenError("Vollbild konnte nicht gestartet werden. Bitte erlaube es in deinem Browser.");
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
    setTurnReminderOpen(false);
    if (!active || done || view.phase !== "play") return;
    const timer = window.setInterval(() => setTurnReminderOpen(true), aiDifficulty && !onlineSession ? 60_000 : 30_000);
    return () => window.clearInterval(timer);
  }, [active, done, view.phase, view.revision, aiDifficulty, onlineSession]);
  const ledgerEntries = view.history ?? [];
  const latestLedgerEntry = ledgerEntries.at(-1);
  const ledgerPageCount = Math.max(1, Math.ceil(ledgerEntries.length / GAMES_PER_LEDGER_SHEET));
  const currentLedgerPage = Math.min(ledgerPage, ledgerPageCount - 1);
  const visibleLedgerEntries = ledgerEntries.slice(currentLedgerPage * GAMES_PER_LEDGER_SHEET, (currentLedgerPage + 1) * GAMES_PER_LEDGER_SHEET);
  useEffect(() => {
    if (scoreboardVisible) setLedgerPage(Math.max(0, ledgerPageCount - 1));
  }, [scoreboardVisible, ledgerPageCount]);
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
    const animation = !reviewOpen ? window.setTimeout(() => setCollectingTrickRevision(view.revision), Math.max(0, duration - 800)) : undefined;
    const collect = mine && !busy && !reviewOpen ? window.setTimeout(() => onActionRef.current({ type: "collect" }), duration) : undefined;
    return () => { if (animation) window.clearTimeout(animation); if (collect) window.clearTimeout(collect); };
  }, [view.phase, view.revision, mine, busy, collectSeconds, reviewOpen]);
  const collectingTrick = view.phase === "trick" && collectingTrickRevision === view.revision;
  const dispatch = (action: Action) => { if (!busy) { setTurnReminderOpen(false); if (action.type === "play") setSpritzWithCard(false); onAction(action); } };
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
  const scoreDialogContainer = fullscreen && pageRef.current ? pageRef.current : document.body;
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
  const selectedRulebookTab = rulebookTabs.find(tab => tab.id === rulebookTab)!;
  const reviewContent = <><p className="sk-review-guide">Regeln und Tipps werden aus deiner Hand und den Informationen vor deinem damaligen Zug geprüft.</p>{view.tricks.length ? <ol className="sk-review-list">{view.tricks.map((trick, index) => {
    const review = analyzeSchafkopfTrick(view, trick);
    return <li key={index}><strong>Stich {index + 1} · {view.names[trick.winner]} · {trick.points} Punkte</strong><div className="sk-review-cards">{trick.plays.map(play => <span key={play.seat}><small>{view.names[play.seat]}</small><CardFace card={play.card} cardTheme={cardTheme} /></span>)}</div><p>{review.summary}</p>{review.actual && review.suggested && <p>Deine Karte: <b>{cardName(review.actual)}</b>. {review.actual.id === review.suggested.id ? "Passt zur Empfehlung." : <>Empfehlung aus damaliger Sicht: <b>{cardName(review.suggested)}</b>.</>} {!review.withinRules && "Weicht von den Bot-Grundsätzen ab."}</p>}{review.lessons.map(item => <details key={item.id}><summary>{item.code} · {item.kind === "rule" ? "Regel" : "Tipp"} · {item.title}</summary><p>{item.text}</p></details>)}</li>;
  })}</ol> : <p>Noch kein Stich gespielt.</p>}</>;
  return <main className={`sk-page sk-ambience-${ambience}`} ref={pageRef} style={{ "--sk-own-card-scale": ownCardScale / 100, "--sk-trick-card-scale": trickCardScale / 100 } as CSSProperties}>
    <SchafkopfNameplates scene={ambience} pageRef={pageRef} labels={{ south: { name: view.names[view.seat], role: partyFor(view.seat), glow: teamsKnown }, west: { name: view.names[(view.seat + 1) % 4], role: partyFor((view.seat + 1) % 4), glow: teamsKnown }, north: { name: view.names[(view.seat + 2) % 4], role: partyFor((view.seat + 2) % 4), glow: teamsKnown }, east: { name: view.names[(view.seat + 3) % 4], role: partyFor((view.seat + 3) % 4), glow: teamsKnown } }} knocked={{ south: Boolean(view.legenDecisions?.[view.seat]), west: Boolean(view.legenDecisions?.[(view.seat + 1) % 4]), north: Boolean(view.legenDecisions?.[(view.seat + 2) % 4]), east: Boolean(view.legenDecisions?.[(view.seat + 3) % 4]) }} spritzed={{ south: (view.spritzSeats ?? []).includes(view.seat), west: (view.spritzSeats ?? []).includes((view.seat + 1) % 4), north: (view.spritzSeats ?? []).includes((view.seat + 2) % 4), east: (view.spritzSeats ?? []).includes((view.seat + 3) % 4) }} cardCounts={{ south: view.counts[view.seat], west: view.counts[(view.seat + 1) % 4], north: view.counts[(view.seat + 2) % 4], east: view.counts[(view.seat + 3) % 4] }} />
    <header className="sk-header sk-game-menu"><div className="sk-game-menu-title"><strong title={subtitle ?? "Schafkopf"}>Schafkopf</strong><span>Runde {view.round}{view.contract ? ` · ${contractName(view.contract)}` : ""}</span></div><nav className="sk-header-actions" aria-label="Schafkopf-Menü"><button className="sk-button sk-secondary sk-icon-button" onClick={() => setAnnouncementsOpen(true)} aria-label="Ansagen öffnen" title="Ansagen"><MessageSquareText size={16} /><span>Ansagen</span></button><button className="sk-button sk-secondary sk-icon-button" onClick={() => setScoreboardOpen(true)} aria-label="Spielstände öffnen" title="Spielstände"><ListOrdered size={16} /><span>Spielstände</span></button><button className="sk-button sk-secondary sk-icon-button" onClick={() => setReviewOpen(true)} aria-label="Stiche ansehen" title="Stich-Review"><Info size={16} /><span>Stich-Review</span></button><button className="sk-button sk-secondary sk-icon-button" onClick={() => { setRulebookTab("basics"); setRulebookOpen(true); }} aria-label="Spielregeln öffnen" title="Spielregeln"><BookOpen size={16} /><span>Regeln</span></button><button className="sk-button sk-secondary sk-icon-button" onClick={() => { setDraftNames(view.names); setPlayersOpen(true); }} aria-label="Spieler und Avatare auswählen" title="Spieler und Avatare"><UsersRound size={16} /><span>Spieler</span></button><button className="sk-button sk-secondary sk-icon-button" onClick={() => setDeckPickerOpen(true)} aria-label="Kartendeck auswählen" title="Kartendeck"><Layers3 size={16} /><span>Deck</span></button><button className="sk-button sk-secondary sk-fullscreen-button" onClick={() => void toggleFullscreen()} aria-label={fullscreen ? "Vollbild verlassen" : "Vollbild"} title={fullscreen ? "Vollbild verlassen" : "Vollbild"}>{fullscreen ? <Minimize size={16} /> : <Maximize size={16} />}<span>{fullscreen ? "Verkleinern" : "Vollbild"}</span></button><Link className="sk-button sk-secondary" to="/games/schafkopf">Menü</Link></nav></header>
    {!fullscreen && <div className="sk-fullscreen-hint"><Maximize size={15} /><span>Für die beste Sicht am Tisch empfehlen wir den Vollbildmodus.</span><button type="button" onClick={() => void toggleFullscreen()}>Vollbild starten</button></div>}
    {lesson && !hidden && <aside className="sk-learning-banner" aria-label="Lernhinweis"><span>{lesson.kind === "rule" ? "Regel" : "Tipp"} · {lesson.code}</span><strong>{lesson.title}</strong><p>{lesson.text}</p></aside>}
    {rulebookOpen && createPortal(<div className="sk-rulebook-backdrop" role="presentation" onMouseDown={() => setRulebookOpen(false)}>
      <section className="sk-rulebook" role="dialog" aria-modal="true" aria-labelledby="sk-rulebook-title" onMouseDown={event => event.stopPropagation()}>
        <header>
          <div><span className="sk-eyebrow">Euer Tisch</span><h2 id="sk-rulebook-title">{selectedRulebookTab.label}</h2></div>
          <button className="sk-close-button" onClick={() => setRulebookOpen(false)} aria-label="Regelbuch schließen"><X size={20} /></button>
        </header>
        <div className="sk-rule-tabs" role="tablist" aria-label="Bereiche im Regelbuch">
          {rulebookTabs.map(({ id, label, Icon }) => <button key={id} type="button" id={`sk-rule-tab-${id}`} role="tab" aria-controls={`sk-rule-panel-${id}`} aria-selected={rulebookTab === id} className={rulebookTab === id ? "is-selected" : ""} onClick={() => setRulebookTab(id)} aria-label={label} title={label}><Icon size={18} /><span>{label}</span></button>)}
        </div>
        {rulebookTab === "bots" && <div className="sk-rule-panel" id="sk-rule-panel-bots" role="tabpanel" aria-labelledby="sk-rule-tab-bots"><SchafkopfBotSettings value={botConfig(rulebook.bot)} disabled={!onRulesChange} onChange={bot => updateRulebook(current => ({ ...current, bot }))} /></div>}
        {rulebookTab === "basics" && <div className="sk-rule-panel" id="sk-rule-panel-basics" role="tabpanel" aria-labelledby="sk-rule-tab-basics"><SchafkopfRules embedded /></div>}
        {rulebookTab === "sounds" && <div className="sk-rule-panel sk-sound-panel" id="sk-rule-panel-sounds" role="tabpanel" aria-labelledby="sk-rule-tab-sounds"><div className="sk-sound-heading"><div><h3>Klänge am Tisch</h3><p>Hier kannst du Klaviermusik, Ansagen und Spielgeräusche wie Mischen, Kartenlegen und Klopfen getrennt einstellen oder ganz ausschalten. Ansagen bleiben vorerst stumm, bis natürliche bayerische Audiodateien verfügbar sind.</p></div><button type="button" className="sk-button sk-secondary sk-sound-mute" aria-pressed={sounds.muted} onClick={sounds.toggleMute}>{sounds.muted ? "Ton an" : "Stumm"}</button></div>{([ ["music", "Klaviermusik"], ["announcements", "Ansagen"], ["effects", "Spielgeräusche"] ] as [keyof SoundSettings, string][]).map(([key, label]) => <label key={key}>{label}<input type="range" min="0" max="100" value={sounds.settings[key]} onChange={event => sounds.update(key, Number(event.target.value))} aria-label={`${label} Lautstärke`} /><output>{sounds.muted ? "stumm" : `${sounds.settings[key]} %`}</output></label>)}</div>}
        {rulebookTab === "ui" && <div className="sk-rule-panel" id="sk-rule-panel-ui" role="tabpanel" aria-labelledby="sk-rule-tab-ui"><fieldset className="sk-ui-setting"><legend>Kartengröße</legend><label htmlFor="sk-own-card-scale"><span>Deine Handkarten</span><input id="sk-own-card-scale" type="range" min="75" max="220" step="5" value={ownCardScale} onChange={event => setOwnCardScale(Number(event.target.value))} /><output>{ownCardScale} %</output></label><label htmlFor="sk-trick-card-scale"><span>Karten im aktuellen Stich</span><input id="sk-trick-card-scale" type="range" min="75" max="220" step="5" value={trickCardScale} onChange={event => setTrickCardScale(Number(event.target.value))} /><output>{trickCardScale} %</output></label><button type="button" className="sk-button sk-secondary sk-card-scale-reset" onClick={restoreDefaultCardScales}>Standardgröße wiederherstellen</button><small>Auf dem Handy sind standardmäßig 200 % für deine Hand und 150 % für Karten im Stich eingestellt; auf größeren Bildschirmen jeweils 100 %.</small></fieldset></div>}
        {rulebookTab === "setup" && <div className="sk-rule-panel" id="sk-rule-panel-setup" role="tabpanel" aria-labelledby="sk-rule-tab-setup">
          <fieldset className="sk-design-setting"><legend>Kartenanordnung</legend><div className="sk-hand-layout-toggle" role="group" aria-label="Darstellung der Hand"><button type="button" className={handLayout === "spread" ? "is-selected" : ""} aria-pressed={handLayout === "spread"} onClick={() => setHandLayout("spread")}><LayoutGrid size={15} />Nebeneinander</button><button type="button" className={handLayout === "stack" ? "is-selected" : ""} aria-pressed={handLayout === "stack"} onClick={() => setHandLayout("stack")}><Rows3 size={15} />Gerade</button><button type="button" className={handLayout === "fan" ? "is-selected" : ""} aria-pressed={handLayout === "fan"} onClick={() => setHandLayout("fan")}><Fan size={15} />Halbkreis</button></div><HandSortPreview layout={handLayout} cardTheme={cardTheme} /><small>Die Vorschau zeigt die gewählte Anordnung mit nach Trumpf und Wert sortierten Karten. Automatisches Sortieren gilt nur beim Austeilen; danach kannst du Karten verschieben.</small></fieldset>
          <fieldset className="sk-design-setting"><legend>Hintergrund</legend><div className="sk-background-options" role="group" aria-label="Tischhintergrund">{([['garden', 'Garten', '/images/schafkopf-garden-first-person.png'], ['beach', 'Strand', '/images/schafkopf-beach-first-person.png'], ['bar', 'Bar', '/images/schafkopf-bar-stools-empty.png'], ['mountain', 'Berghütte', '/images/schafkopf-mountain-balcony.png']] as const).map(([id, label, image]) => <button key={id} type="button" className={ambience === id ? "is-selected" : ""} aria-pressed={ambience === id} onClick={() => setAmbience(id)}><img src={image} alt="" loading="lazy" /><span>{label}</span></button>)}</div></fieldset>
          <fieldset className="sk-announcement-setting">
            <legend>Deine Ansagen</legend>
            <p>Ohne eigene Texte werden die gewählten oder zufälligen Formulierungen verwendet. Die Einstellungen gelten nur auf diesem Gerät.</p>
            <div className="sk-announcement-grid">
              <label>Spielabsicht<select value={announcementPreference} onChange={event => { setAnnouncementPreference(event.target.value); try { localStorage.setItem("schafkopf-play-announcement", event.target.value); } catch { /* Keep this selection for the session. */ } }}><option value="random">Zufällig</option>{PLAY_PHRASES.map(phrase => <option key={phrase} value={phrase}>{phrase}</option>)}</select></label>
              <label>Eigener Text für „Spielen“<input maxLength={100} value={announcementSettings.custom.intent} onChange={event => setCustomAnnouncement("intent", event.target.value)} placeholder="Zum Beispiel: I dad scho!" /></label>
              <label>Vorsatz beim Suchen<select value={announcementSettings.callPrefix} onChange={event => updateAnnouncementSettings(current => ({ ...current, callPrefix: event.target.value as AnnouncementSettings["callPrefix"] }))}><option value="random">Zufällig</option><option value="auf">I spui auf die …</option><option value="mit">I spui mit der …</option><option value="none">Ohne Vorsatz</option></select></label>
              <label>Solo ansagen als<select value={announcementSettings.soloWord} onChange={event => updateAnnouncementSettings(current => ({ ...current, soloWord: event.target.value as AnnouncementSettings["soloWord"] }))}><option value="random">Zufällig</option><option value="Solo">Farbe-Solo</option><option value="Sticht">Farbe-Sticht</option></select></label>
            </div>
            <div className="sk-call-settings">{(["Eichel", "Gras", "Schellen"] as const).map(suit => <div key={suit}><label>{suit}-Ass nennen als<select value={announcementSettings.callNames[suit]} onChange={event => updateAnnouncementSettings(current => ({ ...current, callNames: { ...current.callNames, [suit]: event.target.value } }))}><option value="random">Zufällig</option>{CALL_NAME_OPTIONS[suit].map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label><label>Eigene Ansage für {suit}-Ass<input maxLength={100} value={announcementSettings.custom[suit]} onChange={event => setCustomAnnouncement(suit, event.target.value)} placeholder="Leer = Name und Vorsatz verwenden" /></label></div>)}</div>
            <div className="sk-announcement-grid">{([
              ["solo", "Eigene Solo-Ansage", "Leer = Farbe-Solo oder Farbe-Sticht"],
              ["wenz", "Eigene Wenz-Ansage", "Leer = Wenz"],
              ["farbwenz", "Eigene Farbwenz-Ansage", "Leer = Farbe-Wenz"],
              ["other", "Eigene Ansage für weitere Spiele", "Leer = Spielname"],
              ["pass", "Eigener Text für Weiter", "Leer = Weiter oder Weg"],
              ["bid", "Eigener Text für Gebote", "{Gebot} zeigt den Spielrang"],
              ["kontra", "Eigener Text für Kontra", "Leer = Kontra!"],
              ["re", "Eigener Text für Re", "Leer = Re!"],
              ["sub", "Eigener Text für Sub", "Leer = Sub!"],
              ["hirsch", "Eigener Text für Hirsch", "Leer = Hirsch!"],
            ] as const).map(([key, label, placeholder]) => <label key={key}>{label}<input maxLength={100} value={announcementSettings.custom[key]} onChange={event => setCustomAnnouncement(key, event.target.value)} placeholder={placeholder} /></label>)}</div>
            <small>Beim Überfahren einer Spielansage siehst du den eindeutigen Spielnamen, beim Sauspiel das gerufene Ass.</small>
          </fieldset>
          {aiDifficulty && onAiDifficultyChange && <fieldset className="sk-ai-difficulty-setting"><legend>KI-Schwierigkeit</legend><label htmlFor="sk-ai-difficulty">Spielstärke<select id="sk-ai-difficulty" value={aiDifficulty} onChange={event => onAiDifficultyChange(event.target.value as AiDifficulty)}>{AI_DIFFICULTY_OPTIONS.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label><small>Anfänger spielt regelgerecht, entscheidet sich aber oft für die schwächere Karte. Profi und Legende beachten Punkte und bereits gespielte Trümpfe.</small></fieldset>}
          <fieldset className="sk-collect-setting"><legend>Stiche einsammeln</legend><label htmlFor="sk-collect-seconds">Wartezeit <input id="sk-collect-seconds" type="range" min="1" max="10" step="1" value={collectSeconds} disabled={busy || onlineSession && !onCollectSecondsChange} onChange={event => { const seconds = Number(event.target.value); if (onlineSession) setCollectSecondsDraft(seconds); else { onCollectSecondsChange?.(seconds); try { localStorage.setItem("schafkopf-collect-seconds", String(seconds)); } catch { /* Keep this session's choice. */ } } }} onPointerUp={event => commitCollectSeconds(Number(event.currentTarget.value))} onKeyUp={event => commitCollectSeconds(Number(event.currentTarget.value))} /><output htmlFor="sk-collect-seconds">{collectSeconds} s</output></label><span className="sk-info-hover" tabIndex={0} aria-label="Stiche können jederzeit im Stich-Review nachträglich angesehen werden"><Info size={15} /><span role="tooltip">Alle gespielten Stiche kannst du jederzeit im Stich-Review nachträglich ansehen.{onlineSession && !onCollectSecondsChange ? " Die Wartezeit stellt der Gastgeber ein." : ""}</span></span></fieldset>
        </div>}
        {rulebookTab === "custom" && <div className="sk-rule-panel" id="sk-rule-panel-custom" role="tabpanel" aria-labelledby="sk-rule-tab-custom">
          <p>Solo und Wenz sind immer erlaubt. Sauspiel und Farbwenz sind als Standard aktiv; weitere Varianten kannst du für eure Runde wählen.</p>
          <div className="sk-rulebook-grid">
            <fieldset><legend>Erlaubte Spiele</legend><Toggle checked disabled>Solo</Toggle><Toggle checked disabled>Wenz</Toggle><Toggle checked={rulebook.sauspiel} onChange={checked => updateRulebook(current => ({ ...current, sauspiel: checked }))}>Sauspiel</Toggle>{(["farbwenz", "geier", "farbgeier", "hochzeit", "bettel"] as const).map(game => <Toggle key={game} checked={game === "hochzeit" ? false : rulebook[game]} disabled={game === "hochzeit"} onChange={checked => updateRulebook(current => ({ ...current, [game]: checked }))}>{{ farbwenz: "Farbwenz", geier: "Geier", farbgeier: "Farbgeier", hochzeit: "Hochzeit · Ablauf noch zu klären", bettel: "Bettel" }[game]}</Toggle>)}</fieldset>
            <fieldset><legend>Rundenregeln</legend><Toggle checked={rulebook.ramsch} onChange={checked => updateRulebook(current => ({ ...current, ramsch: checked }))}>Ramsch nach viermal Weiter</Toggle><small>Bei einer Jungfrau ohne Stich erhält dieser Spieler im Ramsch den doppelten Betrag.</small><Toggle checked={rulebook.eichelOberMuss} onChange={checked => updateRulebook(current => ({ ...current, eichelOberMuss: checked }))}>Eichel-Ober muss spielen, wenn alle weiter sagen</Toggle><Toggle checked={alwaysLegen || rulebook.legen} disabled={alwaysLegen} onChange={checked => updateRulebook(current => ({ ...current, legen: checked }))}>{alwaysLegen ? "Legen · im Einzelspieler immer aktiv" : "Legen ab der nächsten Runde"}</Toggle><Toggle checked={rulebook.spritzen !== "nie"} onChange={checked => updateRulebook(current => ({ ...current, spritzen: checked ? "jederzeit" : "nie" }))}>Spritzen · Kontra, Re, Sub, Hirsch</Toggle></fieldset>
            <fieldset><legend>Anzeigen</legend><Toggle checked={rulebook.showPoints} onChange={checked => updateRulebook(current => ({ ...current, showPoints: checked }))}>Punktestand anzeigen</Toggle><Toggle checked={rulebook.showTrickPoints} onChange={checked => updateRulebook(current => ({ ...current, showTrickPoints: checked }))}>Punkte je Stichstapel anzeigen</Toggle><Toggle checked={rulebook.showPlayedTrumps} onChange={checked => updateRulebook(current => ({ ...current, showPlayedTrumps: checked }))}>Gespielte Trümpfe zählen</Toggle><small>Der Trumpfzähler ist standardmäßig ausgeschaltet.</small></fieldset>
            <fieldset><legend>Grundwerte in Cent</legend>{(["rufspielValue", "soloValue", "wenzValue", "ramschValue", "schneiderValue", "schwarzValue", "laufendeValue"] as const).map(value => <label key={value}>{{ rufspielValue: "Sauspiel", soloValue: "Solo", wenzValue: "Wenz", ramschValue: "Ramsch", schneiderValue: "Schneider", schwarzValue: "Schwarz", laufendeValue: "Je Laufendem" }[value]}<input type="number" min={value === "schneiderValue" || value === "schwarzValue" || value === "laufendeValue" ? 0 : 1} max="999" value={rulebook[value]} onChange={event => updateRulebook(current => ({ ...current, [value]: Math.min(999, Math.max(value === "schneiderValue" || value === "schwarzValue" || value === "laufendeValue" ? 0 : 1, Number(event.target.value) || 0)) }))} /></label>)}</fieldset>
          </div>
          <fieldset className="sk-document-options"><legend>Hausregeln aus dem Dokument</legend>
            <Toggle checked={rulebook.davonlaufen !== false} onChange={checked => updateRulebook(current => ({ ...current, davonlaufen: checked }))}>Davonlaufen erlauben</Toggle>
            <Toggle checked={rulebook.toutAbbrechen !== false} onChange={checked => updateRulebook(current => ({ ...current, toutAbbrechen: checked }))}>Verlorenen Tout nach dem ersten verlorenen Stich beenden</Toggle>
            <p>Die letzte Spritzpartei braucht immer 61 Punkte zum Sieg und 31 für schneiderfrei. Tout zählt ×2, Sie ×4; beide ohne Schneider-/Schwarz-Zuschlag.</p>
            <Toggle checked={rulebook.laufendeAktiv !== false} onChange={checked => updateRulebook(current => ({ ...current, laufendeAktiv: checked }))}>Laufende werten</Toggle>
            <Toggle checked={rulebook.klopferMussSpiel !== false} onChange={checked => updateRulebook(current => ({ ...current, klopferMussSpiel: checked }))}>Letzter Klopfer muss nach viermal Weiter spielen</Toggle>
            <small>Ohne Muss-Spiel gelten Ramsch oder Eichel-Ober-Pflichtspiel gemäß den Rundenregeln, einschließlich sämtlicher Klopfverdopplungen. Sind beide aus, wird zusammengeworfen.</small>
            {([["rufsauAbwerfenAbStich","Rufsau abwerfen ab Stich",7,1,8],["laufendeAbFarbspiel","Laufende im Farbspiel ab",3,1,14],["laufendeAbWenzGeier","Laufende im Wenz/Geier ab",2,1,4],["hotseatKlopfSekunden","Hotseat · Klopfzeit (Sekunden)",20,5,180],["multiplayerKlopfSekunden","Multiplayer · Klopfzeit (Sekunden)",30,5,180]] as const).map(([key,label,fallback,min,max]) => <label key={key}>{label}<input type="number" min={min} max={max} value={rulebook[key] ?? fallback} onChange={event => updateRulebook(current => ({ ...current, [key]: Math.max(min,Math.min(max,Number(event.target.value))) }))}/></label>)}
          </fieldset>
          <p className="sk-rulebook-note">Die Werte werden gespeichert. Klopfzeiten gelten ab dem nächsten Geben. Im Einzelspieler bleibt Klopfen ohne Zeitlimit; die Zug-Erinnerung kommt nach 60 Sekunden.</p>
        </div>}
      </section>
    </div>, document.fullscreenElement ?? document.body)}
    {deckPickerOpen && <div className="sk-rulebook-backdrop sk-deck-picker-backdrop" role="presentation" onMouseDown={() => setDeckPickerOpen(false)}><section className="sk-score-dialog sk-deck-dialog" role="dialog" aria-modal="true" aria-labelledby="sk-deck-title" onMouseDown={event => event.stopPropagation()}><header><div><span className="sk-eyebrow">Dein Kartentisch</span><h2 id="sk-deck-title">Kartendeck auswählen</h2></div><button className="sk-close-button" onClick={() => setDeckPickerOpen(false)} aria-label="Deckauswahl schließen"><X size={20} /></button></header><div className="sk-deck-options">{cardDecks.map(deck => <button key={deck.id} type="button" data-deck={deck.id} className={`sk-deck-option ${cardTheme === deck.id ? "is-selected" : ""}`} aria-pressed={cardTheme === deck.id} onClick={() => { setCardTheme(deck.id); setDeckPickerOpen(false); }}><span className="sk-deck-art"><img src={cardImage({ id: "Herz-König", suit: "Herz", rank: "König" }, deck.id)} alt="" loading="lazy" draggable={false} /><span className="sk-deck-back" aria-hidden="true">✦</span></span><span>{deck.name}</span></button>)}</div></section></div>}
    {playersOpen && <div className="sk-rulebook-backdrop sk-players-backdrop" role="presentation" onMouseDown={savePlayers}><section className="sk-score-dialog sk-players-dialog" role="dialog" aria-modal="true" aria-labelledby="sk-players-title" onMouseDown={event => event.stopPropagation()}><header><div><span className="sk-eyebrow">Euer Tisch</span><h2 id="sk-players-title">Spieler & Avatare</h2></div><button className="sk-close-button" onClick={savePlayers} aria-label="Spielerauswahl schließen"><X size={20} /></button></header><div className="sk-player-settings">{view.names.map((name, seat) => <section className="sk-player-setting" key={seat}><h3>{seat === view.seat ? "Dein Platz" : `Platz ${seat + 1}`}</h3>{onRename ? <label>Name<input value={draftNames[seat] ?? name} maxLength={24} onChange={event => setDraftNames(current => current.map((value, index) => index === seat ? event.target.value : value))} /></label> : <strong>{name}</strong>}<div className="sk-avatar-options" role="group" aria-label={`Avatar für ${name}`}>{avatars.map((avatar, index) => <button key={avatar.id} type="button" className={`sk-avatar-option ${avatarSeats[seat] === index ? "is-selected" : ""}`} aria-label={avatar.name} aria-pressed={avatarSeats[seat] === index} onClick={() => selectAvatar(seat, index)}><img src={`/images/schafkopf/avatars/${avatar.id}.png`} alt="" loading="lazy" /></button>)}</div></section>)}</div><button className="sk-button" onClick={savePlayers}>Fertig</button></section></div>}
    {fullscreenError && <p className="sk-error" role="alert">{fullscreenError}</p>}
    {scoreboardVisible && createPortal(<div className="sk-rulebook-backdrop sk-scoreboard-backdrop" role="presentation" onMouseDown={done ? undefined : () => setScoreboardOpen(false)}>
      <section data-sk-score-dialog className={`sk-score-dialog sk-ledger-dialog sk-bavarian-ledger-book ${done ? "sk-bavarian-summary" : ""}`} role="dialog" aria-modal="true" aria-labelledby="sk-score-title" onMouseDown={event => event.stopPropagation()}>
        <div className="sk-bavarian-ledger-page">
        <header><div>{done && <span className="sk-summary-kicker">✦ Wirtshauszettel · Runde {view.round} ✦</span>}<h2 id="sk-score-title">{done ? "Spiel-Zusammenfassung" : "Spielstände"}</h2>{done && <small className="sk-summary-subtitle">Der Tisch ist abgerechnet – schau ma, was auf dem Zettel steht.</small>}</div><div className="sk-ledger-header-actions"><Toggle checked={ledgerInk === "pencil"} onChange={checked => setLedgerInk(checked ? "pencil" : "pen")}>{ledgerInk === "pencil" ? "Bleistift" : "Kugelschreiber"}</Toggle>{!done && <button className="sk-close-button" onClick={() => setScoreboardOpen(false)} aria-label="Spielstände schließen"><X size={20} /></button>}</div></header>
        {rulebook.showPoints && <div className="sk-team-scores" aria-label="Punktestand">{teamsKnown ? <><div><span>Spieler · {playingSeats.map(seat => view.names[seat]).join(" & ")}</span><strong>{teamEyes(playingSeats)} Punkte</strong></div><div><span>Gegenspieler · {opposingSeats.map(seat => view.names[seat]).join(" & ")}</span><strong>{teamEyes(opposingSeats)} Punkte</strong></div></> : view.names.map((name, seat) => <div key={seat}><span>{name}</span><strong>{view.points[seat]} Punkte</strong></div>)}</div>}
        {done && latestLedgerEntry?.price && <section className="sk-score-breakdown" aria-label="Berechnung des Spielwerts"><strong>Spielwert · Runde {latestLedgerEntry.round}</strong><span>{latestLedgerEntry.price}</span></section>}
        <div className={`sk-ledger-paged sk-ledger-ink-${ledgerInk}`}><div className="sk-ledger-scroll"><table className="sk-ledger"><thead><tr>{view.names.map((name, seat) => <th scope="col" key={seat}>{name}</th>)}</tr></thead><tbody>
          {visibleLedgerEntries.map((entry, index) => { const entryNumber = currentLedgerPage * GAMES_PER_LEDGER_SHEET + index + 1; return <tr key={`${entry.round}-${index}`} className={[entryNumber === ledgerEntries.length ? "sk-ledger-latest" : "", entryNumber % GAMES_PER_ROUND === 0 && entryNumber < ledgerEntries.length ? "sk-ledger-round-end" : ""].filter(Boolean).join(" ")}>
            {entry.deltas.map((amount, seat) => <td key={seat}>{formatLedgerAmount(amount)}</td>)}
          </tr>; })}
          <tr className="sk-ledger-total">{view.totals.map((amount, seat) => <td key={seat}><strong>{formatLedgerAmount(amount)}</strong></td>)}</tr>
        </tbody></table></div>{ledgerPageCount > 1 && <nav className="sk-ledger-pagination" aria-label="Seiten des Wirtshauszettels"><button type="button" className="sk-button sk-secondary sk-ledger-page-arrow sk-ledger-page-arrow-previous" aria-label="Vorheriges Blatt" disabled={currentLedgerPage === 0} onClick={() => setLedgerPage(page => Math.max(0, page - 1))}><ChevronLeft size={25} aria-hidden="true" /></button><span className="sk-visually-hidden">Blatt {currentLedgerPage + 1} von {ledgerPageCount} · 4 Runden · 16 Spiele</span><button type="button" className="sk-button sk-secondary sk-ledger-page-arrow sk-ledger-page-arrow-next" aria-label="Nächstes Blatt" disabled={currentLedgerPage === ledgerPageCount - 1} onClick={() => setLedgerPage(page => Math.min(ledgerPageCount - 1, page + 1))}><ChevronRight size={25} aria-hidden="true" /></button></nav>}</div>
        <section className={`sk-ledger-notepad sk-ledger-notepad-${ledgerInk}`} aria-labelledby="sk-ledger-notepad-title">
          <div className="sk-ledger-notepad-heading"><div><span aria-hidden="true">🥨</span><h3 id="sk-ledger-notepad-title">Notizblock</h3></div><span>{ledgerInk === "pencil" ? "Bleistift" : "Kugelschreiber"}</span></div>
          <textarea value={ledgerNote} onChange={event => setLedgerNote(event.target.value.slice(0, 1000))} placeholder="Eigene Notizen zum Spieltag …" aria-label="Eigene Notizen zum Spieltag" />
        </section>
        {done && reviewOpen && <section className="sk-summary-review" aria-labelledby="sk-summary-review-title"><header><h3 id="sk-summary-review-title">Stich-Review & Tipps</h3><button className="sk-close-button" onClick={() => setReviewOpen(false)} aria-label="Stich-Review schließen"><X size={18} /></button></header>{reviewContent}</section>}
        {done && <footer className="sk-ledger-actions">
          <button className="sk-button sk-secondary sk-review-button" onClick={() => setReviewOpen(true)}>Stich-Review & Tipps</button>
          <Link className="sk-button sk-menu-return" to="/games/schafkopf">Menü</Link>
          <button className="sk-button" disabled={busy || !allowNext} title={allowNext ? undefined : "Nur der Gastgeber kann ein neues Spiel starten."} onClick={() => dispatch({ type: "next" })}>Neues Spiel</button>
        </footer>}
        {!done && onlineSession && <SchafkopfSessions currentCode={onlineCode} />}
        </div>
      </section>
    </div>, scoreDialogContainer)}
    {reviewOpen && !done && <div className="sk-rulebook-backdrop" role="presentation" onMouseDown={() => setReviewOpen(false)}>
      <section className="sk-score-dialog sk-review-dialog" role="dialog" aria-modal="true" aria-labelledby="sk-review-title" onMouseDown={event => event.stopPropagation()}>
        <header><h2 id="sk-review-title">Stich-Review</h2><button className="sk-close-button" onClick={() => setReviewOpen(false)} aria-label="Stich-Review schließen"><X size={20} /></button></header>
        {reviewContent}
      </section>
    </div>}
    {helpOpen && <div className="sk-rulebook-backdrop" role="presentation" onMouseDown={() => setHelpOpen(false)}><section className="sk-score-dialog sk-help-dialog" role="dialog" aria-modal="true" aria-labelledby="sk-help-title" onMouseDown={event => event.stopPropagation()}><header><h2 id="sk-help-title">Spielhinweise</h2><button className="sk-close-button" onClick={() => setHelpOpen(false)} aria-label="Spielhinweise schließen"><X size={20} /></button></header>{phaseHelp.map((message, index) => <p key={index}>{message}</p>)}</section></div>}
    {turnReminderOpen && <div className="sk-rulebook-backdrop sk-turn-reminder-backdrop" role="presentation" onMouseDown={() => setTurnReminderOpen(false)}><section className="sk-score-dialog sk-turn-reminder" role="dialog" aria-modal="true" aria-labelledby="sk-turn-reminder-title" onMouseDown={event => event.stopPropagation()}><h2 id="sk-turn-reminder-title">Du bist an der Reihe</h2><p>Wähle deine nächste Aktion.</p><button className="sk-button" autoFocus onClick={() => setTurnReminderOpen(false)}>Verstanden</button></section></div>}
    {announcementsOpen && <div className="sk-rulebook-backdrop" role="presentation" onMouseDown={() => setAnnouncementsOpen(false)}><section className="sk-score-dialog sk-announcements-dialog" role="dialog" aria-modal="true" aria-labelledby="sk-announcements-title" onMouseDown={event => event.stopPropagation()}><header><div><span className="sk-eyebrow">Runde {view.round}</span><h2 id="sk-announcements-title">Ansagen</h2></div><button className="sk-close-button" onClick={() => setAnnouncementsOpen(false)} aria-label="Ansagen schließen"><X size={20} /></button></header>{view.announcements.length ? <ol className="sk-log">{view.announcements.map((text, index) => <li key={index} title={view.announcementTitles?.[index] ? `Standardform: ${view.announcementTitles[index]}` : undefined}>{text}</li>)}</ol> : <p>Noch keine Ansage.</p>}{simpleLanguage && <div className="sk-call-glossary">{([ ["Eichel-Ass", "Das Eichel-Ass heißt auch Alte oder Oide."], ["Gras-Ass", "Das Gras-Ass heißt auch Blaue."], ["Schellen-Ass", "Das Schellen-Ass heißt auch Bums oder Pumpe."] ] as const).map(([label, explanation]) => <span key={label}>{label} <span className="sk-info-hover" tabIndex={0} aria-label={explanation}><Info size={14} /><span role="tooltip">{explanation}</span></span></span>)}</div>}</section></div>}
    <div className="sk-game-stage">
    {!done && <div className="sk-trick-progress" aria-label={`Stich ${Math.min(8, view.tricks.length + (view.phase === "trick" ? 0 : 1))} von 8`}>Stich {Math.min(8, view.tricks.length + (view.phase === "trick" ? 0 : 1))}/8</div>}
    <section className="sk-table" data-deck={cardTheme} aria-label="Spieltisch">
      {view.names.map((name, seat) => {
        const prefix = `${name}: `;
        const announcementIndex = view.announcements.findLastIndex(text => text.startsWith(prefix));
        const announcement = announcementIndex >= 0 ? view.announcements[announcementIndex].slice(prefix.length) : undefined;
        const position = tablePosition(seat);
        const avatar = avatars[avatarSeats[seat] ?? 0];
        return <SchafkopfSeatOverlay key={seat} seat={seat} ownSeat={view.seat} position={position} name={name} avatar={avatar} active={seat === view.turn} cardCount={view.counts[seat]} announcement={announcement} announcementTitle={view.announcementTitles?.[announcementIndex] ? `Standardform: ${view.announcementTitles[announcementIndex]}` : undefined} wonTricks={view.tricks.filter(trick => trick.winner === seat).length} points={teamPointsFor(seat)} role={partyFor(seat)} showTrickPoints={activeRules.showTrickPoints} previousTrickWinner={previousTrick?.winner} done={done} onShownTrickChange={setShownTrickSeat} />;
      })}
      <div className={`sk-trick ${collectingTrick ? `sk-trick-collecting sk-trick-collecting-${tablePosition(view.turn)}` : ""}`}>{displayTrick.map(play => <div className={`sk-played sk-played-${tablePosition(play.seat)}`} key={play.seat}><CardFace card={play.card} cardTheme={cardTheme} /></div>)}{!displayTrick.length && <span className="sk-table-mark" aria-hidden="true">♧</span>}</div>
      {revealedTrick && <div className="sk-held-trick"><strong>Vorheriger Stich · {view.names[revealedTrick.winner]}</strong><div>{revealedTrick.plays.map(play => <span key={play.seat}><small>{view.names[play.seat]}</small><CardFace card={play.card} cardTheme={cardTheme} /></span>)}</div></div>}
    </section>

    </div>
    {error && <p className="sk-error" role="alert">{error}</p>}
    <section className="sk-hand-area" data-deck={cardTheme}>
      {dealing && <div className="sk-shuffle-overlay sk-hand-deck" aria-live="polite"><div className="sk-shuffle-deck"><span /><span /><span /><span /></div><strong>{view.names[cutterSeat]} hebt ab</strong><small>{view.names[view.dealer]} gibt die Karten</small></div>}
      {!done && !hidden && <><h2 className="sk-visually-hidden">Deine Hand</h2><div className={`sk-hand sk-hand-${handLayout}`} data-deck={cardTheme} style={{ "--fan-count": hand.length } as CSSProperties}>{hand.map((card, index) => {
          const locked = view.phase === "play" && mine ? view.locks[card.id] : undefined;
          const playable = active && view.legalCards.includes(card.id);
          return <div className={`sk-hand-slot ${draggingCardId === card.id ? "sk-hand-slot-dragging" : ""}`} key={card.id} style={{ "--fan-angle": `${(index - (hand.length - 1) / 2) * 6}deg`, "--fan-rise": `${Math.abs(index - (hand.length - 1) / 2) * 10}px`, zIndex: draggingCardId === card.id ? 1000 : index + 1 } as CSSProperties} draggable onDragStart={event => { setDraggingCardId(card.id); event.dataTransfer.setData("text/plain", card.id); event.dataTransfer.effectAllowed = "move"; }} onDragEnter={() => { if (draggingCardId && draggingCardId !== card.id) reorderCard(draggingCardId, card.id); }} onDragOver={event => { event.preventDefault(); if (draggingCardId && draggingCardId !== card.id) reorderCard(draggingCardId, card.id); }} onDragEnd={() => setDraggingCardId(null)} onDrop={event => { event.preventDefault(); setDraggingCardId(null); }}><button className={`sk-card ${locked ? "sk-card-locked" : ""}`} disabled={!playable} title={locked ?? cardName(card)} aria-label={`${cardName(card)}${locked ? ` – gesperrt: ${locked}` : ""}`} onClick={() => dispatch({ type: "play", cardId: card.id, spritz: view.canDouble && spritzWithCard, phrase: view.canDouble && spritzWithCard ? announcementSettings.custom[(["kontra", "re", "sub", "hirsch"] as const)[spritzCount]].trim() || undefined : undefined })}><CardFace card={card} cardTheme={cardTheme} />{locked && <span className="sk-lock">Gesperrt</span>}</button></div>;
        })}{ownWonTricks.length > 0 && <button className={`sk-trick-stack sk-trick-stack-hand ${partyFor(view.seat) ? `sk-trick-stack-${partyFor(view.seat) === "Spieler" ? "playing" : "opposing"}` : ""}`} onPointerDown={() => setShownTrickSeat(view.seat)} onPointerUp={() => setShownTrickSeat(null)} onPointerCancel={() => setShownTrickSeat(null)} onPointerLeave={() => setShownTrickSeat(null)} aria-label={`Dein Stichstapel, ${ownWonTricks.length} Stiche${activeRules.showTrickPoints ? `, ${teamsKnown ? ownTeamPoints : view.points[view.seat]} Punkte` : ""}${previousTrick?.winner === view.seat ? "; gedrückt halten, um den vorherigen Stich zu sehen" : ""}`} disabled={previousTrick?.winner !== view.seat}><span>♠</span><small>{ownWonTricks.length}</small>{activeRules.showTrickPoints && <small className="sk-trick-points">{teamsKnown ? ownTeamPoints : view.points[view.seat]}</small>}</button>}</div><div className="sk-hand-toolbar"><div className="sk-sort-control"><button type="button" className="sk-button sk-secondary sk-icon-button sk-sort-trigger" onClick={() => setSortMenuOpen(open => !open)} aria-expanded={sortMenuOpen} aria-haspopup="dialog" aria-label="Karten sortieren" title="Karten sortieren"><ArrowDownUp size={18} /><span>Sortieren</span></button>{sortMenuOpen && <div className="sk-sort-popover" role="dialog" aria-label="Karten sortieren"><div className="sk-sort-popover-heading"><strong>Karten sortieren</strong><button type="button" className="sk-close-button" onClick={closeSortMenu} aria-label="Sortierauswahl schließen"><X size={18} /></button></div><button className="sk-button sk-sort-confirm" onClick={() => { setHandLayouts(layouts => ({ ...layouts, [handOrder]: sortedHand.map(card => card.id) })); closeSortMenu(); }} disabled={alreadySorted}><ArrowDownUp size={16} />{alreadySorted ? "Bereits sortiert" : "Jetzt sortieren"}</button><label className="sk-auto-sort-setting"><span>Beim Austeilen automatisch sortieren</span><input type="checkbox" role="switch" checked={autoSort} onChange={event => changeAutoSort(event.target.checked)} /><span className="sk-auto-sort-track" aria-hidden="true" /></label><small>Sortiert einmal beim Austeilen. Danach kannst du die Karten frei verschieben.</small><button type="button" className="sk-sort-design-link" onClick={() => { setRulebookTab("setup"); setRulebookOpen(true); closeSortMenu(); }}>Kartenanordnung im Design ändern</button></div>}</div></div></>}
    <aside className={`sk-table-sidebar ${canDecideLegen ? "sk-table-sidebar-legen" : ""} ${mine && view.phase === "intent" ? "sk-table-sidebar-intent" : ""} ${mine && view.phase === "declare" ? "sk-table-sidebar-declare" : ""} ${detailStepKey === selectionKey ? "sk-table-sidebar-detail" : ""} ${view.contract && !done ? "sk-table-sidebar-in-game" : ""} ${showTurnNotice && view.phase === "play" && !view.canDouble ? "sk-table-sidebar-turn-only" : ""} ${needsPlayerAction ? "sk-table-sidebar-turn" : ""} ${compactInfo ? "sk-table-sidebar-compact" : ""}`} aria-label="Spielaktionen">
      {showTurnNotice && <p className="sk-your-turn" role="status">Du bist am Zug</p>}
      {onlineSession && mine && turnSecondsLeft !== null && <p className={`sk-action-timer ${turnSecondsLeft === 0 ? "is-expired" : ""}`} role="timer" aria-label={`Verbleibende Zugzeit: ${clockText(turnSecondsLeft)}`}>Zugzeit <strong>{clockText(turnSecondsLeft)}</strong>{turnSecondsLeft === 0 && " · Bitte ziehe jetzt."}</p>}
      {activeRules.showPlayedTrumps && view.contract && <p className="sk-trump-counter" aria-live="polite">Trümpfe gespielt: <strong>{playedTrumpCount} / {totalTrumpCount}</strong></p>}
      {view.phase === "trick" && <p className="sk-trick-result">{view.names[view.turn]} gewinnt den Stich · {view.tricks.at(-1)?.points} Punkte</p>}
      <div className={`sk-table-actions sk-table-actions-${tablePosition(view.turn)}`} aria-live="polite">
        {hidden && !done ? <div className="sk-handoff"><h2>Weitergeben an {view.names[view.seat]}</h2><button className="sk-button" onClick={onReveal}>Ich bin {view.names[view.seat]} – Karten zeigen</button></div> : <>
          {canDecideLegen && <><h2>Mit vier Karten klopfen?{!untimedLegen && legenSecondsLeft !== null && <span className={`sk-action-timer sk-legen-timer ${legenSecondsLeft === 0 ? "is-expired" : ""}`} role="timer">{clockText(legenSecondsLeft)}</span>}</h2><div className="sk-actions sk-legen-actions"><button className="sk-button" disabled={!legenDecisionActive} onClick={() => dispatch({ type: "legen", knock: true })}>Klopfen · 1 € · ×2</button><button className="sk-button sk-secondary" disabled={!legenDecisionActive} onClick={() => dispatch({ type: "legen", knock: false })}>Zweite Hand</button></div></>}
          {mine && view.phase === "intent" && <><h2>{view.intents.length ? "Möchtest du auch spielen?" : "Möchtest du spielen?"}</h2><div className="sk-actions sk-intent-actions"><button className="sk-button" disabled={!active || !view.canIntent} onClick={() => dispatch({ type: "intent", play: true, phrase: announcementSettings.custom.intent.trim() || (announcementPreference === "random" ? PLAY_PHRASES[Math.floor(Math.random() * PLAY_PHRASES.length)] : announcementPreference) })}>{view.intents.length ? "Auch spielen" : "Spielen"}</button><button className="sk-button sk-secondary" disabled={!active} onClick={() => dispatch({ type: "intent", play: false, phrase: announcementSettings.custom.pass.trim() || undefined })}>Weiter</button></div></>}
          {mine && view.phase === "auction" && <><h2>{view.bidLevel ? `Aktuelles Gebot: ${BID_NAMES[view.bidLevel]}` : "Du bietest zuerst: Nenne deine Spielart."}</h2><div className="sk-actions">{view.bidLevels.map(level => <button className="sk-button" key={level} disabled={!active} onClick={() => dispatch({ type: "bid", level, phrase: announcementSettings.custom.bid.trim() || undefined })}>{BID_NAMES[level]}</button>)}<button className="sk-button sk-secondary" disabled={!active || !view.canPassBid} onClick={() => dispatch({ type: "bid", level: null, phrase: announcementSettings.custom.pass.trim() || undefined })}>Weiter</button></div></>}
          {mine && view.phase === "declare" && <>
            {detailStepKey !== selectionKey && <h2>Spielart wählen</h2>}
            {view.forcedCallerReason === "legen" && <p className="sk-forced-game-note">Du hast geklopft: Wähle dein Spiel.</p>}
            {detailStepKey !== selectionKey ? <div className="sk-contract-kinds" role="group" aria-label="Spielart wählen">{gameKindOptions.slice(0, 4).map(option => { const available = availableKinds.some(kind => kind.kind === option.kind); return <button type="button" key={option.kind} className="sk-contract-kind" disabled={!active || !available} title={available ? option.label : `${option.label} ist mit dieser Hand oder dem aktuellen Gebot nicht möglich`} onClick={() => { setChosenKind(option.kind); setChosenSuit(""); setChosenDu(false); setDetailStepKey(selectionKey); }}>{option.label}</button>; })}{availableKinds.filter(option => !gameKindOptions.slice(0, 4).some(primary => primary.kind === option.kind)).map(option => <button type="button" key={option.kind} className="sk-contract-kind" disabled={!active} onClick={() => { setChosenKind(option.kind); setChosenSuit(""); setChosenDu(false); setDetailStepKey(selectionKey); }}>{option.label}</button>)}</div> : <>
              {view.forcedCallerReason === "eichel-ober" && selectedKind === "rufspiel" ? <div className="sk-suit-picker" role="group" aria-label="Gerufene Karte wählen"><strong>Welche<br />Karte?</strong><div className="sk-suit-cards">{variants.map(contract => { const rank = contract.calledRank ?? "Ass"; const card: Card = { id: `${contract.suit}-${rank}`, suit: contract.suit!, rank }; const selected = selectedSuit === contract.suit && selectedCallRank === rank; return <button type="button" key={card.id} className={`sk-suit-card ${selected ? "is-selected" : ""}`} aria-pressed={selected} onClick={() => { setChosenSuit(contract.suit!); setChosenCallRank(rank); }}><CardFace card={card} cardTheme={cardTheme} /><span>{contract.suit}-{rank}</span></button>; })}</div></div> : suits.length > 0 && <div className="sk-suit-picker" role="group" aria-label={selectedKind === "rufspiel" ? "Gerufene Sau wählen" : "Trumpffarbe wählen"}><strong>{selectedKind === "rufspiel" ? <>Auf welches<br />Ass spielst du?</> : <>Trumpffarbe<br />wählen</>}</strong><div className="sk-suit-cards">{SUITS.map(suit => { const enabled = suits.includes(suit); const card: Card = { id: `${suit}-Ass`, suit, rank: "Ass" }; return <button type="button" key={suit} className={`sk-suit-card ${selectedSuit === suit ? "is-selected" : ""}`} disabled={!active || !enabled} aria-pressed={enabled && selectedSuit === suit} aria-label={enabled && selectedKind === "rufspiel" ? RUF_SAU_NAMES[suit as Exclude<Suit, "Herz">] : `${suit}${enabled ? "" : " nicht verfügbar"}`} title={enabled ? suit : `${suit} ist für diese Ansage nicht verfügbar`} onClick={() => { setChosenSuit(suit); setChosenDu(false); }}><CardFace card={card} cardTheme={cardTheme} /><span>{suit}</span></button>; })}</div></div>}
              {matchingSuitVariants.some(contract => contract.tout) && <Toggle checked={selectedDu} disabled={!matchingSuitVariants.some(contract => !contract.tout)} onChange={setChosenDu}>DU · alle acht Stiche</Toggle>}
              <div className="sk-actions sk-contract-confirm"><button className="sk-button sk-secondary" onClick={() => setDetailStepKey("")}>Zurück</button><button className="sk-button" disabled={!active || !chosenContract} aria-label={chosenContract ? `${contractName(chosenContract)} ansagen` : "Spiel ansagen"} onClick={() => { if (!chosenContract) return; const order = sortHand(view.hand, chosenContract).map(card => card.id); setHandLayouts(layouts => ({ ...layouts, [baseHandOrder]: order, [contractHandOrder]: order })); dispatch({ type: "declare", contract: chosenContract, phrase: formatDeclarationAnnouncement(chosenContract, currentAnnouncementSettings) }); }}>Ansagen</button></div>
            </>}
          </>}
          {mine && (view.phase === "kontra" || view.phase === "re") && <><h2>{spritzCount === 1 ? "Re geben?" : spritzCount === 2 ? "Re wurde gegeben" : "Kontra geben?"}</h2><div className="sk-actions">{view.canDouble && <button className="sk-button" disabled={!active} onClick={() => dispatch({ type: "double", accept: true, phrase: (spritzCount === 0 ? announcementSettings.custom.kontra : announcementSettings.custom.re).trim() || undefined })}>{spritzCount === 0 ? "Kontra" : "Re"}</button>}<button className="sk-button sk-secondary" disabled={!active} onClick={() => dispatch({ type: "double", accept: false })}>Weiter</button></div></>}
          {view.phase === "play" && mine && view.canDouble && <div className="sk-spritz-choice"><Toggle checked={spritzWithCard} onChange={setSpritzWithCard}>{["I geb a Spritzn!", "Re", "Sub", "Hirsch"][spritzCount]} mit dieser Karte ansagen</Toggle></div>}
          {mine && view.phase === "trick" && <button className="sk-button" disabled={!active} onClick={() => dispatch({ type: "collect" })}>Stich einsammeln</button>}
        </>}
            </div>
    </aside>
    {!fullscreen && <button type="button" className="sk-button sk-secondary sk-bottom-fullscreen-button" onClick={() => void toggleFullscreen()}><Maximize size={16} />Vollbild starten</button>}
      {view.result && <div className="sk-result sk-bavarian-result"><div className="sk-result-garland" aria-hidden="true">✦ · ✦ · ✦</div><span className="sk-result-kicker">Wirtshauszettel · Runde {view.round}</span><h2>{view.contract?.kind === "ramsch" ? `Ramsch · ${view.result.team.map(seat => view.names[seat]).join(" & ")} ${view.result.team.length === 1 ? "zahlt" : "zahlen"}` : view.result.declarerWon ? (view.result.team.length === 1 ? "Ois g'winnt · Spieler gewinnt" : "Ois g'winnt · Spieler gewinnen") : "Die Gegenseit ham's g'macht"}</h2><p className="sk-result-score">{view.contract?.kind === "ramsch" ? `${view.names.map((name, seat) => `${name}: ${view.points[seat]} Punkte`).join(" · ")}` : `${view.result.team.map(seat => view.names[seat]).join(" & ")} · ${view.result.declarerPoints} : ${view.result.opponentPoints} Punkte`}</p><p className="sk-result-details">{view.contract?.kind === "ramsch" ? `${view.result.ramschDoubleWinners?.length ? `Jungfrau ×2 · ${view.result.ramschDoubleWinners.map(seat => view.names[seat]).join(" & ")} · ` : ""}Ramsch · ` : view.contract?.kind === "sie" ? "Sie · " : view.contract?.tout ? "Tout · " : `${view.result.schwarz ? "Schwarz · " : view.result.schneider ? "Schneider · " : ""}`}{view.contract?.kind !== "ramsch" && `${view.result.laufende} Laufende · `}Spielwert {view.result.value}</p><div className="sk-result-ledger">{view.names.map((name, seat) => <span key={seat}><small>{name}</small><strong>{view.result!.deltas[seat] > 0 ? "+" : ""}{view.result!.deltas[seat]}</strong></span>)}</div><small className="sk-result-footer">Der Zettel ist geschrieben. Auf zur nächsten Rund'!</small></div>}
    </section>
  </main>;
}
