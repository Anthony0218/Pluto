import { useRef, useEffect, useMemo, useState, type ReactNode } from "react";

import { Chess, type Square } from "chess.js";

import { getSquareName, type PieceType } from "../utils/chessUtils";

import Board from "./Board";

import {
  playPieceCaptureSound,
  playPieceMoveSound,
  playPieceSelectSound,
  playRandomSound,
} from "../utils/sound.ts";

import PromotionBar from "./PromotionBar";

import {
  BOUNTY_REWARD_MAX,
  BOUNTY_REWARD_MIN,
  MISSION_REWARD_MAX,
  MISSION_REWARD_MIN,
  ROYAL_POWER_COSTS,
  SHOP_PIECE_COSTS,
  STARTING_COINS,
  applyRoyalPower,
  buyPiece,
  canBuyPiece,
  canUseRoyalPower,
  getAvailableShopSquares,
  getMissionRewardLabel,
  getShopSpawnSquares,
  createCapitalismSeed,
  createInitialCapitalState,
  isThreefoldFromCapitalRecords,
  missionDefinitions,
  pieceValues,
  resolveCapitalismAfterMove,
  type CapitalSide,
  type CapitalState,
  type CapitalismMoveRecord,
  type RoyalPowerId,
  type ShopPieceType,
} from "../games/chess/variants/capitalismChess";

import { buildCapitalismStats } from "../games/chess/variants/capitalismStats";
import { useDelayedBoardOrientation } from "@/hooks/useDelayedBoardOrientation.ts";
import BoardAnimationToggle from "./BoardAnimationToggle.tsx";
import { useVariantChessAi } from "@/hooks/useVariantChessAi";
import {
  chessColorFromPlayerColor,
  oppositeChessColor,
  type Difficulty,
  type ChessPlayerColor,
} from "../games/chess/ai/variantAi";

/* =========================================================
   TYPES
   ========================================================= */

type Language = "en" | "de" | "bar" | "ko" | "ru";

type StatsTab = "overview" | "market" | "moments";

type Winner = "white" | "black" | "draw";

const CHESS_LANGUAGE_STORAGE_KEY = "chess-language";

/* =========================================================
   PIECE DISPLAY
   ========================================================= */

const whiteSymbols: Record<string, string> = {
  p: "♙",
  n: "♘",
  b: "♗",
  r: "♖",
  q: "♕",
  k: "♔",
};

const blackSymbols: Record<string, string> = {
  p: "♟",
  n: "♞",
  b: "♝",
  r: "♜",
  q: "♛",
  k: "♚",
};

/* =========================================================
   TRANSLATIONS
   ========================================================= */

