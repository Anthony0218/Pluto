import { useEffect, useMemo, useRef, useState } from "react";

import { Chess, type Square } from "chess.js";

import { supabase } from "../lib/supabase";

import { getSquareName, type PieceType } from "../utils/chessUtils";

import Board from "./Board.tsx";
import CapturedPieces from "./CapturedPieces.tsx";

import {
  playPieceSelectSound,
  playPieceMoveSound,
  playPieceCaptureSound,
  playRandomSound,
} from "../utils/sound.ts";

import PromotionBar from "./PromotionBar";
import GameControls from "./GameControls.tsx";

import { useAuth } from "../context/AuthContext";

import playButton from "../assets/trash-button.svg";
import loadButton from "../assets/load-button.svg";

import { useStockfishAnalysis } from "../hooks/useStockfishAnalysis";

import {
  gradeMove,
  getBestSuggestions,
  type MoveReview,
  type MoveSuggestion,
} from "../utils/chessAnalysis";

import ChessGameReview from "./ChessGameReview";

/* =========================================================
   TYPES
   ========================================================= */

type SavedGame = {
  id: string;

  user_id: string;

  created_at: string;

  name: string | null;

  white_player: string | null;

  black_player: string | null;

  fen: string;

  moves: string[];

  white_check_counter: number;

  black_check_counter: number;
};

type ChessBoardProps = {
  onlineGameId?: string;
};

type Language = "en" | "de" | "bar" | "ko" | "ru";

const languageOptions: Array<{ value: Language; label: string }> = [
  { value: "en", label: "English" },
  { value: "de", label: "Deutsch" },
  { value: "bar", label: "Boarisch" },
  { value: "ko", label: "한국어" },
  { value: "ru", label: "Русский" },
];

const deTranslations: Record<string, string> = {
  Language: "Sprache",
  "Classic Chess": "Klassisches Schach",
  Hotseat: "Hotseat",
  "Two players · one board": "Zwei Spieler · ein Brett",
  "White to move": "Weiß am Zug",
  "Black to move": "Schwarz am Zug",
  "Saved Games": "Gespeicherte Partien",
  "Previous games": "Frühere Spiele",
  "No saved games yet": "Noch keine gespeicherten Partien",
  "Unnamed Game": "Unbenannte Partie",
  "Load game": "Partie laden",
  "Delete game": "Partie löschen",
  "Captured Pieces": "Geschlagene Figuren",
  "Material overview": "Materialübersicht",
  White: "Weiß",
  Black: "Schwarz",
  Equal: "Ausgeglichen",
  Material: "Material",
  "Move History": "Zugverlauf",
  "Game history": "Verlauf der Partie",
  "No moves yet": "Noch keine Züge",
  Move: "Zug",
  Side: "Seite",
  Played: "Gespielt",
  "Game Over": "Partie beendet",
  Draw: "Remis",
  "White wins": "Weiß gewinnt",
  "Black wins": "Schwarz gewinnt",
  "Open Game Review": "Partieanalyse öffnen",
  "History Preview": "Verlaufsansicht",
  "Back to Live Board": "Zurück zum Live-Brett",
  "Chess Coach": "Schach-Coach",
  "Live analysis enabled": "Live-Analyse aktiviert",
  "Enable Stockfish feedback": "Stockfish-Feedback aktivieren",
  "Live Stockfish analysis": "Live-Stockfish-Analyse",
  "Last move": "Letzter Zug",
  "Evaluation loss": "Bewertungsverlust",
  pawns: "Bauern",
  "Engine preferred": "Engine bevorzugt",
  "Analyzing last move...": "Letzten Zug analysieren...",
  "Analyzing...": "Analyse...",
  "Hide Help": "Hilfe ausblenden",
  "Help · Best Moves": "Hilfe · Beste Züge",
  "Stockfish is analyzing...": "Stockfish analysiert...",
  "No analysis available.": "Keine Analyse verfügbar.",
  "Shown on board": "Auf dem Brett angezeigt",
  "Click to show": "Zum Anzeigen klicken",
  "Game Controls": "Spielsteuerung",
  "Players, game and actions": "Spieler, Partie und Aktionen",
  "Piece Values": "Figurenwerte",
  "Standard values": "Standardwerte",
  Advantage: "Vorteil",
  Players: "Spieler",
  "You vs Stockfish": "Du gegen Stockfish",
  You: "Du",
  moves: "Züge",
  "Optional Stockfish analysis": "Optionale Stockfish-Analyse",
  "Your last move": "Dein letzter Zug",
  Difficulty: "Schwierigkeit",
  Skill: "Stärke",
  "Think time": "Denkzeit",
  "Weak-move chance": "Chance für schwachen Zug",
  "Undo Move": "Zug zurücknehmen",
  "New Game": "Neue Partie",
  Resign: "Aufgeben",
  "Resign game?": "Partie aufgeben?",
  "Stockfish will win the game.": "Stockfish gewinnt die Partie.",
  Cancel: "Abbrechen",
  "Play Again": "Nochmal spielen",
  "Change Settings": "Einstellungen ändern",
  "Stockfish loading...": "Stockfish wird geladen...",
  "Checkmate — Stockfish wins": "Schachmatt — Stockfish gewinnt",
  "Checkmate — You win": "Schachmatt — Du gewinnst",
  "Stockfish is thinking...": "Stockfish denkt...",
  "You are in check": "Du stehst im Schach",
  "Stockfish is in check": "Stockfish steht im Schach",
  "Your turn": "Du bist am Zug",
  "Stockfish's turn": "Stockfish ist am Zug",
  Multiplayer: "Mehrspieler",
  "Online game": "Online-Partie",
  Room: "Raum",
  "Game finished": "Partie beendet",
  "Opponent's turn": "Gegner am Zug",
  Leave: "Verlassen",
  "White and Black": "Weiß und Schwarz",
  "Multiplayer connection": "Multiplayer-Verbindung",
  "Room code": "Raumcode",
  Status: "Status",
  "Your color": "Deine Farbe",
  Connected: "Verbunden",
  "Game and actions": "Partie und Aktionen",
  "Leave game": "Partie verlassen",
  Game: "Partie",
  "Current game state": "Aktueller Spielstand",
  Turn: "Zug",
  "Half-moves": "Halbzüge",
  Version: "Version",
  "Waiting for opponent...": "Warte auf Gegner...",
  "Opponent wants a rematch.": "Gegner möchte eine Revanche.",
  "Rematch requested": "Revanche angefragt",
  Rematch: "Revanche",
  "Back to lobby": "Zur Lobby",
  "You win": "Du gewinnst",
  "You lose": "Du verlierst",
  "Are you sure you want to resign?":
    "Möchtest du die Partie wirklich aufgeben?",
  "Resign now": "Jetzt aufgeben",
  "Online Game": "Online-Partie",
  Connection: "Verbindung",
  Moves: "Züge",
  Player: "Spieler",
  "Game name": "Partiename",
  "White player": "Weißer Spieler",
  "Black player": "Schwarzer Spieler",
  Save: "Speichern",
  Restart: "Neu starten",
  Undo: "Rückgängig",
  "Draw — Stalemate": "Remis — Patt",
  "Draw — Threefold repetition": "Remis — Dreifache Stellungswiederholung",
  "Draw — Insufficient material": "Remis — Unzureichendes Material",
  "Your king is in check": "Dein König steht im Schach",
  "Stockfish game settings": "Stockfish-Spieleinstellungen",
  Pawn: "Bauer",
  Knight: "Springer",
  Bishop: "Läufer",
  Rook: "Turm",
  Queen: "Dame",
  King: "König",
  "Stockfish wins.": "Stockfish gewinnt.",
  "You defeated Stockfish.": "Du hast Stockfish besiegt.",
  "Draw.": "Remis.",
  "Stockfish wins by resignation.": "Stockfish gewinnt durch Aufgabe.",
  "Sending move...": "Zug wird übertragen...",
  "Choose a piece": "Wähle eine Figur",
  "Waiting for the next move": "Warte auf den nächsten Zug",
  checkmate: "Schachmatt",
  stalemate: "Patt",
  "threefold repetition": "Dreifache Stellungswiederholung",
  "insufficient material": "Unzureichendes Material",
  draw: "Remis",
  "Your opponent wins the game.": "Dein Gegner gewinnt die Partie.",
  "Live Coach is disabled during an online game.":
    "Live-Coach ist während eines Online-Spiels deaktiviert.",
  "White in check": "Weiß im Schach",
  "Black in check": "Schwarz im Schach",
};
const bavarianTranslations: Record<string, string> = {
  Language: "Sproch",
  "Classic Chess": "Klassisches Schach",
  "Two players · one board": "Zwoa Spieler · oa Brett",
  "White to move": "Weiß is dro",
  "Black to move": "Schwarz is dro",
  "Saved Games": "Gspeicherte Partien",
  "Previous games": "Frühere Partien",
  "Captured Pieces": "Gschlagene Figuren",
  "Move History": "Zugverlauf",
  "Game history": "Partieverlauf",
  "Game Controls": "Spielsteuerung",
  "Players, game and actions": "Spieler, Partie und Aktionen",
  "Piece Values": "Figurenwerte",
  Players: "Spieler",
  You: "Du",
  "Your turn": "Du bist dro",
  "Opponent's turn": "Da Gegner is dro",
  Leave: "Rausgeh",
  Room: "Raum",
  Connected: "Verbunden",
  "You win": "Du gwinnst",
  "You lose": "Du verlierst",
  "Waiting for opponent...": "Wart auf'n Gegner...",
  "Back to lobby": "Zruck zur Lobby",
  Resign: "Aufgebn",
  "New Game": "Neue Partie",
  "Undo Move": "Zug zrucknehma",
  "Play Again": "No amoi spieln",
  "Draw — Stalemate": "Remis — Patt",
  "Draw — Threefold repetition": "Remis — Dreifache Wiederholung",
  "Draw — Insufficient material": "Remis — Zu wenig Material",
  "Your king is in check": "Dei Kini steht im Schach",
  "Stockfish game settings": "Stockfish-Spuieinstellungen",
  Pawn: "Baua",
  Knight: "Springa",
  Bishop: "Läufa",
  Rook: "Turm",
  Queen: "Dame",
  King: "Kini",
  "Stockfish wins.": "Stockfish gwinnt.",
  "You defeated Stockfish.": "Du host Stockfish gschlogn.",
  "Draw.": "Remis.",
  "Stockfish wins by resignation.": "Stockfish gwinnt durch Aufgebn.",
  "Sending move...": "Zug werd übertrogn...",
  "Choose a piece": "Such da a Figur aus",
  "Waiting for the next move": "Wart auf'n nächsten Zug",
  checkmate: "Schachmatt",
  stalemate: "Patt",
  "threefold repetition": "Dreifache Wiederholung",
  "insufficient material": "Zu wenig Material",
  draw: "Remis",
  "Your opponent wins the game.": "Dei Gegner gwinnt d'Partie.",
  "Live Coach is disabled during an online game.":
    "Live-Coach is beim Online-Spui aus.",
  "White in check": "Weiß im Schach",
  "Black in check": "Schwarz im Schach",
};
const koreanTranslations: Record<string, string> = {
  Language: "언어",
  "Classic Chess": "클래식 체스",
  Hotseat: "핫시트",
  "Two players · one board": "두 명 · 하나의 보드",
  "White to move": "백 차례",
  "Black to move": "흑 차례",
  "Saved Games": "저장된 게임",
  "Previous games": "이전 게임",
  "No saved games yet": "저장된 게임이 없습니다",
  "Unnamed Game": "이름 없는 게임",
  "Load game": "게임 불러오기",
  "Delete game": "게임 삭제",
  "Captured Pieces": "잡힌 기물",
  "Material overview": "기물 현황",
  White: "백",
  Black: "흑",
  Equal: "동등",
  Material: "기물",
  "Move History": "수 기록",
  "Game history": "게임 진행 기록",
  "No moves yet": "아직 수가 없습니다",
  Move: "수",
  Side: "색",
  Played: "둔 수",
  "Game Over": "게임 종료",
  Draw: "무승부",
  "White wins": "백 승",
  "Black wins": "흑 승",
  "Open Game Review": "게임 리뷰 열기",
  "History Preview": "수순 미리보기",
  "Back to Live Board": "현재 보드로 돌아가기",
  "Chess Coach": "체스 코치",
  "Live analysis enabled": "실시간 분석 활성화",
  "Enable Stockfish feedback": "Stockfish 피드백 켜기",
  "Live Stockfish analysis": "실시간 Stockfish 분석",
  "Last move": "마지막 수",
  "Evaluation loss": "평가 손실",
  pawns: "폰",
  "Engine preferred": "엔진 추천",
  "Analyzing last move...": "마지막 수 분석 중...",
  "Analyzing...": "분석 중...",
  "Hide Help": "도움말 숨기기",
  "Help · Best Moves": "도움말 · 최선의 수",
  "Stockfish is analyzing...": "Stockfish 분석 중...",
  "No analysis available.": "분석 결과가 없습니다.",
  "Shown on board": "보드에 표시됨",
  "Click to show": "클릭하여 표시",
  "Game Controls": "게임 조작",
  "Players, game and actions": "플레이어, 게임 및 조작",
  "Piece Values": "기물 가치",
  "Standard values": "표준 가치",
  Advantage: "우세",
  Players: "플레이어",
  "You vs Stockfish": "나 vs Stockfish",
  You: "나",
  moves: "수",
  "Optional Stockfish analysis": "선택적 Stockfish 분석",
  "Your last move": "내 마지막 수",
  Difficulty: "난이도",
  Skill: "레벨",
  "Think time": "생각 시간",
  "Weak-move chance": "약한 수 확률",
  "Undo Move": "수 되돌리기",
  "New Game": "새 게임",
  Resign: "기권",
  "Resign game?": "기권할까요?",
  "Stockfish will win the game.": "Stockfish가 승리합니다.",
  Cancel: "취소",
  "Play Again": "다시 플레이",
  "Change Settings": "설정 변경",
  "Stockfish loading...": "Stockfish 로딩 중...",
  "Checkmate — Stockfish wins": "체크메이트 — Stockfish 승리",
  "Checkmate — You win": "체크메이트 — 승리했습니다",
  "Stockfish is thinking...": "Stockfish 생각 중...",
  "You are in check": "체크 상태입니다",
  "Stockfish is in check": "Stockfish가 체크 상태입니다",
  "Your turn": "내 차례",
  "Stockfish's turn": "Stockfish 차례",
  Multiplayer: "멀티플레이어",
  "Online game": "온라인 게임",
  Room: "방",
  "Game finished": "게임 종료",
  "Opponent's turn": "상대 차례",
  Leave: "나가기",
  "White and Black": "백과 흑",
  "Multiplayer connection": "멀티플레이 연결",
  "Room code": "방 코드",
  Status: "상태",
  "Your color": "내 색",
  Connected: "연결됨",
  "Game and actions": "게임 및 조작",
  "Leave game": "게임 나가기",
  Game: "게임",
  "Current game state": "현재 게임 상태",
  Turn: "차례",
  "Half-moves": "하프무브",
  Version: "버전",
  "Waiting for opponent...": "상대를 기다리는 중...",
  "Opponent wants a rematch.": "상대가 재대결을 원합니다.",
  "Rematch requested": "재대결 요청됨",
  Rematch: "재대결",
  "Back to lobby": "로비로 돌아가기",
  "You win": "승리",
  "You lose": "패배",
  "Are you sure you want to resign?": "정말 기권하시겠습니까?",
  "Resign now": "기권하기",
  Moves: "수",
  Player: "플레이어",
  "Game name": "게임 이름",
  "White player": "백 플레이어",
  "Black player": "흑 플레이어",
  Save: "저장",
  Restart: "다시 시작",
  Undo: "되돌리기",
  "Draw — Stalemate": "무승부 — 스테일메이트",
  "Draw — Threefold repetition": "무승부 — 3회 반복",
  "Draw — Insufficient material": "무승부 — 기물 부족",
  "Your king is in check": "내 킹이 체크 상태입니다",
  "Stockfish game settings": "Stockfish 게임 설정",
  Pawn: "폰",
  Knight: "나이트",
  Bishop: "비숍",
  Rook: "룩",
  Queen: "퀸",
  King: "킹",
  "Stockfish wins.": "Stockfish 승리.",
  "You defeated Stockfish.": "Stockfish를 이겼습니다.",
  "Draw.": "무승부.",
  "Stockfish wins by resignation.": "기권으로 Stockfish 승리.",
  "Sending move...": "수를 전송 중...",
  "Choose a piece": "기물을 선택하세요",
  "Waiting for the next move": "다음 수를 기다리는 중",
  checkmate: "체크메이트",
  stalemate: "스테일메이트",
  "threefold repetition": "3회 반복",
  "insufficient material": "기물 부족",
  draw: "무승부",
  "Your opponent wins the game.": "상대가 게임에서 승리합니다.",
  "Live Coach is disabled during an online game.":
    "온라인 게임 중에는 라이브 코치가 비활성화됩니다.",
  "White in check": "백 체크 횟수",
  "Black in check": "흑 체크 횟수",
};
const russianTranslations: Record<string, string> = {
  Language: "Язык",
  "Classic Chess": "Классические шахматы",
  Hotseat: "Хотсит",
  "Two players · one board": "Два игрока · одна доска",
  "White to move": "Ход белых",
  "Black to move": "Ход чёрных",
  "Saved Games": "Сохранённые партии",
  "Previous games": "Предыдущие партии",
  "No saved games yet": "Сохранённых партий пока нет",
  "Unnamed Game": "Безымянная партия",
  "Load game": "Загрузить партию",
  "Delete game": "Удалить партию",
  "Captured Pieces": "Взятые фигуры",
  "Material overview": "Материальный баланс",
  White: "Белые",
  Black: "Чёрные",
  Equal: "Равно",
  Material: "Материал",
  "Move History": "История ходов",
  "Game history": "Ход партии",
  "No moves yet": "Ходов пока нет",
  Move: "Ход",
  Side: "Сторона",
  Played: "Сыграно",
  "Game Over": "Партия окончена",
  Draw: "Ничья",
  "White wins": "Белые победили",
  "Black wins": "Чёрные победили",
  "Open Game Review": "Открыть разбор партии",
  "History Preview": "Просмотр истории",
  "Back to Live Board": "Вернуться к текущей позиции",
  "Chess Coach": "Шахматный тренер",
  "Live analysis enabled": "Анализ в реальном времени включён",
  "Enable Stockfish feedback": "Включить подсказки Stockfish",
  "Live Stockfish analysis": "Анализ Stockfish в реальном времени",
  "Last move": "Последний ход",
  "Evaluation loss": "Потеря оценки",
  pawns: "пешек",
  "Engine preferred": "Движок предпочитает",
  "Analyzing last move...": "Анализ последнего хода...",
  "Analyzing...": "Анализ...",
  "Hide Help": "Скрыть помощь",
  "Help · Best Moves": "Помощь · Лучшие ходы",
  "Stockfish is analyzing...": "Stockfish анализирует...",
  "No analysis available.": "Анализ недоступен.",
  "Shown on board": "Показано на доске",
  "Click to show": "Нажмите, чтобы показать",
  "Game Controls": "Управление игрой",
  "Players, game and actions": "Игроки, партия и действия",
  "Piece Values": "Ценность фигур",
  "Standard values": "Стандартные значения",
  Advantage: "Преимущество",
  Players: "Игроки",
  "You vs Stockfish": "Вы против Stockfish",
  You: "Вы",
  moves: "ходов",
  "Optional Stockfish analysis": "Дополнительный анализ Stockfish",
  "Your last move": "Ваш последний ход",
  Difficulty: "Сложность",
  Skill: "Уровень",
  "Think time": "Время на ход",
  "Weak-move chance": "Вероятность слабого хода",
  "Undo Move": "Отменить ход",
  "New Game": "Новая партия",
  Resign: "Сдаться",
  "Resign game?": "Сдаться?",
  "Stockfish will win the game.": "Stockfish выиграет партию.",
  Cancel: "Отмена",
  "Play Again": "Сыграть снова",
  "Change Settings": "Изменить настройки",
  "Stockfish loading...": "Stockfish загружается...",
  "Checkmate — Stockfish wins": "Мат — Stockfish победил",
  "Checkmate — You win": "Мат — вы победили",
  "Stockfish is thinking...": "Stockfish думает...",
  "You are in check": "Ваш король под шахом",
  "Stockfish is in check": "Король Stockfish под шахом",
  "Your turn": "Ваш ход",
  "Stockfish's turn": "Ход Stockfish",
  Multiplayer: "Мультиплеер",
  "Online game": "Онлайн-партия",
  Room: "Комната",
  "Game finished": "Партия окончена",
  "Opponent's turn": "Ход соперника",
  Leave: "Выйти",
  "White and Black": "Белые и чёрные",
  "Multiplayer connection": "Мультиплеерное соединение",
  "Room code": "Код комнаты",
  Status: "Статус",
  "Your color": "Ваш цвет",
  Connected: "Подключено",
  "Game and actions": "Партия и действия",
  "Leave game": "Покинуть партию",
  Game: "Партия",
  "Current game state": "Текущее состояние игры",
  Turn: "Ход",
  "Half-moves": "Полуходы",
  Version: "Версия",
  "Waiting for opponent...": "Ожидание соперника...",
  "Opponent wants a rematch.": "Соперник хочет реванш.",
  "Rematch requested": "Реванш запрошен",
  Rematch: "Реванш",
  "Back to lobby": "В лобби",
  "You win": "Вы победили",
  "You lose": "Вы проиграли",
  "Are you sure you want to resign?": "Вы уверены, что хотите сдаться?",
  "Resign now": "Сдаться",
  Moves: "Ходы",
  Player: "Игрок",
  "Game name": "Название партии",
  "White player": "Белые",
  "Black player": "Чёрные",
  Save: "Сохранить",
  Restart: "Начать заново",
  Undo: "Отменить",
  "Draw — Stalemate": "Ничья — пат",
  "Draw — Threefold repetition": "Ничья — троекратное повторение",
  "Draw — Insufficient material": "Ничья — недостаточно материала",
  "Your king is in check": "Ваш король под шахом",
  "Stockfish game settings": "Настройки игры Stockfish",
  Pawn: "Пешка",
  Knight: "Конь",
  Bishop: "Слон",
  Rook: "Ладья",
  Queen: "Ферзь",
  King: "Король",
  "Stockfish wins.": "Stockfish победил.",
  "You defeated Stockfish.": "Вы победили Stockfish.",
  "Draw.": "Ничья.",
  "Stockfish wins by resignation.": "Stockfish победил после сдачи.",
  "Sending move...": "Ход отправляется...",
  "Choose a piece": "Выберите фигуру",
  "Waiting for the next move": "Ожидание следующего хода",
  checkmate: "мат",
  stalemate: "пат",
  "threefold repetition": "троекратное повторение",
  "insufficient material": "недостаточно материала",
  draw: "ничья",
  "Your opponent wins the game.": "Соперник выигрывает партию.",
  "Live Coach is disabled during an online game.":
    "Live Coach отключён во время онлайн-партии.",
  "White in check": "Белые под шахом",
  "Black in check": "Чёрные под шахом",
};