const translations: Record<Exclude<Language, "en">, Record<string, string>> = {
  de: {
    Rulebook: "Regelbuch",
    "King Journey": "Königsreise",
    "Reach the marked square with your King":
      "Erreiche mit deinem König das markierte Feld",
    Target: "Ziel",
    "Survival mission": "Überlebensmission",
    "Reward is random — even a Pawn can be worth a fortune":
      "Belohnung ist zufällig — selbst ein Bauer kann ein Vermögen wert sein",
    "Each new mission gets a random contract reward":
      "Jede neue Mission erhält eine zufällige Vertragsbelohnung",
    "+ mission bonus stacks with the normal action reward":
      "+ Missionsbonus wird zusätzlich zur normalen Aktionsbelohnung gezahlt",
    "Piece Market": "Figurenmarkt",
    "Buy a piece and spawn it on an empty rook home square":
      "Figur kaufen und auf einem freien ursprünglichen Turmfeld einsetzen",
    "No rook home square is free": "Kein ursprüngliches Turmfeld ist frei",
    "Cannot buy while in check":
      "Im Schach können keine Figuren gekauft werden",
    Buy: "Kaufen",
    Spawn: "Einsetzen",
    Pawn: "Bauer",
    Knight: "Springer",
    Bishop: "Läufer",
    Rook: "Turm",
    Queen: "Dame",
    coins: "Münzen",
    "Chess Variant": "Schachvariante",
    "Capitalism Chess": "Kapitalismus-Schach",
    "Earn coins. Chase bounties. Spend the treasury.":
      "Münzen verdienen, Kopfgelder jagen und die Schatzkammer nutzen.",
    Language: "Sprache",
    "White to move": "Weiß am Zug",
    "Black to move": "Schwarz am Zug",
    "Game Controls": "Spielsteuerung",
    "Players and actions": "Spieler und Aktionen",
    "White player": "Spieler Weiß",
    "Black player": "Spieler Schwarz",
    White: "Weiß",
    Black: "Schwarz",
    Undo: "Rückgängig",
    Restart: "Neustart",
    "Captured Pieces": "Geschlagene Figuren",
    "Material overview": "Materialübersicht",
    Equal: "Gleich",
    "Move History": "Zugverlauf",
    "Game history": "Partieverlauf",
    "No moves yet": "Noch keine Züge",
    Move: "Zug",
    Side: "Seite",
    Played: "Gespielt",
    "Game Over": "Spielende",
    "White wins": "Weiß gewinnt",
    "Black wins": "Schwarz gewinnt",
    Draw: "Remis",
    Checkmate: "Schachmatt",
    Stalemate: "Patt",
    "Insufficient material": "Unzureichendes Material",
    "50-move rule": "50-Züge-Regel",
    "Threefold repetition": "Dreifache Stellungswiederholung",
    "History Preview": "Verlaufsansicht",
    "Back to Live Board": "Zurück zum Live-Brett",
    Treasury: "Schatzkammer",
    "Current coins": "Aktuelle Münzen",
    Contracts: "Aufträge",
    Bounty: "Kopfgeld",
    Mission: "Mission",
    Reward: "Belohnung",
    "Royal Powers": "Königliche Mächte",
    "Current player may spend coins":
      "Der aktuelle Spieler darf Münzen ausgeben",
    "Royal Investment": "Königliche Investition",
    "Double the next capture income":
      "Verdoppelt den Ertrag der nächsten geschlagenen Figur",
    "Mission Decree": "Missionsdekret",
    "Reroll your current mission": "Aktuelle Mission neu würfeln",
    "Bounty Decree": "Kopfgelddekret",
    "Reroll your bounty target": "Kopfgeldziel neu würfeln",
    Used: "Benutzt",
    Armed: "Aktiv",
    "Need more coins": "Mehr Münzen benötigt",
    "Capitalism Stats": "Kapitalismus-Statistik",
    "Fun economy numbers": "Spaßzahlen zur Wirtschaft",
    Overview: "Übersicht",
    Market: "Markt",
    Moments: "Momente",
    "Earned by White": "Von Weiß verdient",
    "Earned by Black": "Von Schwarz verdient",
    "Bounties claimed": "Kopfgelder kassiert",
    "Missions completed": "Missionen erfüllt",
    "Total power spending": "Ausgaben für Mächte",
    "Capture income": "Einnahmen aus Schlägen",
    "Check income": "Einnahmen aus Schach",
    "Bounty income": "Kopfgeldeinnahmen",
    "Mission income": "Missionseinnahmen",
    "Castle + promotion": "Rochade + Umwandlung",
    "Investment bonus": "Investitionsbonus",
    "Biggest payday": "Größter Zahltag",
    "Economy moments": "Wirtschaftsmomente",
    "No big economy moments yet": "Noch keine großen Wirtschaftsmomente",
    "Click a moment to show that position":
      "Moment anklicken, um die Stellung zu zeigen",
    "Give check": "Schach geben",
    "Put the enemy king in check": "Den gegnerischen König ins Schach setzen",
    "Make a capture": "Eine Figur schlagen",
    "Capture any enemy piece": "Eine beliebige gegnerische Figur schlagen",
    "Hunt a minor piece": "Leichtfigur jagen",
    "Capture a Knight or Bishop": "Springer oder Läufer schlagen",
    "Pawn business": "Bauerngeschäft",
    "Make a capture with a Pawn": "Mit einem Bauern schlagen",
    "Knight audit": "Springerprüfung",
    "Give check with a Knight": "Mit einem Springer Schach geben",
    "Expand the market": "Markt erweitern",
    "Move a Pawn into the enemy half":
      "Einen Bauern in die gegnerische Hälfte bringen",
    "Secure the treasury": "Schatzkammer sichern",
    "Castle either side": "Kurz oder lang rochieren",
    "No target": "Kein Ziel",
  },

  bar: {
    Rulebook: "Regelbuch",
    "King Journey": "Kini-Reis",
    "Reach the marked square with your King":
      "Bring dein Kini aufs markierte Feld",
    Target: "Ziel",
    "Survival mission": "Überlebensmission",
    "Reward is random — even a Pawn can be worth a fortune":
      "Belohnung is zufällig — aa a Bauer ko a Vermögn wert sei",
    "Each new mission gets a random contract reward":
      "Jede neue Mission kriagt a zufällige Belohnung",
    "+ mission bonus stacks with the normal action reward":
      "+ Missionsbonus kimmt zusätzlich zur normalen Belohnung",
    "Piece Market": "Figurenmarkt",
    "Buy a piece and spawn it on an empty rook home square":
      "Figur kaufn und auf am freien Turm-Startfeld einsetzn",
    "No rook home square is free": "Koa Turm-Startfeld is frei",
    "Cannot buy while in check": "Im Schach ko ma koa Figur kaufn",
    Buy: "Kaffa",
    Spawn: "Einsetzn",
    Pawn: "Bauer",
    Knight: "Springer",
    Bishop: "Läufer",
    Rook: "Turm",
    Queen: "Dame",
    coins: "Münzn",
    "Chess Variant": "Schachvariantn",
    "Capitalism Chess": "Kapitalismus-Schach",
    "Earn coins. Chase bounties. Spend the treasury.":
      "Münzn macha, Kopfgeld jagn und ausgebn.",
    Language: "Sproch",
    "White to move": "Weiß is dro",
    "Black to move": "Schwarz is dro",
    "Game Controls": "Spielsteuerung",
    "Players and actions": "Spieler und Aktionen",
    "White player": "Weißer Spieler",
    "Black player": "Schwarzer Spieler",
    White: "Weiß",
    Black: "Schwarz",
    Undo: "Zruck",
    Restart: "Neu startn",
    "Captured Pieces": "G'schlagene Figuren",
    "Material overview": "Material",
    Equal: "Gleich",
    "Move History": "Zugverlauf",
    "Game history": "Partieverlauf",
    "No moves yet": "No koa Zug",
    Move: "Zug",
    Side: "Seitn",
    Played: "G'spuit",
    "Game Over": "Spiel aus",
    "White wins": "Weiß gwinnt",
    "Black wins": "Schwarz gwinnt",
    Draw: "Remis",
    "History Preview": "Verlaufsansicht",
    "Back to Live Board": "Zruck zum Live-Brett",
    Treasury: "Schatzkammer",
    "Current coins": "Aktuelle Münzn",
    Contracts: "Aufträg",
    Bounty: "Kopfgeld",
    Mission: "Mission",
    Reward: "Belohnung",
    "Royal Powers": "Kini-Mächt",
    "Current player may spend coins": "Der Spieler am Zug ko Münzn ausgebn",
    "Royal Investment": "Kini-Investition",
    "Double the next capture income": "Nächster Schlag bringt doppelt",
    "Mission Decree": "Missionsdekret",
    "Reroll your current mission": "Mission neu auswürfeln",
    "Bounty Decree": "Kopfgelddekret",
    "Reroll your bounty target": "Kopfgeld neu auswürfeln",
    Used: "Benutzt",
    Armed: "Aktiv",
    "Need more coins": "Mehr Münzn nötig",
    "Capitalism Stats": "Kapitalismus-Statistik",
    "Fun economy numbers": "Lustige Wirtschaftszahlen",
    Overview: "Übersicht",
    Market: "Markt",
    Moments: "Momente",
    "Earned by White": "Weiß verdient",
    "Earned by Black": "Schwarz verdient",
    "Bounties claimed": "Kopfgeld kassiert",
    "Missions completed": "Missionen gschafft",
    "Total power spending": "Ausgaben für Mächt",
    "Capture income": "Schlag-Einnahmen",
    "Check income": "Schach-Einnahmen",
    "Bounty income": "Kopfgeld-Einnahmen",
    "Mission income": "Mission-Einnahmen",
    "Castle + promotion": "Rochade + Umwandlung",
    "Investment bonus": "Investitionsbonus",
    "Biggest payday": "Größter Zahltag",
    "Economy moments": "Wirtschaftsmomente",
    "No big economy moments yet": "No koa großer Wirtschaftsmoment",
    "Click a moment to show that position": "Moment anklickn für de Stellung",
    "Give check": "Schach gebn",
    "Put the enemy king in check": "Den gegnerischen Kini ins Schach setzn",
    "Make a capture": "A Figur schlogn",
    "Capture any enemy piece": "Irgendeine gegnerische Figur schlogn",
    "Hunt a minor piece": "Leichtfigur jagn",
    "Capture a Knight or Bishop": "Springer oder Läufer schlogn",
    "Pawn business": "Bauerngschäft",
    "Make a capture with a Pawn": "Mit'm Bauern schlogn",
    "Knight audit": "Springerprüfung",
    "Give check with a Knight": "Mit'm Springer Schach gebn",
    "Expand the market": "Markt erweitern",
    "Move a Pawn into the enemy half": "Bauern in de gegnerische Hälfte bringa",
    "Secure the treasury": "Schatzkammer sichern",
    "Castle either side": "Rochiern",
    "No target": "Koa Ziel",
  },

  ko: {
    Rulebook: "규칙 설명",
    "King Journey": "킹 여정",
    "Reach the marked square with your King":
      "킹으로 표시된 목표 칸에 도달하세요",
    Target: "목표",
    "Survival mission": "생존 미션",
    "Reward is random — even a Pawn can be worth a fortune":
      "보상은 무작위입니다 — 폰도 대박 현상금이 걸릴 수 있습니다",
    "Each new mission gets a random contract reward":
      "새 미션마다 무작위 계약 보상이 정해집니다",
    "+ mission bonus stacks with the normal action reward":
      "+ 미션 보너스는 기본 행동 보상에 추가로 지급됩니다",
    "Piece Market": "기물 시장",
    "Buy a piece and spawn it on an empty rook home square":
      "기물을 구입해 비어 있는 자신의 룩 시작 칸에 배치합니다",
    "No rook home square is free": "비어 있는 룩 시작 칸이 없습니다",
    "Cannot buy while in check": "체크 상태에서는 기물을 구입할 수 없습니다",
    Buy: "구입",
    Spawn: "배치",
    Pawn: "폰",
    Knight: "나이트",
    Bishop: "비숍",
    Rook: "룩",
    Queen: "퀸",
    coins: "코인",
    "Chess Variant": "체스 변형",
    "Capitalism Chess": "자본주의 체스",
    "Earn coins. Chase bounties. Spend the treasury.":
      "코인을 벌고, 현상금을 노리고, 왕실 능력에 사용하세요.",
    Language: "언어",
    "White to move": "백 차례",
    "Black to move": "흑 차례",
    "Game Controls": "게임 컨트롤",
    "Players and actions": "플레이어 및 게임 조작",
    "White player": "백 플레이어",
    "Black player": "흑 플레이어",
    White: "백",
    Black: "흑",
    Undo: "되돌리기",
    Restart: "새 게임",
    "Captured Pieces": "잡힌 기물",
    "Material overview": "기물 현황",
    Equal: "동일",
    "Move History": "수 기록",
    "Game history": "게임 기록",
    "No moves yet": "아직 수가 없습니다",
    Move: "수",
    Side: "진영",
    Played: "착수",
    "Game Over": "게임 종료",
    "White wins": "백 승리",
    "Black wins": "흑 승리",
    Draw: "무승부",
    Checkmate: "체크메이트",
    Stalemate: "스테일메이트",
    "Insufficient material": "기물 부족",
    "50-move rule": "50수 규칙",
    "Threefold repetition": "3회 동형 반복",
    "History Preview": "기록 미리보기",
    "Back to Live Board": "현재 보드로 돌아가기",
    Treasury: "금고",
    "Current coins": "현재 코인",
    Contracts: "계약",
    Bounty: "현상금",
    Mission: "미션",
    Reward: "보상",
    "Royal Powers": "왕실 능력",
    "Current player may spend coins":
      "현재 차례 플레이어가 코인을 사용할 수 있습니다",
    "Royal Investment": "왕실 투자",
    "Double the next capture income": "다음 기물 포획 수입을 두 배로",
    "Mission Decree": "미션 칙령",
    "Reroll your current mission": "현재 미션 다시 뽑기",
    "Bounty Decree": "현상금 칙령",
    "Reroll your bounty target": "현상금 목표 다시 뽑기",
    Used: "사용됨",
    Armed: "활성",
    "Need more coins": "코인이 부족합니다",
    "Capitalism Stats": "자본주의 통계",
    "Fun economy numbers": "이번 게임의 재미있는 경제 기록",
    Overview: "개요",
    Market: "시장",
    Moments: "순간들",
    "Earned by White": "백 수입",
    "Earned by Black": "흑 수입",
    "Bounties claimed": "현상금 획득",
    "Missions completed": "미션 완료",
    "Total power spending": "왕실 능력 지출",
    "Capture income": "포획 수입",
    "Check income": "체크 수입",
    "Bounty income": "현상금 수입",
    "Mission income": "미션 수입",
    "Castle + promotion": "캐슬링 + 프로모션",
    "Investment bonus": "투자 보너스",
    "Biggest payday": "최대 수입 수",
    "Economy moments": "경제 하이라이트",
    "No big economy moments yet": "아직 큰 경제 이벤트가 없습니다",
    "Click a moment to show that position":
      "이벤트를 클릭하면 해당 보드를 표시합니다",
    "Give check": "체크하기",
    "Put the enemy king in check": "상대 킹을 체크하세요",
    "Make a capture": "기물 잡기",
    "Capture any enemy piece": "아무 상대 기물이나 잡으세요",
    "Hunt a minor piece": "마이너 피스 사냥",
    "Capture a Knight or Bishop": "나이트 또는 비숍을 잡으세요",
    "Pawn business": "폰 비즈니스",
    "Make a capture with a Pawn": "폰으로 기물을 잡으세요",
    "Knight audit": "나이트 감사",
    "Give check with a Knight": "나이트로 체크하세요",
    "Expand the market": "시장 확장",
    "Move a Pawn into the enemy half": "폰을 상대 진영 절반으로 진출시키세요",
    "Secure the treasury": "금고 확보",
    "Castle either side": "킹사이드 또는 퀸사이드 캐슬링",
    "No target": "목표 없음",
  },

  ru: {
    Rulebook: "Правила",
    "King Journey": "Путь короля",
    "Reach the marked square with your King":
      "Доведите короля до отмеченного поля",
    Target: "Цель",
    "Survival mission": "Миссия выживания",
    "Reward is random — even a Pawn can be worth a fortune":
      "Награда случайна — даже пешка может стоить целое состояние",
    "Each new mission gets a random contract reward":
      "Каждая новая миссия получает случайную награду",
    "+ mission bonus stacks with the normal action reward":
      "+ бонус миссии добавляется к обычной награде за действие",
    "Piece Market": "Рынок фигур",
    "Buy a piece and spawn it on an empty rook home square":
      "Купите фигуру и поставьте её на свободное исходное поле ладьи",
    "No rook home square is free": "Нет свободного исходного поля ладьи",
    "Cannot buy while in check": "Нельзя покупать фигуры под шахом",
    Buy: "Купить",
    Spawn: "Поставить",
    Pawn: "Пешка",
    Knight: "Конь",
    Bishop: "Слон",
    Rook: "Ладья",
    Queen: "Ферзь",
    coins: "монет",
    "Chess Variant": "Шахматный вариант",
    "Capitalism Chess": "Капиталистические шахматы",
    "Earn coins. Chase bounties. Spend the treasury.":
      "Зарабатывайте монеты, охотьтесь за наградами и тратьте казну.",
    Language: "Язык",
    "White to move": "Ход белых",
    "Black to move": "Ход чёрных",
    "Game Controls": "Управление",
    "Players and actions": "Игроки и действия",
    "White player": "Белые",
    "Black player": "Чёрные",
    White: "Белые",
    Black: "Чёрные",
    Undo: "Отменить",
    Restart: "Заново",
    "Captured Pieces": "Взятые фигуры",
    "Material overview": "Материал",
    Equal: "Равно",
    "Move History": "История ходов",
    "Game history": "История партии",
    "No moves yet": "Ходов пока нет",
    Move: "Ход",
    Side: "Сторона",
    Played: "Сыграно",
    "Game Over": "Игра окончена",
    "White wins": "Белые победили",
    "Black wins": "Чёрные победили",
    Draw: "Ничья",
    Checkmate: "Мат",
    Stalemate: "Пат",
    "Insufficient material": "Недостаточно материала",
    "50-move rule": "Правило 50 ходов",
    "Threefold repetition": "Троекратное повторение",
    "History Preview": "Просмотр истории",
    "Back to Live Board": "Вернуться к текущей позиции",
    Treasury: "Казна",
    "Current coins": "Текущие монеты",
    Contracts: "Контракты",
    Bounty: "Награда",
    Mission: "Миссия",
    Reward: "Награда",
    "Royal Powers": "Королевские силы",
    "Current player may spend coins": "Игрок на ходу может тратить монеты",
    "Royal Investment": "Королевская инвестиция",
    "Double the next capture income": "Удвоить доход со следующего взятия",
    "Mission Decree": "Указ о миссии",
    "Reroll your current mission": "Сменить текущую миссию",
    "Bounty Decree": "Указ о награде",
    "Reroll your bounty target": "Сменить цель награды",
    Used: "Использовано",
    Armed: "Активно",
    "Need more coins": "Недостаточно монет",
    "Capitalism Stats": "Статистика капитализма",
    "Fun economy numbers": "Забавные экономические цифры",
    Overview: "Обзор",
    Market: "Рынок",
    Moments: "Моменты",
    "Earned by White": "Доход белых",
    "Earned by Black": "Доход чёрных",
    "Bounties claimed": "Получено наград",
    "Missions completed": "Миссий выполнено",
    "Total power spending": "Расходы на силы",
    "Capture income": "Доход со взятий",
    "Check income": "Доход за шах",
    "Bounty income": "Доход с наград",
    "Mission income": "Доход с миссий",
    "Castle + promotion": "Рокировка + превращение",
    "Investment bonus": "Инвестиционный бонус",
    "Biggest payday": "Крупнейший заработок",
    "Economy moments": "Экономические моменты",
    "No big economy moments yet": "Крупных экономических моментов пока нет",
    "Click a moment to show that position":
      "Нажмите момент, чтобы показать позицию",
    "Give check": "Дать шах",
    "Put the enemy king in check": "Поставьте короля соперника под шах",
    "Make a capture": "Сделать взятие",
    "Capture any enemy piece": "Возьмите любую фигуру соперника",
    "Hunt a minor piece": "Охота на лёгкую фигуру",
    "Capture a Knight or Bishop": "Возьмите коня или слона",
    "Pawn business": "Пешечный бизнес",
    "Make a capture with a Pawn": "Сделайте взятие пешкой",
    "Knight audit": "Конная проверка",
    "Give check with a Knight": "Дайте шах конём",
    "Expand the market": "Расширить рынок",
    "Move a Pawn into the enemy half": "Продвиньте пешку на половину соперника",
    "Secure the treasury": "Защитить казну",
    "Castle either side": "Сделайте рокировку",
    "No target": "Нет цели",
  },
};

function getInitialLanguage(): Language {
  if (typeof window === "undefined") {
    return "en";
  }

  const stored = window.localStorage.getItem(CHESS_LANGUAGE_STORAGE_KEY);

  if (
    stored === "en" ||
    stored === "de" ||
    stored === "bar" ||
    stored === "ko" ||
    stored === "ru"
  ) {
    return stored;
  }

  return "en";
}

/* =========================================================
   COMPONENT
   ========================================================= */

type VariantAiBoardProps = {
  aiMode?: boolean;
  playerColor?: ChessPlayerColor;
  difficulty?: Difficulty;
  onChangeSettings?: () => void;
};

export default function CapitalismChessBoard({
  aiMode = false,
  playerColor = "white",
  difficulty = "casual",
}: VariantAiBoardProps) {
  const [language, setLanguage] = useState<Language>(getInitialLanguage);

  const t = (key: string) => {
    if (language === "en") {
      return key;
    }

    if (language === "bar") {
      return translations.bar[key] ?? translations.de[key] ?? key;
    }

    return translations[language][key] ?? key;
  };

  function changeLanguage(nextLanguage: Language) {
    setLanguage(nextLanguage);

    if (typeof window !== "undefined") {
      window.localStorage.setItem(CHESS_LANGUAGE_STORAGE_KEY, nextLanguage);
    }
  }

  /* =======================================================
     GAME + ECONOMY STATE
     ======================================================= */

  const [game] = useState(() => new Chess());

  const [capitalSeed, setCapitalSeed] = useState<number>(createCapitalismSeed);

  const [capitalState, setCapitalState] = useState<CapitalState>(() =>
    createInitialCapitalState(new Chess(), capitalSeed),
  );

  const [records, setRecords] = useState<CapitalismMoveRecord[]>([]);

  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);

  const [legalMoves, setLegalMoves] = useState<Square[]>([]);

  const [lastMove, setLastMove] = useState<{
    from: Square;
    to: Square;
  } | null>(null);

  const [promotionFrom, setPromotionFrom] = useState<Square | null>(null);

  const [promotionSquare, setPromotionSquare] = useState<Square | null>(null);

  const [gameOver, setGameOver] = useState(false);

  const [gameOverReason, setGameOverReason] = useState("");

  const [winner, setWinner] = useState<Winner>("white");

  const [historyPreviewPly, setHistoryPreviewPly] = useState<number | null>(
    null,
  );

  const humanColor = chessColorFromPlayerColor(playerColor);
  const computerColor = oppositeChessColor(humanColor);

  const { ready: aiReady, chooseMove: chooseAiMove } = useVariantChessAi(
    aiMode,
    difficulty,
  );

  const aiMovePendingRef = useRef(false);

  useEffect(() => {
    if (
      !aiMode ||
      !aiReady ||
      aiMovePendingRef.current ||
      gameOver ||
      historyPreviewPly !== null ||
      promotionFrom ||
      promotionSquare ||
      game.turn() !== computerColor
    ) {
      return;
    }

    const expectedFen = game.fen();
    let cancelled = false;
    aiMovePendingRef.current = true;

    const timer = window.setTimeout(async () => {
      try {
        const move = await chooseAiMove(game);

        if (
          cancelled ||
          !move ||
          game.fen() !== expectedFen ||
          game.turn() !== computerColor
        ) {
          return;
        }

        commitMove(move.from, move.to, move.promotion);
      } finally {
        aiMovePendingRef.current = false;
      }
    }, 220);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    aiMode,
    aiReady,
    computerColor,
    records.length,
    gameOver,
    historyPreviewPly,
    promotionFrom,
    promotionSquare,
    chooseAiMove,
  ]);

  const [statsTab, setStatsTab] = useState<StatsTab>("overview");

  /* =======================================================
     DERIVED
     ======================================================= */

  const historyPreview =
    historyPreviewPly !== null
      ? (records[historyPreviewPly - 1] ?? null)
      : null;

  const historyPreviewChess = useMemo(
    () => (historyPreview ? new Chess(historyPreview.fenAfter) : null),
    [historyPreview?.fenAfter],
  );

  const displayedChess = historyPreviewChess ?? game;

  const displayedBoard = displayedChess.board();

  const displayedCapitalState = historyPreview?.stateAfter ?? capitalState;

  const {
    orientation: liveBoardOrientation,
    flipPending,
    snapToSide,
  } = useDelayedBoardOrientation(aiMode ? humanColor : game.turn(), 1500);

  const boardOrientation: "white" | "black" = historyPreviewChess
    ? historyPreviewChess.turn() === "w"
      ? "white"
      : "black"
    : liveBoardOrientation;

  const historyPreviewMove = historyPreview
    ? {
        from: historyPreview.from,
        to: historyPreview.to,
      }
    : null;

  const checkedKingSquare = getCheckedKingSquare(game);

  const historyPreviewCheckedKingSquare = historyPreviewChess
    ? getCheckedKingSquare(historyPreviewChess)
    : null;

  const displayedBountySquares = [
    displayedCapitalState.bountyTargets.white,
    displayedCapitalState.bountyTargets.black,
  ].filter((square): square is Square => square !== null);

  const displayedWhiteMission = displayedCapitalState.missions.white;

  const displayedBlackMission = displayedCapitalState.missions.black;

  const displayedWhiteMissionTargetSquares: Square[] =
    displayedWhiteMission.id === "king_journey" &&
    displayedWhiteMission.targetSquare
      ? [displayedWhiteMission.targetSquare]
      : [];

  const displayedBlackMissionTargetSquares: Square[] =
    displayedBlackMission.id === "king_journey" &&
    displayedBlackMission.targetSquare
      ? [displayedBlackMission.targetSquare]
      : [];

  const capturedWhite = useMemo(
    () =>
      records
        .filter((record) => record.color === "b" && record.captured)
        .map((record) => record.captured as PieceType),
    [records],
  );

  const capturedBlack = useMemo(
    () =>
      records
        .filter((record) => record.color === "w" && record.captured)
        .map((record) => record.captured as PieceType),
    [records],
  );

  const whiteMaterial = capturedBlack.reduce(
    (total, piece) =>
      total + (pieceValues[piece as keyof typeof pieceValues] ?? 0),
    0,
  );

  const blackMaterial = capturedWhite.reduce(
    (total, piece) =>
      total + (pieceValues[piece as keyof typeof pieceValues] ?? 0),
    0,
  );

  const materialDifference = whiteMaterial - blackMaterial;

  const currentSide: CapitalSide = game.turn() === "w" ? "white" : "black";

  const shopSpawnSquares = getShopSpawnSquares(currentSide);

  const availableShopSquares = getAvailableShopSquares(game, currentSide);

  const stats = useMemo(
    () => buildCapitalismStats(records, capitalState),
    [records, capitalState],
  );

  /* =======================================================
     SOUND
     ======================================================= */

  function playSound(sound: string) {
    const audio = new Audio(`/sounds/${sound}.mp3`);

    audio.play().catch(() => {});
  }

  /* =======================================================
     GAME OVER
     ======================================================= */

  function updateGameOver(
    nextRecords: CapitalismMoveRecord[],
    playResultSound = false,
  ) {
    if (game.isCheckmate()) {
      setGameOver(true);

      setGameOverReason("Checkmate");

      setWinner(game.turn() === "w" ? "black" : "white");

      if (playResultSound) {
        playSound("checkmate");
      }

      return true;
    }

    if (game.isStalemate()) {
      setGameOver(true);

      setGameOverReason("Stalemate");

      setWinner("draw");

      if (playResultSound) {
        playSound("draw");
      }

      return true;
    }

    if (game.isInsufficientMaterial()) {
      setGameOver(true);

      setGameOverReason("Insufficient material");

      setWinner("draw");

      if (playResultSound) {
        playSound("draw");
      }

      return true;
    }

    if (game.isDrawByFiftyMoves()) {
      setGameOver(true);

      setGameOverReason("50-move rule");

      setWinner("draw");

      if (playResultSound) {
        playSound("draw");
      }

      return true;
    }

    if (isThreefoldFromCapitalRecords(nextRecords, game.fen())) {
      setGameOver(true);

      setGameOverReason("Threefold repetition");

      setWinner("draw");

      if (playResultSound) {
        playSound("draw");
      }

      return true;
    }

    setGameOver(false);

    setGameOverReason("");

    return false;
  }

  /* =======================================================
     MOVE
     ======================================================= */

  function commitMove(
    from: Square,
    to: Square,
    promotion?: "q" | "r" | "b" | "n",
  ) {
    if (gameOver || historyPreview) {
      return;
    }

    const destinationPiece = game.get(to);

    try {
      const move = game.move({
        from,
        to,
        promotion,
      });

      const captured =
        move.captured === "p" ||
        move.captured === "n" ||
        move.captured === "b" ||
        move.captured === "r" ||
        move.captured === "q"
          ? move.captured
          : undefined;

      const promotedTo =
        move.promotion === "q" ||
        move.promotion === "r" ||
        move.promotion === "b" ||
        move.promotion === "n"
          ? move.promotion
          : undefined;

      let capturedSquare: Square | null = null;

      if (captured) {
        /*
         * If destination was empty before a capture,
         * this was en-passant.
         */
        capturedSquare = destinationPiece
          ? move.to
          : (`${move.to[0]}${move.from[1]}` as Square);
      }

      const economyResult = resolveCapitalismAfterMove({
        previousState: capitalState,
        gameAfterMove: game,
        seed: capitalSeed,
        move: {
          color: move.color,
          piece: move.piece,
          from: move.from,
          to: move.to,
          captured,
          capturedSquare,
          promotion: promotedTo,
          isCheck: game.isCheck(),
          isCastle: move.isKingsideCastle() || move.isQueensideCastle(),
          isKingsideCastle: move.isKingsideCastle(),
        },
      });

      const nextPly = records.length + 1;

      const record: CapitalismMoveRecord = {
        ply: nextPly,
        moveNumber: Math.ceil(nextPly / 2),
        color: move.color,
        san: move.san,
        from: move.from,
        to: move.to,
        piece: move.piece,
        captured,
        promotion: promotedTo,
        fenAfter: game.fen(),
        economy: economyResult.event,
        stateAfter: economyResult.state,
      };

      const nextRecords = [...records, record];

      setRecords(nextRecords);

      setCapitalState(economyResult.state);

      setLastMove({
        from: move.from,
        to: move.to,
      });

      setSelectedSquare(null);
      setLegalMoves([]);
      setPromotionFrom(null);
      setPromotionSquare(null);
      setHistoryPreviewPly(null);

      if (captured) {
        playPieceCaptureSound(move.piece);
      } else {
        playPieceMoveSound(move.piece);
      }

      const ended = updateGameOver(nextRecords, true);

      if (!ended) {
        if (game.isCheck()) {
          playSound("check");
        } else if (move.isKingsideCastle() || move.isQueensideCastle()) {
          playRandomSound(["castle-1", "castle-2"]);
        }
      }
    } catch {
      playSound("illegal");

      setSelectedSquare(null);
      setLegalMoves([]);
    }
  }

  /* =======================================================
     INPUT
     ======================================================= */

  function handleSquareClick(row: number, column: number) {
    if (aiMode && game.turn() !== humanColor) return;

    if (gameOver || historyPreview) {
      return;
    }

    const square = getSquareName(row, column);

    if (selectedSquare === null) {
      const piece = game.get(square);

      if (!piece || piece.color !== game.turn()) {
        return;
      }

      setSelectedSquare(square);

      playPieceSelectSound(piece.type);

      const moves = game.moves({
        square,
        verbose: true,
      });

      setLegalMoves(moves.map((move) => move.to));

      return;
    }

    const selectedPiece = game.get(selectedSquare);

    if (
      selectedPiece?.type === "p" &&
      legalMoves.includes(square) &&
      (square[1] === "8" || square[1] === "1")
    ) {
      setPromotionFrom(selectedSquare);

      setPromotionSquare(square);

      setSelectedSquare(null);

      setLegalMoves([]);

      return;
    }

    if (!legalMoves.includes(square)) {
      const clickedPiece = game.get(square);

      if (clickedPiece && clickedPiece.color === game.turn()) {
        setSelectedSquare(square);

        playPieceSelectSound(clickedPiece.type);

        const moves = game.moves({
          square,
          verbose: true,
        });

        setLegalMoves(moves.map((move) => move.to));

        return;
      }

      setSelectedSquare(null);

      setLegalMoves([]);

      playSound("illegal");

      return;
    }

    commitMove(selectedSquare, square);
  }

  function promotePawn(piece: "q" | "r" | "b" | "n") {
    if (!promotionFrom || !promotionSquare) {
      return;
    }

    commitMove(promotionFrom, promotionSquare, piece);
  }

  /* =======================================================
     ROYAL POWERS
     ======================================================= */

  function purchasePiece(piece: ShopPieceType, square: Square) {
    if (aiMode && game.turn() !== humanColor) return;

    if (gameOver || historyPreview) {
      return;
    }

    if (
      !canBuyPiece({
        state: capitalState,
        game,
        side: currentSide,
        piece,
        square,
      })
    ) {
      playSound("illegal");
      return;
    }

    const nextState = buyPiece({
      state: capitalState,
      game,
      seed: capitalSeed,
      side: currentSide,
      piece,
      square,
    });

    setCapitalState(nextState);

    setSelectedSquare(null);
    setLegalMoves([]);
    setPromotionFrom(null);
    setPromotionSquare(null);
  }

  function useRoyalPower(power: RoyalPowerId) {
    if (aiMode && game.turn() !== humanColor) return;

    if (gameOver || historyPreview) {
      return;
    }

    setCapitalState((current) =>
      applyRoyalPower({
        state: current,
        game,
        seed: capitalSeed,
        side: currentSide,
        power,
      }),
    );
  }

  /* =======================================================
     UNDO / RESTART
     ======================================================= */

  function undoMove() {
    if (aiMode || records.length === 0) return;

    const nextRecords = records.slice(0, -1);

    const targetFen =
      nextRecords[nextRecords.length - 1]?.fenAfter ?? new Chess().fen();

    game.load(targetFen);
    snapToSide(game.turn());

    const restoredState =
      nextRecords[nextRecords.length - 1]?.stateAfter ??
      createInitialCapitalState(new Chess(), capitalSeed);

    setRecords(nextRecords);

    setCapitalState(restoredState);

    const previous = nextRecords[nextRecords.length - 1] ?? null;

    setLastMove(
      previous
        ? {
            from: previous.from,
            to: previous.to,
          }
        : null,
    );

    setSelectedSquare(null);
    setLegalMoves([]);
    setPromotionFrom(null);
    setPromotionSquare(null);
    setHistoryPreviewPly(null);

    setGameOver(false);
    setGameOverReason("");

    updateGameOver(nextRecords, false);
  }

  function restartGame() {
    game.reset();
    snapToSide(game.turn());

    const nextSeed = createCapitalismSeed();

    setCapitalSeed(nextSeed);

    setCapitalState(createInitialCapitalState(game, nextSeed));

    setRecords([]);

    setSelectedSquare(null);
    setLegalMoves([]);
    setLastMove(null);
    setPromotionFrom(null);
    setPromotionSquare(null);
    setHistoryPreviewPly(null);
    setStatsTab("overview");

    setGameOver(false);
    setGameOverReason("");
    setWinner("white");
  }

  /* =======================================================
     RENDER
     ======================================================= */

  return (
    <div
      className="
        min-h-screen
        bg-zinc-950
        px-4
        py-6
        text-zinc-100
        sm:px-6
      "
    >
      <div className="mx-auto max-w-[1500px]">
        {/* HEADER */}

        <header
          className="
            mb-7
            flex
            flex-col
            gap-4
            rounded-3xl
            border
            border-white/5
            bg-zinc-900/50
            px-5
            py-4
            shadow-xl
            shadow-black/20
            backdrop-blur-md
            sm:flex-row
            sm:items-center
            sm:justify-between
          "
        >
          <div className="flex items-center gap-4">
            <div
              className="
                flex
                h-12
                w-12
                items-center
                justify-center
                rounded-2xl
                border
                border-amber-400/20
                bg-amber-400/10
                text-3xl
                shadow-inner
              "
            >
              <CoinIcon size="lg" />
            </div>

            <div>
              <p
                className="
                  text-[10px]
                  font-bold
                  uppercase
                  tracking-[0.28em]
                  text-amber-400
                "
              >
                {t("Chess Variant")}
              </p>

              <h1 className="mt-0.5 text-2xl font-black tracking-tight text-white">
                {t("Capitalism Chess")}
              </h1>

              <p className="mt-0.5 text-sm text-zinc-500">
                {t("Earn coins. Chase bounties. Spend the treasury.")}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <a
              href="/games/chess/variants/capitalism/rules"
              className="
                rounded-full
                border
                border-amber-400/15
                bg-amber-400/[0.06]
                px-3
                py-1.5
                text-xs
                font-black
                text-amber-200
                transition
                hover:bg-amber-400/[0.12]
              "
            >
              📖 {t("Rulebook")}
            </a>

            <ChessLanguageSelector
              language={language}
              onChange={changeLanguage}
              label={t("Language")}
            />

            {!gameOver && (
              <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-zinc-300">
                <span className="h-2 w-2 animate-pulse rounded-full bg-amber-400" />

                {game.turn() === "w" ? t("White to move") : t("Black to move")}
              </div>
            )}
          </div>
          <BoardAnimationToggle />
        </header>

        {/* ECONOMY STRIP */}

        <section className="mb-6 grid gap-3 rounded-3xl border border-amber-400/10 bg-amber-400/[0.035] px-5 py-4 sm:grid-cols-2 lg:grid-cols-4">
          <EconomyRule
            icon="🪙"
            title="No passive income"
            detail="Moving and normal captures give no automatic coins."
          />

          <EconomyRule
            icon="⚔"
            title="Earn through contracts"
            detail="Coins come only from missions and bounty targets."
          />

          <EconomyRule
            icon="$"
            title={`Bounty jackpot ${BOUNTY_REWARD_MIN}–${BOUNTY_REWARD_MAX}`}
            detail={t("Reward is random — even a Pawn can be worth a fortune")}
          />

          <EconomyRule
            icon="★"
            title={`Mission bonus ${MISSION_REWARD_MIN}–${MISSION_REWARD_MAX}`}
            detail={t("Each new mission gets a random contract reward")}
          />
        </section>

        {/* MAIN */}

        <main className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)_320px]">
          {/* LEFT */}

          <aside className="min-w-0">
            <div className="space-y-4 xl:sticky xl:top-6">
              <Panel>
                <PanelTitle
                  title={t("Game Controls")}
                  subtitle={t("Players and actions")}
                />

                <CapitalismGameControls
                  onUndo={undoMove}
                  onRestart={restartGame}
                  t={t}
                  undoDisabled={aiMode}
                />
              </Panel>

              {/* PIECE MARKET */}

              <section className="rounded-3xl border border-amber-400/15 bg-zinc-900/75 p-4 shadow-xl shadow-black/20 backdrop-blur-md">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-bold text-zinc-100">
                      {t("Piece Market")}
                    </h2>

                    <p className="mt-1 text-xs leading-5 text-zinc-500">
                      {t(
                        "Buy a piece and spawn it on an empty rook home square",
                      )}
                    </p>
                  </div>

                  <CoinIcon size="md" />
                </div>

                <div className="mb-3 flex items-center justify-between rounded-xl bg-amber-400/[0.06] px-3 py-2">
                  <span className="text-xs font-black text-zinc-300">
                    {currentSide === "white"
                      ? `♔ ${t("White")}`
                      : `♚ ${t("Black")}`}
                  </span>

                  <span className="flex items-center gap-1.5 text-sm font-black text-amber-200">
                    <CoinIcon size="sm" />
                    {capitalState.coins[currentSide]}
                  </span>
                </div>

                {game.isCheck() ? (
                  <div className="rounded-xl border border-red-400/10 bg-red-400/[0.04] px-3 py-3 text-xs text-red-300">
                    {t("Cannot buy while in check")}
                  </div>
                ) : availableShopSquares.length === 0 ? (
                  <div className="rounded-xl border border-white/5 bg-black/20 px-3 py-3 text-xs text-zinc-600">
                    {t("No rook home square is free")}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {(
                      [
                        ["p", "Pawn"],
                        ["n", "Knight"],
                        ["b", "Bishop"],
                        ["r", "Rook"],
                        ["q", "Queen"],
                      ] as Array<[ShopPieceType, string]>
                    ).map(([piece, label]) => (
                      <ShopPieceRow
                        key={piece}
                        piece={piece}
                        label={t(label)}
                        cost={SHOP_PIECE_COSTS[piece]}
                        availableSquares={availableShopSquares}
                        enabledSquares={availableShopSquares.filter((square) =>
                          canBuyPiece({
                            state: capitalState,
                            game,
                            side: currentSide,
                            piece,
                            square,
                          }),
                        )}
                        side={currentSide}
                        onBuy={(square) => purchasePiece(piece, square)}
                      />
                    ))}
                  </div>
                )}
              </section>

              {/* ROYAL POWERS */}

              <section className="rounded-3xl border border-amber-400/15 bg-zinc-900/75 p-4 shadow-xl shadow-black/20 backdrop-blur-md">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-bold text-zinc-100">
                      {t("Royal Powers")}
                    </h2>

                    <p className="mt-1 text-xs text-zinc-500">
                      {t("Current player may spend coins")}
                    </p>
                  </div>

                  <span className="text-xl text-amber-300">♛</span>
                </div>

                <div className="mb-3 rounded-xl bg-amber-400/[0.06] px-3 py-2 text-xs font-black text-amber-200">
                  {currentSide === "white"
                    ? `♔ ${t("White")}`
                    : `♚ ${t("Black")}`}{" "}
                  · {capitalState.coins[currentSide]} $
                </div>

                <div className="space-y-2">
                  <PowerButton
                    title={t("Mission Decree")}
                    detail={t("Reroll your current mission")}
                    cost={ROYAL_POWER_COSTS.mission_decree}
                    used={capitalState.powers[currentSide].missionDecreeUsed}
                    enabled={
                      !gameOver &&
                      !historyPreview &&
                      canUseRoyalPower(
                        capitalState,
                        currentSide,
                        "mission_decree",
                      )
                    }
                    onClick={() => useRoyalPower("mission_decree")}
                    t={t}
                  />

                  <PowerButton
                    title={t("Bounty Decree")}
                    detail={t("Reroll your bounty target")}
                    cost={ROYAL_POWER_COSTS.bounty_decree}
                    used={capitalState.powers[currentSide].bountyDecreeUsed}
                    enabled={
                      !gameOver &&
                      !historyPreview &&
                      canUseRoyalPower(
                        capitalState,
                        currentSide,
                        "bounty_decree",
                      )
                    }
                    onClick={() => useRoyalPower("bounty_decree")}
                    t={t}
                  />
                </div>
              </section>

              <Panel>
                <div className="mb-4 flex items-start justify-between gap-3">
                  <PanelTitle
                    title={t("Captured Pieces")}
                    subtitle={t("Material overview")}
                    compact
                  />

                  <span
                    className={`
                      rounded-xl
                      px-2.5
                      py-1
                      text-xs
                      font-bold

                      ${
                        materialDifference > 0
                          ? "bg-amber-400/10 text-amber-200"
                          : materialDifference < 0
                            ? "bg-white/10 text-zinc-300"
                            : "bg-white/5 text-zinc-500"
                      }
                    `}
                  >
                    {materialDifference > 0 &&
                      `${t("White")} +${materialDifference}`}

                    {materialDifference < 0 &&
                      `${t("Black")} +${Math.abs(materialDifference)}`}

                    {materialDifference === 0 && t("Equal")}
                  </span>
                </div>

                <div className="rounded-2xl border border-white/5 bg-black/20 p-3">
                  <CapturedPiecesGrid
                    capturedBlack={capturedBlack}
                    capturedWhite={capturedWhite}
                    t={t}
                  />
                </div>
              </Panel>

              <Panel>
                <div className="mb-4 flex items-center justify-between">
                  <PanelTitle
                    title={t("Move History")}
                    subtitle={t("Game history")}
                    compact
                  />

                  <span className="rounded-xl bg-white/5 px-2.5 py-1 text-xs font-semibold text-zinc-400">
                    {records.length}
                  </span>
                </div>

                <div className="max-h-80 overflow-y-auto rounded-2xl border border-white/5 bg-black/20">
                  {records.length === 0 ? (
                    <div className="px-4 py-8 text-center text-xs text-zinc-600">
                      {t("No moves yet")}
                    </div>
                  ) : (
                    <table className="w-full border-collapse">
                      <thead className="sticky top-0 z-10 bg-zinc-900">
                        <tr className="border-b border-white/5 text-left text-[9px] font-black uppercase tracking-wider text-zinc-600">
                          <th className="px-3 py-2">{t("Move")}</th>

                          <th className="px-2 py-2">{t("Side")}</th>

                          <th className="px-2 py-2">{t("Played")}</th>
                        </tr>
                      </thead>

                      <tbody>
                        {records.map((record) => {
                          const selected = historyPreviewPly === record.ply;

                          return (
                            <tr
                              key={record.ply}
                              tabIndex={0}
                              onClick={() => {
                                setHistoryPreviewPly(record.ply);

                                setSelectedSquare(null);

                                setLegalMoves([]);
                              }}
                              onKeyDown={(event) => {
                                if (
                                  event.key === "Enter" ||
                                  event.key === " "
                                ) {
                                  setHistoryPreviewPly(record.ply);

                                  setSelectedSquare(null);

                                  setLegalMoves([]);
                                }
                              }}
                              className={`
                                  cursor-pointer
                                  border-b
                                  border-white/5
                                  transition
                                  last:border-0

                                  ${
                                    selected
                                      ? "bg-blue-400/10"
                                      : "hover:bg-white/5"
                                  }
                                `}
                            >
                              <td className="px-3 py-2.5 text-[10px] text-zinc-600">
                                {record.moveNumber}
                                {record.color === "w" ? "." : "..."}
                              </td>

                              <td className="px-2 py-2.5">
                                <span className="text-xs text-zinc-500">
                                  {record.color === "w"
                                    ? `♔ ${t("White")}`
                                    : `♚ ${t("Black")}`}
                                </span>
                              </td>

                              <td className="px-2 py-2.5">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="w-5 text-center text-lg leading-none">
                                    {historyPieceSymbol(
                                      record.color,
                                      record.piece,
                                    )}
                                  </span>

                                  <span className="font-mono text-xs font-bold text-zinc-200">
                                    {record.san}
                                  </span>

                                  {record.economy.totalEarned > 0 && (
                                    <span className="rounded-full bg-amber-400/10 px-2 py-0.5 text-[9px] font-black text-amber-300">
                                      +{record.economy.totalEarned} $
                                    </span>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </Panel>
            </div>
          </aside>

          {/* CENTER */}

          <section className="min-w-0">
            <div className="mx-auto max-w-[820px]">
              {gameOver && (
                <div className="mb-3 rounded-2xl border border-amber-400/20 bg-amber-400/[0.07] px-4 py-3">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-amber-300">
                        {t("Game Over")}
                      </p>

                      <p className="mt-1 font-black text-white">
                        {t(gameOverReason)}
                      </p>
                    </div>

                    <span className="text-sm font-bold text-zinc-300">
                      {winner === "draw"
                        ? t("Draw")
                        : winner === "white"
                          ? t("White wins")
                          : t("Black wins")}
                    </span>
                  </div>
                </div>
              )}

              {promotionSquare && promotionFrom && !historyPreview && (
                <div className="mb-3 rounded-2xl border border-amber-400/20 bg-zinc-900/90 p-3 shadow-xl">
                  <PromotionBar onPromote={promotePawn} />
                </div>
              )}

              {historyPreview && (
                <div className="mb-3 flex items-center justify-between gap-4 rounded-xl border border-blue-400/20 bg-blue-400/[0.07] px-4 py-3">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-blue-300">
                      {t("History Preview")}
                    </p>

                    <p className="mt-1 text-sm font-bold text-white">
                      {t("Move")} {historyPreview.moveNumber}
                      {historyPreview.color === "w" ? "." : "..."}{" "}
                      {historyPreview.san}
                    </p>

                    {historyPreview.economy.totalEarned > 0 && (
                      <p className="mt-1 text-[10px] font-bold text-amber-300">
                        +{historyPreview.economy.totalEarned} $
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setHistoryPreviewPly(null)}
                    className="shrink-0 rounded-lg bg-white/10 px-3 py-2 text-xs font-bold text-zinc-200 transition hover:bg-white/20"
                  >
                    {t("Back to Live Board")}
                  </button>
                </div>
              )}

              <Board
                board={displayedBoard}
                selectedSquare={historyPreview ? null : selectedSquare}
                legalMoves={historyPreview ? [] : legalMoves}
                lastMove={historyPreviewMove ?? lastMove}
                checkedKingSquare={
                  historyPreview
                    ? historyPreviewCheckedKingSquare
                    : checkedKingSquare
                }
                onSquareClick={
                  historyPreview || flipPending ? () => {} : handleSquareClick
                }
                bountySquares={displayedBountySquares}
                shopSpawnSquares={historyPreview ? [] : shopSpawnSquares}
                availableShopSpawnSquares={
                  historyPreview ? [] : availableShopSquares
                }
                whiteMissionTargetSquares={displayedWhiteMissionTargetSquares}
                blackMissionTargetSquares={displayedBlackMissionTargetSquares}
                orientation={boardOrientation}
              />
            </div>
          </section>

          {/* RIGHT */}

          <aside className="min-w-0">
            <div className="space-y-4 xl:sticky xl:top-6">
              {/* TREASURY */}

              <section className="rounded-3xl border border-amber-400/15 bg-zinc-900/80 p-4 shadow-xl shadow-black/20 backdrop-blur-md">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-black text-zinc-100">
                      {t("Treasury")}
                    </h2>

                    <p className="mt-1 text-xs text-zinc-500">
                      {t("Current coins")}
                    </p>
                  </div>

                  <span className="text-2xl">$</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <TreasuryCard
                    side="white"
                    name={t("White")}
                    coins={displayedCapitalState.coins.white}
                  />

                  <TreasuryCard
                    side="black"
                    name={t("Black")}
                    coins={displayedCapitalState.coins.black}
                  />
                </div>

                <p className="mt-3 text-center text-[9px] text-zinc-700">
                  <span className="inline-flex items-center gap-1">
                    Start: <CoinIcon size="xs" /> {STARTING_COINS}
                  </span>
                </p>
              </section>

              {/* CONTRACTS */}

              <section className="rounded-3xl border border-white/10 bg-zinc-900/75 p-4 shadow-xl shadow-black/20 backdrop-blur-md">
                <PanelTitle
                  title={t("Contracts")}
                  subtitle="Bounties + missions"
                />

                <div className="space-y-3">
                  <ContractCard
                    side="white"
                    state={displayedCapitalState}
                    chess={displayedChess}
                    t={t}
                  />

                  <ContractCard
                    side="black"
                    state={displayedCapitalState}
                    chess={displayedChess}
                    t={t}
                  />
                </div>
              </section>

              {/* STATS */}

              <section className="rounded-3xl border border-white/10 bg-zinc-900/75 p-4 shadow-xl shadow-black/20 backdrop-blur-md">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-bold text-zinc-100">
                      {t("Capitalism Stats")}
                    </h2>

                    <p className="mt-1 text-xs text-zinc-500">
                      {t("Fun economy numbers")}
                    </p>
                  </div>

                  <span className="rounded-full border border-amber-400/15 bg-amber-400/[0.07] px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-amber-300">
                    $
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-1 rounded-xl border border-white/5 bg-black/20 p-1">
                  {(
                    [
                      ["overview", "Overview"],
                      ["market", "Market"],
                      ["moments", "Moments"],
                    ] as Array<[StatsTab, string]>
                  ).map(([tab, label]) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setStatsTab(tab)}
                      className={`
                          rounded-lg
                          px-2
                          py-2
                          text-[10px]
                          font-black
                          uppercase
                          tracking-wide
                          transition

                          ${
                            statsTab === tab
                              ? "bg-amber-400/15 text-amber-200"
                              : "text-zinc-600 hover:bg-white/5 hover:text-zinc-300"
                          }
                        `}
                    >
                      {t(label)}
                    </button>
                  ))}
                </div>

                {statsTab === "overview" && (
                  <div className="mt-4 space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <StatCard
                        icon="♔"
                        label={t("Earned by White")}
                        value={String(stats.whiteEarned)}
                        detail={`${stats.whiteSpent} spent`}
                      />

                      <StatCard
                        icon="♚"
                        label={t("Earned by Black")}
                        value={String(stats.blackEarned)}
                        detail={`${stats.blackSpent} spent`}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <StatCard
                        icon="$"
                        label={t("Bounties claimed")}
                        value={String(stats.bountyClaims)}
                        detail={`${BOUNTY_REWARD_MIN}–${BOUNTY_REWARD_MAX} each contract`}
                      />

                      <StatCard
                        icon="★"
                        label={t("Missions completed")}
                        value={String(stats.missionsCompleted)}
                        detail="contract bonuses"
                      />
                    </div>

                    <div className="rounded-xl border border-white/5 bg-black/20 px-3 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs text-zinc-500">
                          {t("Total power spending")}
                        </span>

                        <span className="text-sm font-black text-amber-200">
                          {stats.whiteSpent + stats.blackSpent} $
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {statsTab === "market" && (
                  <div className="mt-4 space-y-2">
                    <MarketRow
                      label={t("Bounty income")}
                      value={stats.bountyIncome}
                    />

                    <MarketRow
                      label={t("Mission income")}
                      value={stats.missionIncome}
                    />

                    {stats.biggestPayday && (
                      <button
                        type="button"
                        onClick={() => {
                          setHistoryPreviewPly(stats.biggestPayday!.ply);

                          setSelectedSquare(null);

                          setLegalMoves([]);
                        }}
                        className="mt-3 w-full rounded-xl border border-amber-400/15 bg-amber-400/[0.05] px-3 py-3 text-left transition hover:bg-amber-400/[0.09]"
                      >
                        <p className="text-[10px] font-black uppercase tracking-wider text-amber-300">
                          {t("Biggest payday")}
                        </p>

                        <div className="mt-2 flex items-center justify-between gap-3">
                          <span className="font-mono text-xs font-black text-zinc-200">
                            {stats.biggestPayday.san}
                          </span>

                          <span className="text-sm font-black text-amber-200">
                            +{stats.biggestPayday.economy.totalEarned} $
                          </span>
                        </div>
                      </button>
                    )}
                  </div>
                )}

                {statsTab === "moments" && (
                  <div className="mt-4">
                    <p className="text-[10px] font-black uppercase tracking-wider text-zinc-600">
                      {t("Economy moments")}
                    </p>

                    <p className="mt-1 text-[10px] text-zinc-700">
                      {t("Click a moment to show that position")}
                    </p>

                    {stats.momentRecords.length === 0 ? (
                      <p className="mt-4 rounded-xl bg-black/20 px-3 py-4 text-xs text-zinc-700">
                        {t("No big economy moments yet")}
                      </p>
                    ) : (
                      <div className="mt-3 space-y-2">
                        {stats.momentRecords
                          .slice()
                          .reverse()
                          .map((record) => (
                            <button
                              key={`economy-${record.ply}`}
                              type="button"
                              onClick={() => {
                                setHistoryPreviewPly(record.ply);

                                setSelectedSquare(null);

                                setLegalMoves([]);
                              }}
                              className="flex w-full items-center justify-between gap-3 rounded-xl border border-white/5 bg-black/20 px-3 py-3 text-left transition hover:border-amber-400/20 hover:bg-amber-400/[0.05]"
                            >
                              <div className="min-w-0">
                                <p className="font-mono text-xs font-black text-zinc-200">
                                  {record.san}
                                </p>

                                <p className="mt-1 truncate text-[9px] text-zinc-700">
                                  {economyMomentLabel(record, t)}
                                </p>
                              </div>

                              <span className="shrink-0 text-xs font-black text-amber-300">
                                +{record.economy.totalEarned} $
                              </span>
                            </button>
                          ))}
                      </div>
                    )}
                  </div>
                )}
              </section>
            </div>
          </aside>
        </main>
      </div>
    </div>
  );
}

/* =========================================================
   HELPERS
   ========================================================= */

function getCheckedKingSquare(chess: Chess): Square | null {
  if (!chess.isCheck()) {
    return null;
  }

  const board = chess.board();

  const kingColor = chess.turn();

  for (let row = 0; row < board.length; row += 1) {
    for (let column = 0; column < board[row].length; column += 1) {
      const piece = board[row][column];

      if (piece?.type === "k" && piece.color === kingColor) {
        return getSquareName(row, column);
      }
    }
  }

  return null;
}

function historyPieceSymbol(color: "w" | "b", type: string): string {
  return color === "w"
    ? (whiteSymbols[type] ?? "")
    : (blackSymbols[type] ?? "");
}

function EconomyRule({
  icon,
  title,
  detail,
}: {
  icon: string;
  title: string;
  detail: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-400/10 text-lg font-black text-amber-300">
        {icon}
      </span>

      <div>
        <p className="text-xs font-black text-zinc-200">{title}</p>

        <p className="mt-1 text-[10px] text-zinc-600">{detail}</p>
      </div>
    </div>
  );
}

function Panel({ children }: { children: ReactNode }) {
  return (
    <section className="rounded-3xl border border-white/10 bg-zinc-900/75 p-4 shadow-xl shadow-black/20 backdrop-blur-md">
      {children}
    </section>
  );
}

function PanelTitle({
  title,
  subtitle,
  compact = false,
}: {
  title: string;
  subtitle: string;
  compact?: boolean;
}) {
  return (
    <div className={compact ? "" : "mb-5"}>
      <h2 className="text-sm font-bold text-zinc-100">{title}</h2>

      <p className="mt-1.5 text-xs text-zinc-500">{subtitle}</p>
    </div>
  );
}

function CapitalismGameControls({
  onUndo,
  onRestart,
  undoDisabled,
  t,
}: {
  onUndo: () => void;
  onRestart: () => void;
  undoDisabled: boolean;
  t: (key: string) => string;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <button
        type="button"
        disabled={undoDisabled}
        onClick={onUndo}
        className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm font-bold text-zinc-300 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed
    disabled:border-white/5
    disabled:bg-white/[0.02]
    disabled:text-zinc-600
    disabled:opacity-50
    disabled:hover:bg-white/[0.02]"
      >
        ↶ {t("Undo")}
      </button>

      <button
        type="button"
        onClick={onRestart}
        className="rounded-xl border border-amber-400/15 bg-amber-400/[0.06] px-3 py-2.5 text-sm font-bold text-amber-300 transition hover:bg-amber-400/[0.12]"
      >
        ↻ {t("Restart")}
      </button>
    </div>
  );
}

function CapturedPiecesGrid({
  capturedBlack,
  capturedWhite,
  t,
}: {
  capturedBlack: PieceType[];
  capturedWhite: PieceType[];
  t: (key: string) => string;
}) {
  function renderPieces(pieces: PieceType[], color: "w" | "b") {
    return (
      <div className="mt-2 flex min-h-8 flex-wrap gap-1">
        {pieces.length === 0 ? (
          <span className="text-xs text-zinc-700">—</span>
        ) : (
          pieces.map((piece, index) => (
            <span
              key={`${color}-${piece}-${index}`}
              className="flex h-7 w-7 items-center justify-center text-2xl leading-none"
            >
              {color === "w" ? whiteSymbols[piece] : blackSymbols[piece]}
            </span>
          ))
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-[10px] font-black uppercase tracking-wider text-zinc-600">
          {t("Black")}
        </p>

        {renderPieces(capturedBlack, "b")}
      </div>

      <div className="border-t border-white/5 pt-3">
        <p className="text-[10px] font-black uppercase tracking-wider text-zinc-600">
          {t("White")}
        </p>

        {renderPieces(capturedWhite, "w")}
      </div>
    </div>
  );
}

function CoinIcon({ size = "sm" }: { size?: "xs" | "sm" | "md" | "lg" }) {
  const sizeClass = {
    xs: "h-4 w-4 text-[9px]",
    sm: "h-5 w-5 text-[10px]",
    md: "h-7 w-7 text-xs",
    lg: "h-9 w-9 text-base",
  }[size];

  return (
    <span
      aria-label="coin"
      className={`
        inline-flex
        shrink-0
        items-center
        justify-center
        rounded-full
        border
        border-amber-100/70
        bg-gradient-to-br
        from-yellow-200
        via-amber-300
        to-amber-500
        font-black
        leading-none
        text-amber-950
        shadow-[inset_0_0_0_2px_rgba(120,53,15,0.18),0_2px_7px_rgba(0,0,0,0.35)]
        ${sizeClass}
      `}
    >
      $
    </span>
  );
}

function ShopPieceRow({
  piece,
  label,
  cost,
  availableSquares,
  enabledSquares,
  side,
  onBuy,
}: {
  piece: ShopPieceType;
  label: string;
  cost: number;
  availableSquares: Square[];
  enabledSquares: Square[];
  side: CapitalSide;
  onBuy: (square: Square) => void;
}) {
  const color = side === "white" ? "w" : "b";

  return (
    <div className="rounded-xl border border-white/5 bg-black/20 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="text-3xl leading-none">
            {pieceSymbol(color, piece)}
          </span>

          <div className="min-w-0">
            <p className="truncate text-xs font-black text-zinc-200">{label}</p>

            <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-black text-amber-300">
              <CoinIcon size="xs" />
              {cost}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 gap-1.5">
          {availableSquares.map((square) => {
            const enabled = enabledSquares.includes(square);

            return (
              <button
                key={square}
                type="button"
                disabled={!enabled}
                onClick={() => onBuy(square)}
                className={`
                    rounded-lg
                    border
                    px-2.5
                    py-1.5
                    font-mono
                    text-[10px]
                    font-black
                    transition

                    ${
                      enabled
                        ? "border-amber-400/20 bg-amber-400/[0.08] text-amber-200 hover:bg-amber-400/[0.16]"
                        : "cursor-not-allowed border-white/5 bg-white/[0.02] text-zinc-700"
                    }
                  `}
              >
                {square}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function TreasuryCard({
  side,
  name,
  coins,
}: {
  side: CapitalSide;
  name: string;
  coins: number;
}) {
  return (
    <div
      className={`
        rounded-2xl
        border
        p-4

        ${
          side === "white"
            ? "border-[#fff3d5]/15 bg-[#fff3d5]/[0.04]"
            : "border-white/10 bg-white/[0.03]"
        }
      `}
    >
      <p className="truncate text-[10px] font-black uppercase tracking-widest text-zinc-600">
        {side === "white" ? "♔" : "♚"} {name}
      </p>

      <div className="mt-3 flex items-end justify-between gap-2">
        <span className="text-3xl font-black text-amber-300">{coins}</span>

        <CoinIcon size="md" />
      </div>
    </div>
  );
}

function ContractCard({
  side,
  state,
  chess,
  t,
}: {
  side: CapitalSide;
  state: CapitalState;
  chess: Chess;
  t: (key: string) => string;
}) {
  const target = state.bountyTargets[side];

  const mission = state.missions[side];

  const targetPiece = target ? chess.get(target) : undefined;

  const bountyReward = target ? state.bountyRewards[side] : null;

  const missionRewardLabel = getMissionRewardLabel(mission);

  return (
    <div className="rounded-2xl border border-white/5 bg-black/20 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-black text-zinc-300">
          {side === "white" ? `♔ ${t("White")}` : `♚ ${t("Black")}`}
        </p>

        <span className="text-xs font-black text-amber-300">
          <span className="inline-flex items-center gap-1">
            <CoinIcon size="xs" />
            {state.coins[side]}
          </span>
        </span>
      </div>

      <div className="mt-3 rounded-xl bg-amber-400/[0.05] px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[9px] font-black uppercase tracking-wider text-amber-400">
            {t("Bounty")}
          </span>

          <span className="text-[10px] font-black text-amber-200">
            {bountyReward !== null ? `+${bountyReward} $` : "—"}
          </span>
        </div>

        <p className="mt-1 text-xs font-black text-zinc-200">
          {target && targetPiece
            ? `${pieceSymbol(targetPiece.color, targetPiece.type)} ${target}`
            : t("No target")}
        </p>
      </div>

      <div className="mt-2 rounded-xl bg-white/[0.025] px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[9px] font-black uppercase tracking-wider text-zinc-600">
            {t("Mission")}
          </span>

          <span className="text-[10px] font-black text-emerald-300">
            +{missionRewardLabel} $
          </span>
        </div>

        <p className="mt-1 text-xs font-black text-zinc-200">
          {t(missionDefinitions[mission.id].label)}
        </p>

        {mission.id === "king_journey" && mission.targetSquare && (
          <div className="mt-2 flex items-center justify-between rounded-lg border border-sky-400/15 bg-sky-400/[0.06] px-2.5 py-2">
            <span className="text-[9px] font-black uppercase tracking-wider text-sky-300">
              {t("Survival mission")}
            </span>

            <span className="font-mono text-xs font-black text-sky-100">
              ★ {t("Target")} {mission.targetSquare}
            </span>
          </div>
        )}

        <p className="mt-1 text-[9px] leading-4 text-zinc-700">
          {t(missionDefinitions[mission.id].detail)}
        </p>
      </div>
    </div>
  );
}

function PowerButton({
  title,
  detail,
  cost,
  used,
  armed = false,
  enabled,
  onClick,
  t,
}: {
  title: string;
  detail: string;
  cost: number;
  used: boolean;
  armed?: boolean;
  enabled: boolean;
  onClick: () => void;
  t: (key: string) => string;
}) {
  return (
    <button
      type="button"
      disabled={!enabled}
      onClick={onClick}
      className={`
        w-full
        rounded-xl
        border
        px-3
        py-3
        text-left
        transition

        ${
          armed
            ? "border-emerald-400/25 bg-emerald-400/[0.08]"
            : enabled
              ? "border-amber-400/15 bg-amber-400/[0.04] hover:bg-amber-400/[0.09]"
              : "border-white/5 bg-black/20 opacity-60"
        }
      `}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-black text-zinc-200">{title}</span>

        <span
          className={`
            shrink-0
            rounded-lg
            px-2
            py-1
            text-[9px]
            font-black

            ${
              armed
                ? "bg-emerald-400/15 text-emerald-300"
                : used
                  ? "bg-white/5 text-zinc-600"
                  : "bg-amber-400/10 text-amber-300"
            }
          `}
        >
          {armed ? t("Armed") : used ? t("Used") : `${cost} $`}
        </span>
      </div>

      <p className="mt-1.5 text-[10px] leading-4 text-zinc-600">{detail}</p>
    </button>
  );
}

function StatCard({
  icon,
  label,
  value,
  detail,
}: {
  icon: string;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-xl border border-white/5 bg-black/20 px-3 py-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm">{icon}</span>

        <span className="text-xl font-black text-zinc-100">{value}</span>
      </div>

      <p className="mt-2 text-[10px] font-black uppercase tracking-wider text-zinc-600">
        {label}
      </p>

      <p className="mt-1 text-[10px] text-zinc-700">{detail}</p>
    </div>
  );
}

function MarketRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-black/20 px-3 py-2.5">
      <span className="text-xs text-zinc-500">{label}</span>

      <span className="text-xs font-black text-amber-300">{value} $</span>
    </div>
  );
}

function economyMomentLabel(
  record: CapitalismMoveRecord,
  t: (key: string) => string,
): string {
  const labels: string[] = [];

  if (record.economy.bountyClaimed) {
    labels.push(`${t("Bounty")} +${record.economy.bountyCoins}`);
  }

  if (record.economy.missionCompleted) {
    labels.push(`${t("Mission")} +${record.economy.missionCoins}`);
  }

  if (record.economy.investmentBonus > 0) {
    labels.push(`${t("Investment bonus")} +${record.economy.investmentBonus}`);
  }

  if (record.economy.checkCoins > 0) {
    labels.push(`Check +${record.economy.checkCoins}`);
  }

  return labels.join(" · ") || `+${record.economy.totalEarned} $`;
}

function pieceSymbol(color: "w" | "b", type: string): string {
  return color === "w"
    ? (whiteSymbols[type] ?? "")
    : (blackSymbols[type] ?? "");
}

function ChessLanguageSelector({
  language,
  onChange,
  label,
}: {
  language: Language;
  onChange: (language: Language) => void;
  label: string;
}) {
  return (
    <label className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-zinc-400">
      <span>🌐</span>

      <span className="hidden sm:inline">{label}</span>

      <select
        value={language}
        onChange={(event) => onChange(event.target.value as Language)}
        className="bg-transparent text-xs font-bold text-zinc-200 outline-none [color-scheme:dark]"
      >
        <option value="en" className="bg-zinc-900">
          English
        </option>

        <option value="de" className="bg-zinc-900">
          Deutsch
        </option>

        <option value="bar" className="bg-zinc-900">
          Boarisch
        </option>

        <option value="ko" className="bg-zinc-900">
          한국어
        </option>

        <option value="ru" className="bg-zinc-900">
          Русский
        </option>
      </select>
    </label>
  );
}