function getInitialChessLanguage(): Language {
  if (typeof window === "undefined") return "en";
  const stored = window.localStorage.getItem("chess-language");
  return languageOptions.some((option) => option.value === stored)
    ? (stored as Language)
    : "en";
}

function translateChess(language: Language, key: string): string {
  if (language === "en") return key;
  if (language === "de") return deTranslations[key] ?? key;
  if (language === "bar")
    return bavarianTranslations[key] ?? deTranslations[key] ?? key;
  if (language === "ko") return koreanTranslations[key] ?? key;
  return russianTranslations[key] ?? key;
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
    <label
      className="
        flex
        items-center
        gap-2
        rounded-full
        border
        border-white/10
        bg-white/5
        px-3
        py-1.5
        text-xs
        font-bold
        text-zinc-400
      "
    >
      <span>🌐</span>
      <span className="hidden lg:inline">{label}</span>
      <select
        value={language}
        onChange={(event) => onChange(event.target.value as Language)}
        className="
          bg-transparent
          text-xs
          font-bold
          text-zinc-200
          outline-none
          [color-scheme:dark]
        "
        aria-label={label}
      >
        {languageOptions.map((option) => (
          <option
            key={option.value}
            value={option.value}
            className="bg-zinc-900 text-zinc-100"
          >
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/* =========================================================
   PIECE VALUES
   ========================================================= */

const pieceValues: Record<string, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0,
};

const pieceValueList = [
  {
    type: "p",
    symbol: "♙",
    name: "Pawn",
  },

  {
    type: "n",
    symbol: "♘",
    name: "Knight",
  },

  {
    type: "b",
    symbol: "♗",
    name: "Bishop",
  },

  {
    type: "r",
    symbol: "♖",
    name: "Rook",
  },

  {
    type: "q",
    symbol: "♕",
    name: "Queen",
  },

  {
    type: "k",
    symbol: "♔",
    name: "King",
  },
];

/* =========================================================
   COMPONENT
   ========================================================= */

export default function ChessBoard({ onlineGameId }: ChessBoardProps) {
  const { user, profile } = useAuth();

  const [language, setLanguage] = useState<Language>(getInitialChessLanguage);
  const t = (key: string) => translateChess(language, key);

  function changeLanguage(nextLanguage: Language) {
    setLanguage(nextLanguage);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("chess-language", nextLanguage);
    }
  }

  /* =======================================================
     CHESS GAME
     ======================================================= */

  const [game] = useState(() => new Chess());

  const [position, setPosition] = useState(game.fen());

  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);

  const [legalMoves, setLegalMoves] = useState<Square[]>([]);

  const [lastMove, setLastMove] = useState<{
    from: Square;
    to: Square;
  } | null>(null);

  const [moveHistory, setMoveHistory] = useState<string[]>([]);

  const [capturedWhite, setCapturedWhite] = useState<PieceType[]>([]);

  const [capturedBlack, setCapturedBlack] = useState<PieceType[]>([]);

  const [promotionSquare, setPromotionSquare] = useState<Square | null>(null);

  const [promotionFrom, setPromotionFrom] = useState<Square | null>(null);

  const [gameOver, setGameOver] = useState(false);

  const [gameOverReason, setGameOverReason] = useState("");

  const [winner, setWinner] = useState<"white" | "black" | "draw">("white");

  const [whiteCheckCounter, setWhiteCheckCounter] = useState<number>(0);

  const [blackCheckCounter, setBlackCheckCounter] = useState<number>(0);

  const [playerColor, setPlayerColor] = useState<"w" | "b" | null>(null);

  const [, setIllegal] = useState(false);

  /* =======================================================
     SAVED GAMES
     ======================================================= */

  const [savedGames, setSavedGames] = useState<SavedGame[]>([]);

  const [gameName, setGameName] = useState("");

  const [currentGameId, setCurrentGameId] = useState<string | null>(null);

  const [whitePlayer, setWhitePlayer] = useState("");

  const [blackPlayer, setBlackPlayer] = useState("");

  const [historyPreviewPly, setHistoryPreviewPly] = useState<number | null>(
    null,
  );

  /* =======================================================
     STOCKFISH COACH
     ======================================================= */

  const {
    ready: analysisReady,
    analyzing,
    analyzePosition,
  } = useStockfishAnalysis();

  const [moveFeedback, setMoveFeedback] = useState<MoveReview | null>(null);

  const [helpVisible, setHelpVisible] = useState(false);

  const [suggestions, setSuggestions] = useState<MoveSuggestion[]>([]);

  const [highlightedSuggestionUci, setHighlightedSuggestionUci] = useState<
    string | null
  >(null);

  const helpMove =
    helpVisible && highlightedSuggestionUci
      ? {
          from: highlightedSuggestionUci.slice(0, 2) as Square,
          to: highlightedSuggestionUci.slice(2, 4) as Square,
        }
      : null;

  const [reviewOpen, setReviewOpen] = useState(false);

  /*
   * HOTSEAT COACH MODE
   *
   * Off by default. When enabled, the live Chess Coach panel
   * is shown and Stockfish can grade moves / suggest best moves.
   */
  const [coachModeEnabled, setCoachModeEnabled] = useState(false);

  /*
   * Used to invalidate an old
   * asynchronous analysis when the
   * board is restarted, undone or
   * another game is loaded.
   */
  const coachGenerationRef = useRef(0);

  /*
   * This component still contains the
   * legacy onlineGameId support.
   *
   * Do not expose live engine help in
   * an online game.
   */
  const coachAllowed = !onlineGameId && coachModeEnabled;

  /* =======================================================
     BOARD
     ======================================================= */

  const board = game.board();

  /* =======================================================
     CLICKABLE MOVE HISTORY PREVIEW
     ======================================================= */

  const historyRows = useMemo(() => {
    const replay = new Chess();

    return moveHistory.map((san, index) => {
      const move = replay.move(san);

      return {
        ply: index + 1,
        moveNumber: Math.floor(index / 2) + 1,
        color: move.color,
        san: move.san,
        from: move.from,
        to: move.to,
        piece: move.piece as PieceType,
        fenAfter: replay.fen(),
      };
    });
  }, [moveHistory]);

  const historyPreview =
    historyPreviewPly !== null
      ? (historyRows[historyPreviewPly - 1] ?? null)
      : null;

  const historyPreviewChess = useMemo(
    () => (historyPreview ? new Chess(historyPreview.fenAfter) : null),
    [historyPreview?.fenAfter],
  );

  const displayedBoard = historyPreviewChess
    ? historyPreviewChess.board()
    : board;

  /*
   * HOTSEAT BOARD ORIENTATION
   *
   * In a local game, always place the side whose turn it is
   * at the bottom of the board:
   *
   *   White to move -> White at the bottom
   *   Black to move -> Black at the bottom
   *
   * The old onlineGameId mode keeps the board fixed to the
   * logged-in player's own side instead.
   *
   * While browsing move history, orient the preview toward
   * the side that is to move in that historical position.
   */
  const boardOrientation: "white" | "black" = historyPreviewChess
    ? historyPreviewChess.turn() === "w"
      ? "white"
      : "black"
    : onlineGameId && playerColor
      ? playerColor === "w"
        ? "white"
        : "black"
      : game.turn() === "w"
        ? "white"
        : "black";

  const historyPreviewMove = historyPreview
    ? {
        from: historyPreview.from,
        to: historyPreview.to,
      }
    : null;

  const historyPreviewCheckedKingSquare: Square | null =
    historyPreviewChess?.isCheck()
      ? (() => {
          const previewBoard = historyPreviewChess.board();
          const kingColor = historyPreviewChess.turn();

          for (let row = 0; row < previewBoard.length; row++) {
            for (let column = 0; column < previewBoard[row].length; column++) {
              const piece = previewBoard[row][column];

              if (piece?.type === "k" && piece.color === kingColor) {
                return getSquareName(row, column);
              }
            }
          }

          return null;
        })()
      : null;

  /* =======================================================
     MATERIAL
     ======================================================= */

  const whiteMaterial = capturedBlack.reduce(
    (total, piece) => total + pieceValues[piece],
    0,
  );

  const blackMaterial = capturedWhite.reduce(
    (total, piece) => total + pieceValues[piece],
    0,
  );

  const materialDifference = whiteMaterial - blackMaterial;

  /* =======================================================
     CHECKED KING
     ======================================================= */

  const checkedKingSquare: Square | null = game.isCheck()
    ? (() => {
        const kingColor = game.turn();

        for (let row = 0; row < board.length; row++) {
          for (let column = 0; column < board[row].length; column++) {
            const piece = board[row][column];

            if (piece?.type === "k" && piece.color === kingColor) {
              return getSquareName(row, column);
            }
          }
        }

        return null;
      })()
    : null;

  /* =======================================================
     SOUND
     ======================================================= */

  function playSound(sound: string) {
    const audio = new Audio(`/sounds/${sound}.mp3`);

    audio.play().catch(() => {});
  }

  /* =======================================================
     CLEAR COACH
     ======================================================= */

  function clearCoach() {
    coachGenerationRef.current += 1;

    setMoveFeedback(null);

    setHelpVisible(false);

    setSuggestions([]);

    setHighlightedSuggestionUci(null);
  }

  function toggleCoachMode() {
    if (coachModeEnabled) {
      clearCoach();
    }

    setCoachModeEnabled((enabled) => !enabled);
  }

  /* =======================================================
     REBUILD DERIVED GAME STATE
     ======================================================= */

  function rebuildDerivedState() {
    const sans = game.history();

    const replay = new Chess();

    const whiteCaptured: PieceType[] = [];

    const blackCaptured: PieceType[] = [];

    let whiteChecks = 0;

    let blackChecks = 0;

    let reconstructedLastMove: {
      from: Square;

      to: Square;
    } | null = null;

    for (const san of sans) {
      const move = replay.move(san);

      if (move.captured) {
        if (move.color === "w") {
          blackCaptured.push(move.captured as PieceType);
        } else {
          whiteCaptured.push(move.captured as PieceType);
        }
      }

      /*
       * After the move,
       * replay.turn() is the side
       * currently in check.
       */
      if (replay.isCheck()) {
        if (replay.turn() === "w") {
          whiteChecks += 1;
        } else {
          blackChecks += 1;
        }
      }

      reconstructedLastMove = {
        from: move.from,

        to: move.to,
      };
    }

    setCapturedWhite(whiteCaptured);

    setCapturedBlack(blackCaptured);

    setWhiteCheckCounter(whiteChecks);

    setBlackCheckCounter(blackChecks);

    setLastMove(reconstructedLastMove);

    setMoveHistory(sans);

    setPosition(game.fen());
  }

  /* =======================================================
     GAME OVER
     ======================================================= */

  function checkGameOver(playResultSound = false) {
    if (game.isCheckmate()) {
      setGameOver(true);

      setGameOverReason("Checkmate");

      if (game.turn() === "w") {
        setWinner("black");
      } else {
        setWinner("white");
      }

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

    if (game.isThreefoldRepetition()) {
      setGameOver(true);

      setGameOverReason("Threefold repetition");

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

    if (game.isDraw()) {
      setGameOver(true);

      setGameOverReason("Draw");

      setWinner("draw");

      if (playResultSound) {
        playSound("draw");
      }

      return true;
    }

    /*
     * Important when undoing a
     * previously finished game.
     */
    setGameOver(false);

    setGameOverReason("");

    return false;
  }

  /* =======================================================
     LIVE MOVE FEEDBACK
     ======================================================= */

  async function analyzeCompletedMove(
    beforeFen: string,
    afterFen: string,
    playedUci: string,
    playedSan: string,
  ) {
    if (!coachAllowed || !analysisReady) {
      return;
    }

    const generation = coachGenerationRef.current;

    const review = await gradeMove(
      beforeFen,
      afterFen,
      playedUci,
      playedSan,
      analyzePosition,
    );

    /*
     * The position may have been
     * restarted / undone / loaded
     * while Stockfish was working.
     */
    if (generation !== coachGenerationRef.current) {
      return;
    }

    if (review) {
      setMoveFeedback(review);
    }
  }

  /* =======================================================
     BEST MOVES HELP
     ======================================================= */

  async function showBestMoves() {
    /*
     * Help always works from the live position.
     * Leave history preview before asking Stockfish.
     */
    setHistoryPreviewPly(null);

    if (helpVisible) {
      setHelpVisible(false);

      setHighlightedSuggestionUci(null);

      return;
    }

    if (
      !coachAllowed ||
      !analysisReady ||
      analyzing ||
      gameOver ||
      game.isGameOver()
    ) {
      return;
    }

    const fen = game.fen();

    const generation = coachGenerationRef.current;

    setHelpVisible(true);

    setSuggestions([]);

    setHighlightedSuggestionUci(null);

    const result = await getBestSuggestions(fen, analyzePosition, 3);

    if (generation !== coachGenerationRef.current || game.fen() !== fen) {
      return;
    }

    setSuggestions(result);

    /*
     * Automatically show the
     * #1 move on the board.
     */
    setHighlightedSuggestionUci(result[0]?.uci ?? null);
  }

  /* =======================================================
     LEGACY ONLINE GAME LOAD
     ======================================================= */

  useEffect(() => {
    if (!onlineGameId || !user) {
      return;
    }

    async function loadOnlineGame() {
      const { data, error } = await supabase
        .from("online_games")
        .select("white_player, black_player, fen, moves, status")
        .eq("id", onlineGameId)
        .single();

      if (error) {
        console.error("Error loading online game:", error);

        return;
      }

      if (data.white_player === user?.id) {
        setPlayerColor("w");
      } else if (data.black_player === user?.id) {
        setPlayerColor("b");
      }

      clearCoach();

      setHistoryPreviewPly(null);

      game.reset();

      for (const move of data.moves ?? []) {
        game.move(move);
      }

      rebuildDerivedState();

      checkGameOver(false);
    }

    void loadOnlineGame();
  }, [onlineGameId, user]);

  /* =======================================================
     LOAD SAVED GAME LIST
     ======================================================= */

  useEffect(() => {
    if (user) {
      void loadSavedGames();
    }
  }, [user]);

  /* =======================================================
     SAVE GAME
     ======================================================= */

  async function saveGame() {
    if (!user) {
      console.error("You must be logged in to save a game.");

      return;
    }

    const gameData = {
      user_id: user.id,

      name: gameName || "Unnamed Game",

      white_player: whitePlayer || profile?.username || "White",

      black_player: blackPlayer || "Black",

      fen: game.fen(),

      moves: game.history(),

      white_check_counter: whiteCheckCounter,

      black_check_counter: blackCheckCounter,
    };

    if (currentGameId) {
      const { data, error } = await supabase
        .from("games")
        .update(gameData)
        .eq("id", currentGameId)
        .select()
        .single();

      if (error) {
        console.error("Error updating game:", error);

        return;
      }

      console.log("Game updated:", data);
    } else {
      const { data, error } = await supabase
        .from("games")
        .insert(gameData)
        .select()
        .single();

      if (error) {
        console.error("Error saving game:", error);

        return;
      }

      console.log("Game created:", data);

      setCurrentGameId(data.id);
    }

    await loadSavedGames();
  }

  /* =======================================================
     LOAD SAVED GAME
     ======================================================= */

  async function loadSpecificGame(id: string) {
    const { data, error } = await supabase
      .from("games")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      console.error("Error loading game:", error);

      return;
    }

    if (!data) {
      return;
    }

    clearCoach();

    setHistoryPreviewPly(null);

    game.reset();

    for (const move of data.moves ?? []) {
      game.move(move);
    }

    setGameName(data.name ?? "");

    setWhitePlayer(data.white_player ?? "");

    setBlackPlayer(data.black_player ?? "");

    setCurrentGameId(data.id);

    setSelectedSquare(null);

    setLegalMoves([]);

    setIllegal(false);

    setPromotionFrom(null);

    setPromotionSquare(null);

    rebuildDerivedState();

    checkGameOver(false);
  }

  /* =======================================================
     LOAD SAVED GAME LIST
     ======================================================= */

  async function loadSavedGames() {
    if (!user) {
      return;
    }

    const { data, error } = await supabase
      .from("games")
      .select(
        "id, created_at, name, white_player, black_player, fen, moves, white_check_counter, black_check_counter, user_id",
      )
      .eq("user_id", user.id)
      .order("created_at", {
        ascending: false,
      });

    if (error) {
      console.error("Error loading saved games:", error);

      return;
    }

    setSavedGames(data ?? []);
  }

  /* =======================================================
     RESTART
     ======================================================= */

  function restartGame() {
    clearCoach();

    setHistoryPreviewPly(null);

    game.reset();

    setPosition(game.fen());

    setSelectedSquare(null);

    setLegalMoves([]);

    setLastMove(null);

    setIllegal(false);

    setCapturedWhite([]);

    setCapturedBlack([]);

    setMoveHistory([]);

    setPromotionFrom(null);

    setPromotionSquare(null);

    setWinner("white");

    setGameOver(false);

    setGameOverReason("");

    setWhiteCheckCounter(0);

    setBlackCheckCounter(0);

    setCurrentGameId(null);

    setGameName("");

    setWhitePlayer("");

    setBlackPlayer("");

    setReviewOpen(false);
  }

  /* =======================================================
     UNDO
     ======================================================= */

  function undoMove() {
    /*
     * Do not mutate the position while
     * Coach Stockfish is evaluating it.
     */
    if (analyzing) {
      return;
    }

    const move = game.undo();

    if (!move) {
      return;
    }

    clearCoach();

    setHistoryPreviewPly(null);

    setSelectedSquare(null);

    setLegalMoves([]);

    setPromotionFrom(null);

    setPromotionSquare(null);

    setIllegal(false);

    rebuildDerivedState();

    checkGameOver(false);
  }

  /* =======================================================
     DELETE SAVED GAME
     ======================================================= */

  async function deleteGame(id: string) {
    const { error } = await supabase
      .from("games")
      .delete()
      .eq("id", id)
      .select();

    if (error) {
      console.error("Error deleting game:", error);

      return;
    }

    setSavedGames((games) => games.filter((savedGame) => savedGame.id !== id));
  }

  /* =======================================================
     PROMOTION
     ======================================================= */

  function promotePawn(piece: "q" | "r" | "b" | "n") {
    if (!promotionFrom || !promotionSquare || gameOver || analyzing) {
      return;
    }

    try {
      const beforeFen = game.fen();

      const move = game.move({
        from: promotionFrom,

        to: promotionSquare,

        promotion: piece,
      });

      const afterFen = game.fen();

      const playedUci = `${move.from}${move.to}${piece}`;

      setHistoryPreviewPly(null);

      /*
       * Help suggestions were for
       * the old position.
       */
      setHelpVisible(false);

      setSuggestions([]);

      setMoveFeedback(null);

      void analyzeCompletedMove(beforeFen, afterFen, playedUci, move.san);

      setLastMove({
        from: move.from,

        to: move.to,
      });

      if (move.captured) {
        playPieceCaptureSound(move.piece);

        if (move.color === "w") {
          setCapturedBlack((pieces) => [...pieces, move.captured as PieceType]);
        } else {
          setCapturedWhite((pieces) => [...pieces, move.captured as PieceType]);
        }
      } else {
        playPieceMoveSound(move.piece);
      }

      setMoveHistory(game.history());

      setPosition(afterFen);

      setPromotionFrom(null);

      setPromotionSquare(null);

      setSelectedSquare(null);

      setLegalMoves([]);

      /*
       * Check sound / counter.
       */
      if (!game.isCheckmate() && game.isCheck()) {
        if (game.turn() === "w") {
          setWhiteCheckCounter((counter) => counter + 1);
        } else {
          setBlackCheckCounter((counter) => counter + 1);
        }

        playSound("check");
      }

      checkGameOver(true);
    } catch (error) {
      console.error("Invalid promotion:", error);

      setPromotionFrom(null);

      setPromotionSquare(null);

      setSelectedSquare(null);

      setLegalMoves([]);
    }
  }

  /* =======================================================
     BOARD CLICK
     ======================================================= */

  function handleSquareClick(row: number, column: number) {
    if (gameOver || analyzing || historyPreviewPly !== null) {
      return;
    }
    if (helpVisible) {
      setHelpVisible(false);

      setSuggestions([]);

      setHighlightedSuggestionUci(null);
    }
    if (promotionFrom && promotionSquare) {
      return;
    }

    /*
     * Legacy online mode.
     */
    if (onlineGameId && playerColor && game.turn() !== playerColor) {
      return;
    }

    const square = getSquareName(row, column);

    const clickedPiece = game.get(square);

    /* =====================================================
       SELECT FIRST PIECE
       ===================================================== */

    if (selectedSquare === null) {
      if (!clickedPiece) {
        return;
      }

      /*
       * Only the side whose turn it
       * currently is may be selected.
       */
      if (clickedPiece.color !== game.turn()) {
        return;
      }

      setSelectedSquare(square);

      playPieceSelectSound(clickedPiece.type);

      const moves = game.moves({
        square,
        verbose: true,
      });

      setLegalMoves(moves.map((move) => move.to));

      return;
    }

    /* =====================================================
       SELECT DIFFERENT OWN PIECE
       ===================================================== */

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

    try {
      const selectedPiece = game.get(selectedSquare);

      /* ===================================================
         PROMOTION REQUEST
         =================================================== */

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

      /* ===================================================
         NORMAL MOVE
         =================================================== */

      const beforeFen = game.fen();

      const move = game.move({
        from: selectedSquare,

        to: square,
      });

      const afterFen = game.fen();

      const playedUci = `${move.from}${move.to}${move.promotion ?? ""}`;

      setHistoryPreviewPly(null);

      /*
       * Old suggestions belong to
       * the previous position.
       */
      setHelpVisible(false);

      setSuggestions([]);

      setMoveFeedback(null);

      /*
       * Grade this completed move.
       */
      void analyzeCompletedMove(beforeFen, afterFen, playedUci, move.san);

      setLastMove({
        from: move.from,

        to: move.to,
      });

      /* ===================================================
         SOUND
         =================================================== */

      if (move.captured) {
        playPieceCaptureSound(move.piece);
      } else {
        playPieceMoveSound(move.piece);
      }

      /* ===================================================
         CAPTURED PIECES
         =================================================== */

      if (move.captured) {
        if (move.color === "w") {
          setCapturedBlack((pieces) => [...pieces, move.captured as PieceType]);
        } else {
          setCapturedWhite((pieces) => [...pieces, move.captured as PieceType]);
        }
      }

      /* ===================================================
         HISTORY
         =================================================== */

      setMoveHistory(game.history());

      setIllegal(false);

      /* ===================================================
         CHECK
         =================================================== */

      if (!game.isCheckmate() && game.isCheck()) {
        if (game.turn() === "w") {
          setWhiteCheckCounter((counter) => counter + 1);
        } else {
          setBlackCheckCounter((counter) => counter + 1);
        }

        playSound("check");
      } else if (move.isKingsideCastle() || move.isQueensideCastle()) {
        playRandomSound(["castle-1", "castle-2"]);
      }

      setPosition(afterFen);

      /*
       * This now reliably sets
       * gameOver, which the original
       * file did not do after a normal
       * checkmate.
       */
      checkGameOver(true);
    } catch {
      console.log("Illegal move");

      setIllegal(true);

      playSound("illegal");
    }

    setLegalMoves([]);

    setSelectedSquare(null);
  }

  /* =======================================================
     RENDER
     ======================================================= */

  return (
    <div
      className="
        min-h-screen
        bg-[radial-gradient(circle_at_top,#21170f_0%,#111111_38%,#090909_100%)]
        px-4
        py-6
        text-zinc-100
        sm:px-6
        lg:px-8
      "
    >
      <div className="mx-auto max-w-[1500px]">
        {/* =================================================
            HEADER
           ================================================= */}

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
                border-amber-500/20
                bg-amber-400/10
                text-3xl
                text-amber-200
                shadow-inner
              "
            >
              ♞
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
                {t("Classic Chess")}
              </p>

              <h1
                className="
                  mt-0.5
                  text-2xl
                  font-black
                  tracking-tight
                  text-white
                "
              >
                {t("Hotseat")}
              </h1>

              <p className="mt-0.5 text-sm text-zinc-500">
                {t("Two players · one board")}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <ChessLanguageSelector
              language={language}
              onChange={changeLanguage}
              label={t("Language")}
            />

            {/* CURRENT TURN */}

            {!gameOver && (
              <div
                className="
                  flex
                  items-center
                  gap-2
                  rounded-full
                  border
                  border-white/10
                  bg-white/5
                  px-3
                  py-1.5
                  text-xs
                  font-bold
                  text-zinc-300
                "
              >
                <span
                  className="
                    h-2
                    w-2
                    animate-pulse
                    rounded-full
                    bg-amber-400
                  "
                />

                {game.turn() === "w" ? t("White to move") : t("Black to move")}
              </div>
            )}
          </div>
        </header>

        {/* =================================================
            MAIN LAYOUT
           ================================================= */}

        <main
          className="
            grid
            gap-6
            xl:grid-cols-[300px_minmax(0,1fr)_300px]
          "
        >
          {/* ===============================================
              LEFT SIDEBAR
             =============================================== */}

          <aside className="min-w-0">
            <div className="space-y-4 xl:sticky xl:top-6">
              {/* SAVED GAMES */}

              <section
                className="
                  overflow-hidden
                  rounded-3xl
                  border
                  border-white/10
                  bg-zinc-900/75
                  shadow-xl
                  shadow-black/20
                  backdrop-blur-md
                "
              >
                <div
                  className="
                    flex
                    items-center
                    justify-between
                    border-b
                    border-white/5
                    px-4
                    py-4
                  "
                >
                  <div>
                    <h2 className="text-sm font-bold text-zinc-100">
                      {t("Saved Games")}
                    </h2>

                    <p className="mt-1 text-xs text-zinc-500">
                      {t("Previous games")}
                    </p>
                  </div>

                  <div
                    className="
                      flex
                      h-9
                      min-w-9
                      items-center
                      justify-center
                      rounded-xl
                      border
                      border-amber-500/10
                      bg-amber-400/10
                      px-2
                      text-xs
                      font-bold
                      text-amber-300
                    "
                  >
                    {savedGames.length}
                  </div>
                </div>

                <div className="max-h-80 space-y-1 overflow-y-auto p-2">
                  {savedGames.length === 0 && (
                    <div className="py-9 text-center">
                      <div className="mb-2 text-3xl text-zinc-700">♟</div>

                      <p className="text-sm text-zinc-500">
                        {t("No saved games yet")}
                      </p>
                    </div>
                  )}

                  {savedGames.map((savedGame) => (
                    <div
                      key={savedGame.id}
                      className="
                          group
                          flex
                          items-center
                          gap-3
                          rounded-2xl
                          border
                          border-transparent
                          p-3
                          transition
                          duration-200
                          hover:border-white/5
                          hover:bg-white/5
                        "
                    >
                      <div className="min-w-0 flex-1">
                        <p
                          className="
                              truncate
                              text-sm
                              font-semibold
                              text-zinc-200
                            "
                        >
                          {savedGame.name || t("Unnamed Game")}
                        </p>

                        <p
                          className="
                              mt-1
                              truncate
                              text-xs
                              text-zinc-500
                            "
                        >
                          <span className="text-[#fff3d5]">♔</span>{" "}
                          {savedGame.white_player || t("White")}
                          <span className="mx-1.5 text-zinc-700">vs</span>
                          <span className="text-zinc-400">♚</span>{" "}
                          {savedGame.black_player || t("Black")}
                        </p>

                        <p className="mt-1 text-[10px] text-zinc-600">
                          {new Date(savedGame.created_at).toLocaleString()}
                        </p>
                      </div>

                      <div
                        className="
                            flex
                            shrink-0
                            gap-1
                            opacity-70
                            transition
                            group-hover:opacity-100
                          "
                      >
                        <button
                          type="button"
                          onClick={() => loadSpecificGame(savedGame.id)}
                          className="
                              flex
                              h-9
                              w-9
                              items-center
                              justify-center
                              rounded-xl
                              border
                              border-white/10
                              bg-white/5
                              transition
                              hover:border-amber-400/30
                              hover:bg-amber-400/10
                            "
                          title={t("Load game")}
                        >
                          <img
                            src={loadButton}
                            alt="Load"
                            className="h-4 w-4"
                          />
                        </button>

                        <button
                          type="button"
                          onClick={() => deleteGame(savedGame.id)}
                          className="
                              flex
                              h-9
                              w-9
                              items-center
                              justify-center
                              rounded-xl
                              border
                              border-white/10
                              bg-white/5
                              transition
                              hover:border-red-500/30
                              hover:bg-red-500/10
                            "
                          title={t("Delete game")}
                        >
                          <img
                            src={playButton}
                            alt="Delete"
                            className="h-4 w-4"
                          />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* CAPTURED PIECES */}

              <section
                className="
                  rounded-3xl
                  border
                  border-white/10
                  bg-zinc-900/75
                  p-4
                  shadow-xl
                  shadow-black/20
                  backdrop-blur-md
                "
              >
                <div className="mb-4 flex items-start justify-between">
                  <div>
                    <h2 className="text-sm font-bold text-zinc-100">
                      {t("Captured Pieces")}
                    </h2>

                    <p className="mt-1 text-xs text-zinc-500">
                      {t("Material overview")}
                    </p>
                  </div>

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

                <div
                  className="
                    rounded-2xl
                    border
                    border-white/5
                    bg-black/20
                    p-3
                  "
                >
                  <CapturedPieces
                    capturedBlack={capturedBlack}
                    capturedWhite={capturedWhite}
                  />
                </div>
              </section>

              {/* MOVE HISTORY */}

              <section
                className="
                  rounded-3xl
                  border
                  border-white/10
                  bg-zinc-900/75
                  p-4
                  shadow-xl
                  shadow-black/20
                  backdrop-blur-md
                "
              >
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-bold text-zinc-100">
                      {t("Move History")}
                    </h2>

                    <p className="mt-1 text-xs text-zinc-500">
                      {t("Game history")}
                    </p>
                  </div>

                  <span
                    className="
                      rounded-xl
                      bg-white/5
                      px-2.5
                      py-1
                      text-xs
                      font-semibold
                      text-zinc-400
                    "
                  >
                    {moveHistory.length}
                  </span>
                </div>

                <div
                  className="
                    max-h-80
                    overflow-y-auto
                    rounded-2xl
                    border
                    border-white/5
                    bg-black/20
                  "
                >
                  {historyRows.length === 0 ? (
                    <div className="px-4 py-8 text-center text-xs text-zinc-600">
                      {t("No moves yet")}
                    </div>
                  ) : (
                    <table className="w-full border-collapse">
                      <thead className="sticky top-0 z-10 bg-zinc-900">
                        <tr
                          className="
                            border-b
                            border-white/5
                            text-left
                            text-[9px]
                            font-black
                            uppercase
                            tracking-wider
                            text-zinc-600
                          "
                        >
                          <th className="px-3 py-2">{t("Move")}</th>
                          <th className="px-2 py-2">{t("Side")}</th>
                          <th className="px-2 py-2">{t("Played")}</th>
                        </tr>
                      </thead>

                      <tbody>
                        {historyRows.map((move) => {
                          const selected = historyPreviewPly === move.ply;

                          return (
                            <tr
                              key={move.ply}
                              tabIndex={0}
                              onClick={() => {
                                setHistoryPreviewPly(move.ply);
                                setHelpVisible(false);
                                setSuggestions([]);
                                setHighlightedSuggestionUci(null);
                                setSelectedSquare(null);
                                setLegalMoves([]);
                              }}
                              onKeyDown={(event) => {
                                if (
                                  event.key === "Enter" ||
                                  event.key === " "
                                ) {
                                  setHistoryPreviewPly(move.ply);
                                  setHelpVisible(false);
                                  setSuggestions([]);
                                  setHighlightedSuggestionUci(null);
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
                                {move.moveNumber}
                                {move.color === "w" ? "." : "..."}
                              </td>

                              <td className="px-2 py-2.5">
                                {move.color === "w" ? (
                                  <span
                                    className="
                                      inline-flex
                                      items-center
                                      gap-1
                                      rounded-full
                                      bg-[#fff3d5]/10
                                      px-2
                                      py-1
                                      text-[9px]
                                      font-bold
                                      text-[#fff3d5]
                                    "
                                  >
                                    ♔ {t("White")}
                                  </span>
                                ) : (
                                  <span
                                    className="
                                      inline-flex
                                      items-center
                                      gap-1
                                      rounded-full
                                      bg-white/5
                                      px-2
                                      py-1
                                      text-[9px]
                                      font-bold
                                      text-zinc-400
                                    "
                                  >
                                    ♚ {t("Black")}
                                  </span>
                                )}
                              </td>

                              <td className="px-2 py-2.5">
                                <div className="flex items-center gap-2">
                                  <span className="w-5 text-center text-lg leading-none">
                                    {getHistoryPieceSymbol(
                                      move.color,
                                      move.piece,
                                    )}
                                  </span>

                                  <span className="font-mono text-xs font-bold text-zinc-200">
                                    {move.san}
                                  </span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </section>
            </div>
          </aside>

          {/* ===============================================
              CENTER
             =============================================== */}

          <section className="min-w-0">
            <div className="mx-auto max-w-[820px]">
              {/* GAME OVER STATUS */}

              {gameOver && (
                <div
                  className="
                    mb-3
                    rounded-2xl
                    border
                    border-amber-500/20
                    bg-amber-400/[0.07]
                    px-4
                    py-3
                  "
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-amber-400">
                        {t("Game Over")}
                      </p>

                      <p className="mt-1 font-black text-white">
                        {gameOverReason}
                      </p>
                    </div>

                    <span className="text-sm font-bold text-zinc-300">
                      {winner === "draw"
                        ? t("Draw")
                        : winner === "white"
                          ? t("White wins")
                          : t("Black wins")}
                    </span>
                    <button
                      type="button"
                      onClick={() => setReviewOpen(true)}
                      className="
    rounded-xl
    border
    border-amber-400/20
    bg-amber-400/10
    px-4
    py-2.5
    text-sm
    font-bold
    text-amber-300
    transition
    hover:bg-amber-400/20
  "
                    >
                      ♞ {t("Open Game Review")}
                    </button>
                  </div>
                </div>
              )}

              {/* PROMOTION */}

              {promotionSquare && promotionFrom && (
                <div
                  className="
                      mb-3
                      rounded-2xl
                      border
                      border-amber-500/20
                      bg-zinc-900/90
                      p-3
                      shadow-xl
                    "
                >
                  <PromotionBar onPromote={promotePawn} />
                </div>
              )}

              {/* HISTORY PREVIEW STATUS */}

              {historyPreview && (
                <div
                  className="
                    mb-3
                    flex
                    items-center
                    justify-between
                    gap-4
                    rounded-xl
                    border
                    border-blue-400/20
                    bg-blue-400/[0.07]
                    px-4
                    py-3
                  "
                >
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-blue-300">
                      {t("History Preview")}
                    </p>

                    <p className="mt-1 text-sm font-bold text-white">
                      Move {historyPreview.moveNumber}
                      {historyPreview.color === "w" ? "." : "..."}{" "}
                      {historyPreview.san}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setHistoryPreviewPly(null)}
                    className="
                      shrink-0
                      rounded-lg
                      bg-white/10
                      px-3
                      py-2
                      text-xs
                      font-bold
                      text-zinc-200
                      transition
                      hover:bg-white/20
                    "
                  >
                    {t("Back to Live Board")}
                  </button>
                </div>
              )}

              {/* BOARD */}

              <Board
                board={displayedBoard}
                selectedSquare={
                  historyPreviewMove
                    ? null
                    : helpMove
                      ? helpMove.from
                      : selectedSquare
                }
                legalMoves={
                  historyPreviewMove
                    ? []
                    : helpMove
                      ? [helpMove.to]
                      : legalMoves
                }
                lastMove={historyPreviewMove ?? lastMove}
                checkedKingSquare={
                  historyPreview
                    ? historyPreviewCheckedKingSquare
                    : checkedKingSquare
                }
                onSquareClick={historyPreview ? () => {} : handleSquareClick}
                orientation={boardOrientation}
              />

              {/* ANALYSIS BLOCKING MESSAGE */}

              {analyzing && coachAllowed && (
                <div
                  className="
                      mt-3
                      flex
                      items-center
                      justify-center
                      gap-2
                      rounded-xl
                      border
                      border-white/5
                      bg-black/20
                      px-4
                      py-2
                      text-xs
                      text-zinc-500
                    "
                >
                  <span
                    className="
                        h-2
                        w-2
                        animate-pulse
                        rounded-full
                        bg-amber-400
                      "
                  />
                  {t("Stockfish is analyzing...")}
                </div>
              )}

              {/* MOBILE MATERIAL */}

              <div
                className="
                  mt-4
                  flex
                  items-center
                  justify-between
                  rounded-2xl
                  border
                  border-white/10
                  bg-zinc-900/75
                  px-4
                  py-3
                  xl:hidden
                "
              >
                <span className="text-sm text-zinc-500">{t("Material")}</span>

                <span className="text-sm font-bold text-zinc-200">
                  {materialDifference > 0 &&
                    `${t("White")} +${materialDifference}`}

                  {materialDifference < 0 &&
                    `${t("Black")} +${Math.abs(materialDifference)}`}

                  {materialDifference === 0 && t("Equal")}
                </span>
              </div>
            </div>
          </section>

          {/* ===============================================
              RIGHT SIDEBAR
             =============================================== */}

          <aside className="min-w-0">
            <div className="space-y-4 xl:sticky xl:top-6">
              {/* ===========================================
                  GAME CONTROLS
                 =========================================== */}

              <section
                className="
                  rounded-3xl
                  border
                  border-white/10
                  bg-zinc-900/75
                  p-4
                  shadow-xl
                  shadow-black/20
                  backdrop-blur-md
                "
              >
                <div className="mb-5">
                  <div className="flex items-center gap-2">
                    <div
                      className="
                        h-2
                        w-2
                        rounded-full
                        bg-amber-400
                        shadow-[0_0_10px_rgba(251,191,36,0.55)]
                      "
                    />

                    <h2 className="font-bold text-zinc-100">
                      {t("Game Controls")}
                    </h2>
                  </div>

                  <p className="mt-1.5 text-xs text-zinc-500">
                    {t("Players, game and actions")}
                  </p>
                </div>

                <GameControls
                  gameName={gameName}
                  whitePlayer={whitePlayer}
                  blackPlayer={blackPlayer}
                  onGameNameChange={setGameName}
                  onWhitePlayerChange={setWhitePlayer}
                  onBlackPlayerChange={setBlackPlayer}
                  onUndo={undoMove}
                  onRestart={restartGame}
                  onSave={saveGame}
                />
              </section>

              {/* ===========================================
                  CHESS COACH MODE TOGGLE
                 =========================================== */}

              {!onlineGameId && (
                <button
                  type="button"
                  onClick={toggleCoachMode}
                  aria-pressed={coachModeEnabled}
                  className={`
                    group
                    flex
                    w-full
                    items-center
                    justify-between
                    gap-4
                    rounded-3xl
                    border
                    p-4
                    text-left
                    shadow-xl
                    shadow-black/20
                    backdrop-blur-md
                    transition

                    ${
                      coachModeEnabled
                        ? "border-amber-400/30 bg-amber-400/[0.08] hover:bg-amber-400/[0.12]"
                        : "border-white/10 bg-zinc-900/75 hover:border-amber-400/20 hover:bg-zinc-900"
                    }
                  `}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`
                        flex
                        h-10
                        w-10
                        shrink-0
                        items-center
                        justify-center
                        rounded-xl
                        text-xl
                        transition

                        ${
                          coachModeEnabled
                            ? "bg-amber-400/15 text-amber-200"
                            : "bg-white/5 text-zinc-500 group-hover:text-amber-300"
                        }
                      `}
                    >
                      ♞
                    </div>

                    <div>
                      <p className="text-sm font-bold text-zinc-100">
                        {t("Chess Coach")}
                      </p>

                      <p className="mt-0.5 text-xs text-zinc-500">
                        {coachModeEnabled
                          ? t("Live analysis enabled")
                          : t("Enable Stockfish feedback")}
                      </p>
                    </div>
                  </div>

                  <div
                    className={`
                      relative
                      h-6
                      w-11
                      shrink-0
                      rounded-full
                      border
                      transition

                      ${
                        coachModeEnabled
                          ? "border-amber-400/30 bg-amber-400/20"
                          : "border-white/10 bg-black/30"
                      }
                    `}
                  >
                    <span
                      className={`
                        absolute
                        top-0.5
                        h-4
                        w-4
                        rounded-full
                        transition-all

                        ${
                          coachModeEnabled
                            ? "left-[22px] bg-amber-300"
                            : "left-1 bg-zinc-500"
                        }
                      `}
                    />
                  </div>
                </button>
              )}

              {/* ===========================================
                  CHESS COACH
                 =========================================== */}

              {coachAllowed && (
                <section
                  className="
                  rounded-3xl
                  border
                  border-white/10
                  bg-zinc-900/75
                  p-4
                  shadow-xl
                  shadow-black/20
                  backdrop-blur-md
                "
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="font-bold text-zinc-100">
                        {t("Chess Coach")}
                      </h2>

                      <p className="mt-1 text-xs text-zinc-500">
                        {t("Live Stockfish analysis")}
                      </p>
                    </div>

                    <div
                      className="
                      flex
                      h-9
                      w-9
                      items-center
                      justify-center
                      rounded-xl
                      bg-amber-400/10
                      text-xl
                      text-amber-200
                    "
                    >
                      ♞
                    </div>
                  </div>

                  {!coachAllowed ? (
                    <div
                      className="
                      mt-4
                      rounded-xl
                      border
                      border-white/5
                      bg-black/20
                      p-3
                      text-xs
                      leading-5
                      text-zinc-500
                    "
                    >
                      {t("Live Coach is disabled during an online game.")}
                    </div>
                  ) : (
                    <>
                      {/* MOVE FEEDBACK */}

                      {moveFeedback && (
                        <div
                          className="
                          mt-4
                          rounded-2xl
                          border
                          border-white/5
                          bg-black/20
                          p-3
                        "
                        >
                          <p
                            className="
                            text-[10px]
                            font-bold
                            uppercase
                            tracking-widest
                            text-zinc-500
                          "
                          >
                            {t("Last move")} ·{" "}
                            {moveFeedback.color === "w"
                              ? t("White")
                              : t("Black")}
                          </p>

                          <div className="mt-2 flex items-center justify-between gap-3">
                            <span className="font-mono text-lg font-black text-white">
                              {moveFeedback.san}
                            </span>

                            <QualityBadge quality={moveFeedback.quality} />
                          </div>

                          {moveFeedback.quality !== "Best" && (
                            <p className="mt-2 text-xs text-zinc-500">
                              {t("Evaluation loss")}:{" "}
                              <span className="font-semibold text-zinc-300">
                                {(moveFeedback.centipawnLoss / 100).toFixed(2)}{" "}
                                {t("pawns")}
                              </span>
                            </p>
                          )}

                          {moveFeedback.bestMoveSan &&
                            moveFeedback.quality !== "Best" && (
                              <p className="mt-1 text-xs text-zinc-500">
                                {t("Engine preferred")}:{" "}
                                <span className="font-mono font-bold text-amber-300">
                                  {moveFeedback.bestMoveSan}
                                </span>
                              </p>
                            )}
                        </div>
                      )}

                      {/* ANALYZING */}

                      {analyzing && !helpVisible && (
                        <div className="mt-3 flex items-center gap-2 text-xs text-zinc-500">
                          <span className="h-2 w-2 animate-pulse rounded-full bg-amber-400" />
                          {t("Analyzing last move...")}
                        </div>
                      )}

                      {/* HELP BUTTON */}

                      <button
                        type="button"
                        disabled={!analysisReady || analyzing || gameOver}
                        onClick={showBestMoves}
                        className={`
                        mt-4
                        w-full
                        rounded-xl
                        border
                        px-4
                        py-3
                        text-sm
                        font-bold
                        transition

                        ${
                          helpVisible
                            ? `
                              border-amber-400/30
                              bg-amber-400/10
                              text-amber-300
                            `
                            : `
                              border-white/10
                              bg-white/5
                              text-zinc-300
                              hover:bg-white/10
                            `
                        }

                        disabled:cursor-not-allowed
                        disabled:opacity-40
                      `}
                      >
                        {analyzing && helpVisible
                          ? "Analyzing..."
                          : helpVisible
                            ? "Hide Help"
                            : "Help · Best Moves"}
                      </button>

                      {/* SUGGESTIONS */}

                      {helpVisible && (
                        <div className="mt-3 space-y-2">
                          {suggestions.length === 0 ? (
                            <div
                              className="
                              rounded-xl
                              bg-black/20
                              px-3
                              py-4
                              text-center
                              text-xs
                              text-zinc-500
                            "
                            >
                              {analyzing
                                ? t("Stockfish is analyzing...")
                                : t("No analysis available.")}
                            </div>
                          ) : (
                            suggestions.map((suggestion, index) => {
                              const selected =
                                highlightedSuggestionUci === suggestion.uci;

                              return (
                                <button
                                  key={`${suggestion.uci}-${index}`}
                                  type="button"
                                  onClick={() =>
                                    setHighlightedSuggestionUci(suggestion.uci)
                                  }
                                  className={`
          flex
          w-full
          items-center
          justify-between
          rounded-xl
          border
          px-3
          py-2.5
          text-left
          transition

          ${
            selected
              ? `
                border-amber-400/30
                bg-amber-400/10
              `
              : `
                border-white/5
                bg-black/20
                hover:bg-white/5
              `
          }
        `}
                                >
                                  <div className="flex items-center gap-3">
                                    <span
                                      className={`
              flex
              h-6
              w-6
              items-center
              justify-center
              rounded-md
              text-[10px]
              font-black

              ${
                selected
                  ? "bg-amber-400 text-zinc-950"
                  : "bg-amber-400/10 text-amber-300"
              }
            `}
                                    >
                                      {index + 1}
                                    </span>

                                    <div>
                                      <p className="font-mono text-sm font-bold text-zinc-200">
                                        {suggestion.san}
                                      </p>

                                      <p className="text-[10px] text-zinc-600">
                                        {selected
                                          ? t("Shown on board")
                                          : t("Click to show")}
                                      </p>
                                    </div>
                                  </div>

                                  <span className="text-xs font-semibold text-zinc-400">
                                    {suggestion.evaluation}
                                  </span>
                                </button>
                              );
                            })
                          )}
                        </div>
                      )}
                    </>
                  )}
                </section>
              )}

              {/* ===========================================
                  PIECE VALUES
                 =========================================== */}

              <section
                className="
                  rounded-3xl
                  border
                  border-white/10
                  bg-zinc-900/75
                  p-4
                  shadow-xl
                  shadow-black/20
                  backdrop-blur-md
                "
              >
                <div className="mb-4 flex items-start justify-between">
                  <div>
                    <h2 className="text-sm font-bold text-zinc-100">
                      {t("Piece Values")}
                    </h2>

                    <p className="mt-1 text-xs text-zinc-500">
                      {t("Standard values")}
                    </p>
                  </div>

                  <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">
                    Material
                  </span>
                </div>

                <div className="space-y-1">
                  {pieceValueList.map((piece) => (
                    <div
                      key={piece.type}
                      className="
                          flex
                          items-center
                          justify-between
                          rounded-xl
                          px-3
                          py-2
                          transition
                          hover:bg-white/5
                        "
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className="
                              flex
                              h-8
                              w-8
                              items-center
                              justify-center
                              text-2xl
                              text-[#fff3d5]
                              [text-shadow:0_2px_3px_rgba(0,0,0,0.6)]
                            "
                        >
                          {piece.symbol}
                        </span>

                        <span className="text-sm text-zinc-300">
                          {t(piece.name)}
                        </span>
                      </div>

                      <span
                        className="
                            rounded-lg
                            border
                            border-white/5
                            bg-black/20
                            px-2.5
                            py-1
                            text-xs
                            font-bold
                            text-amber-200
                          "
                      >
                        {pieceValues[piece.type]}
                      </span>
                    </div>
                  ))}
                </div>

                {/* ADVANTAGE */}

                <div className="mt-4 border-t border-white/5 pt-4">
                  <div
                    className="
                      flex
                      items-center
                      justify-between
                      rounded-2xl
                      border
                      border-white/5
                      bg-black/20
                      px-3
                      py-3
                    "
                  >
                    <span className="text-sm text-zinc-500">
                      {t("Advantage")}
                    </span>

                    <span
                      className={`
                        text-sm
                        font-bold

                        ${
                          materialDifference > 0
                            ? "text-amber-200"
                            : materialDifference < 0
                              ? "text-zinc-300"
                              : "text-zinc-500"
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
                </div>

                {/* CHECK COUNTERS */}

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-black/20 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wider text-zinc-600">
                      {t("White in check")}
                    </p>

                    <p className="mt-1 font-bold text-zinc-300">
                      {whiteCheckCounter}
                    </p>
                  </div>

                  <div className="rounded-xl bg-black/20 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wider text-zinc-600">
                      {t("Black in check")}
                    </p>

                    <p className="mt-1 font-bold text-zinc-300">
                      {blackCheckCounter}
                    </p>
                  </div>
                </div>
              </section>
            </div>
          </aside>
        </main>
      </div>
      <ChessGameReview
        moves={moveHistory}
        orientation="white"
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
      />
    </div>
  );
}

/* =========================================================
   QUALITY BADGE
   ========================================================= */

function QualityBadge({ quality }: { quality: MoveReview["quality"] }) {
  const styles: Record<MoveReview["quality"], string> = {
    Best: "border-emerald-500/20 bg-emerald-500/15 text-emerald-300",

    Excellent: "border-cyan-500/20 bg-cyan-500/15 text-cyan-300",

    Good: "border-blue-500/20 bg-blue-500/15 text-blue-300",

    Inaccuracy: "border-yellow-500/20 bg-yellow-500/15 text-yellow-300",

    Mistake: "border-orange-500/20 bg-orange-500/15 text-orange-300",

    Blunder: "border-red-500/20 bg-red-500/15 text-red-300",
  };

  return (
    <span
      className={`
        shrink-0
        rounded-full
        border
        px-2.5
        py-1
        text-[9px]
        font-black
        uppercase
        tracking-wider

        ${styles[quality]}
      `}
    >
      {quality}
    </span>
  );
}

/* =========================================================
   HISTORY PIECE SYMBOL
   ========================================================= */

function getHistoryPieceSymbol(color: "w" | "b", piece: PieceType) {
  const symbols: Record<"w" | "b", Record<PieceType, string>> = {
    w: {
      p: "♙",
      n: "♘",
      b: "♗",
      r: "♖",
      q: "♕",
      k: "♔",
    },

    b: {
      p: "♟",
      n: "♞",
      b: "♝",
      r: "♜",
      q: "♛",
      k: "♚",
    },
  };

  return symbols[color][piece];
}
