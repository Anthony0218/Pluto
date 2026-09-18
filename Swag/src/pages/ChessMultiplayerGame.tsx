import { useCallback, useEffect, useMemo, useState } from "react";

import { Link, useParams } from "react-router-dom";

import { Chess, type Square } from "chess.js";

import Board from "../components/Board";
import PromotionBar from "../components/PromotionBar";

import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

type ChessRoom = {
  id: string;
  code: string;
  host_id: string;
  status: "waiting" | "ready" | "playing" | "finished";
};

type RoomPlayer = {
  room_id: string;
  user_id: string;
  seat: number;
  display_name: string;
};

type MultiplayerGame = {
  room_id: string;

  fen: string;

  moves: string[];

  status: "waiting" | "playing" | "finished";

  winner: "white" | "black" | "draw" | null;

  end_reason: string | null;

  version: number;

  last_move_from: string | null;

  last_move_to: string | null;

  white_rematch_ready: boolean;
  black_rematch_ready: boolean;
};

type GameOutcome = {
  finished: boolean;

  winner: "white" | "black" | "draw" | null;

  reason: string | null;
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

function getGameOutcome(game: Chess): GameOutcome {
  if (game.isCheckmate()) {
    return {
      finished: true,

      /*
       * game.turn() is the player
       * who has been checkmated.
       */
      winner: game.turn() === "w" ? "black" : "white",

      reason: "checkmate",
    };
  }

  if (game.isStalemate()) {
    return {
      finished: true,
      winner: "draw",
      reason: "stalemate",
    };
  }

  if (game.isThreefoldRepetition()) {
    return {
      finished: true,
      winner: "draw",
      reason: "threefold repetition",
    };
  }

  if (game.isInsufficientMaterial()) {
    return {
      finished: true,
      winner: "draw",
      reason: "insufficient material",
    };
  }

  if (game.isDrawByFiftyMoves()) {
    return {
      finished: true,
      winner: "draw",
      reason: "50-move rule",
    };
  }

  if (game.isDraw()) {
    return {
      finished: true,
      winner: "draw",
      reason: "draw",
    };
  }

  return {
    finished: false,
    winner: null,
    reason: null,
  };
}

export default function ChessMultiplayerGame() {
  const { roomCode } = useParams();

  const { user } = useAuth();

  const [language, setLanguage] = useState<Language>(getInitialChessLanguage);
  const t = (key: string) => translateChess(language, key);

  function changeLanguage(nextLanguage: Language) {
    setLanguage(nextLanguage);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("chess-language", nextLanguage);
    }
  }

  const [room, setRoom] = useState<ChessRoom | null>(null);

  const [players, setPlayers] = useState<RoomPlayer[]>([]);

  const [gameState, setGameState] = useState<MultiplayerGame | null>(null);

  const [mySeat, setMySeat] = useState<number | null>(null);

  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);

  const [legalMoves, setLegalMoves] = useState<Square[]>([]);

  const [promotionFrom, setPromotionFrom] = useState<Square | null>(null);

  const [promotionSquare, setPromotionSquare] = useState<Square | null>(null);

  const [loading, setLoading] = useState(true);

  const [moving, setMoving] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const [showResignConfirm, setShowResignConfirm] = useState(false);

  const [actionLoading, setActionLoading] = useState<
    "resign" | "rematch" | null
  >(null);
  async function resignGame() {
    if (!room || gameState?.status !== "playing" || actionLoading) {
      return;
    }

    setActionLoading("resign");

    setError(null);

    const { error: resignError } = await supabase.rpc("resign_chess_game", {
      p_room_id: room.id,
    });

    setActionLoading(null);

    setShowResignConfirm(false);

    if (resignError) {
      console.error(resignError);

      setError(resignError.message);
    }
  }
  async function requestRematch() {
    if (!room || gameState?.status !== "finished" || actionLoading) {
      return;
    }

    setActionLoading("rematch");

    setError(null);

    const { error: rematchError } = await supabase.rpc(
      "request_chess_rematch",
      {
        p_room_id: room.id,
      },
    );

    setActionLoading(null);

    if (rematchError) {
      console.error(rematchError);

      setError(rematchError.message);
    }
  }

  /*
   * Build a fresh chess.js game whenever
   * the database FEN changes.
   *
   * This is cleaner for multiplayer than
   * maintaining one mutable Chess object.
   */
  const chess = useMemo(() => {
    if (!gameState) {
      return new Chess();
    }

    return new Chess(gameState.fen);
  }, [gameState]);

  const board = chess.board();

  const myColor: "w" | "b" | null =
    mySeat === 0 ? "w" : mySeat === 1 ? "b" : null;

  const orientation: "white" | "black" = mySeat === 1 ? "black" : "white";

  /*
   * Convert database last move into
   * Board's expected structure.
   */
  const lastMove =
    gameState?.last_move_from && gameState?.last_move_to
      ? {
          from: gameState.last_move_from as Square,

          to: gameState.last_move_to as Square,
        }
      : null;

  /*
   * Locate checked king.
   */
  const checkedKingSquare: Square | null = chess.isCheck()
    ? (() => {
        const kingColor = chess.turn();

        for (let row = 0; row < board.length; row++) {
          for (let column = 0; column < board[row].length; column++) {
            const piece = board[row][column];

            if (piece?.type === "k" && piece.color === kingColor) {
              const files = "abcdefgh";

              const rank = 8 - row;

              return `${files[column]}${rank}` as Square;
            }
          }
        }

        return null;
      })()
    : null;

  /*
   * ----------------------------------
   * LOAD ROOM
   * ----------------------------------
   */

  const loadGame = useCallback(async () => {
    if (!roomCode || !user) {
      return;
    }

    setLoading(true);
    setError(null);

    const { data: roomData, error: roomError } = await supabase
      .from("chess_rooms")
      .select(
        `
            id,
            code,
            host_id,
            status
          `,
      )
      .eq("code", roomCode.toUpperCase())
      .single();

    if (roomError || !roomData) {
      console.error(roomError);

      setError("Room not found.");

      setLoading(false);

      return;
    }

    const loadedRoom = roomData as ChessRoom;

    setRoom(loadedRoom);

    /*
     * Players
     */

    const { data: playerData, error: playerError } = await supabase
      .from("chess_room_players")
      .select(
        `
            room_id,
            user_id,
            seat,
            display_name
          `,
      )
      .eq("room_id", loadedRoom.id)
      .order("seat", {
        ascending: true,
      });

    if (playerError) {
      console.error(playerError);

      setError("Players could not be loaded.");

      setLoading(false);

      return;
    }

    const loadedPlayers = (playerData ?? []) as RoomPlayer[];

    setPlayers(loadedPlayers);

    const me = loadedPlayers.find((player) => player.user_id === user.id);

    if (!me) {
      setError("You are not a player in this room.");

      setLoading(false);

      return;
    }

    setMySeat(me.seat);

    /*
     * Chess game
     */

    const { data: gameData, error: gameError } = await supabase
      .from("chess_games")
      .select(
        `
  room_id,
  fen,
  moves,
  status,
  winner,
  end_reason,
  version,
  last_move_from,
  last_move_to,
  white_rematch_ready,
  black_rematch_ready
`,
      )
      .eq("room_id", loadedRoom.id)
      .single();

    if (gameError || !gameData) {
      console.error(gameError);

      setError("Game could not be loaded.");

      setLoading(false);

      return;
    }

    setGameState(gameData as MultiplayerGame);

    setLoading(false);
  }, [roomCode, user]);

  useEffect(() => {
    void loadGame();
  }, [loadGame]);

  /*
   * ----------------------------------
   * REALTIME
   * ----------------------------------
   */

  useEffect(() => {
    if (!room) {
      return;
    }

    const channel = supabase
      .channel(`chess-game-${room.id}`)

      .on(
        "postgres_changes",
        {
          event: "UPDATE",

          schema: "public",

          table: "chess_games",

          filter: `room_id=eq.${room.id}`,
        },

        (payload) => {
          const updated = payload.new as MultiplayerGame;

          setGameState(updated);

          /*
           * Clear selection after
           * either player moves.
           */
          setSelectedSquare(null);

          setLegalMoves([]);
        },
      )

      .subscribe((status, err) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.error("Chess Realtime:", status, err);
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [room]);

  /*
   * ----------------------------------
   * SEND MOVE
   * ----------------------------------
   */

  async function submitMove(
    from: Square,
    to: Square,
    promotion?: "q" | "r" | "b" | "n",
  ) {
    if (!room || !gameState || moving) {
      return;
    }

    /*
     * Use a local chess.js copy.
     */
    const localGame = new Chess(gameState.fen);

    let move;

    try {
      move = localGame.move({
        from,
        to,
        promotion,
      });
    } catch {
      setError("Illegal move.");

      return;
    }

    if (!move) {
      return;
    }
    const outcome = getGameOutcome(localGame);
    setMoving(true);
    setError(null);

    const { error: moveError } = await supabase.rpc("play_chess_move", {
      p_room_id: room.id,

      p_from: move.from,

      p_to: move.to,

      p_move_san: move.san,

      p_new_fen: localGame.fen(),

      p_expected_version: gameState.version,

      p_is_finished: outcome.finished,

      p_winner: outcome.winner,

      p_end_reason: outcome.reason,
    });

    setMoving(false);

    if (moveError) {
      console.error(moveError);

      /*
       * Most commonly caused by another
       * tab / stale position.
       */
      setError(moveError.message);

      await loadGame();

      return;
    }

    /*
     * Update immediately instead of
     * waiting a few milliseconds for
     * Realtime.
     *
     * Realtime will shortly send the
     * authoritative row too.
     */
    setGameState((current) =>
      current
        ? {
            ...current,

            fen: localGame.fen(),

            moves: [...current.moves, move.san],

            version: current.version + 1,

            last_move_from: move.from,

            last_move_to: move.to,

            status: outcome.finished ? "finished" : "playing",

            winner: outcome.winner,

            end_reason: outcome.reason,
          }
        : current,
    );

    setSelectedSquare(null);

    setLegalMoves([]);
  }

  /*
   * ----------------------------------
   * BOARD CLICK
   * ----------------------------------
   */

  function handleSquareClick(row: number, column: number) {
    if (!gameState || !myColor || moving) {
      return;
    }

    if (gameState.status !== "playing") {
      return;
    }

    /*
     * Only allow moves on our turn.
     */
    if (chess.turn() !== myColor) {
      return;
    }

    const files = "abcdefgh";

    const square = `${files[column]}${8 - row}` as Square;

    const clickedPiece = chess.get(square);

    /*
     * Nothing selected yet.
     */
    if (selectedSquare === null) {
      if (!clickedPiece || clickedPiece.color !== myColor) {
        return;
      }

      setSelectedSquare(square);

      const moves = chess.moves({
        square,
        verbose: true,
      });

      setLegalMoves(moves.map((move) => move.to));

      return;
    }

    /*
     * Click another own piece:
     * change selection.
     */
    if (clickedPiece && clickedPiece.color === myColor) {
      setSelectedSquare(square);

      const moves = chess.moves({
        square,
        verbose: true,
      });

      setLegalMoves(moves.map((move) => move.to));

      return;
    }

    /*
     * Illegal destination.
     */
    if (!legalMoves.includes(square)) {
      setSelectedSquare(null);

      setLegalMoves([]);

      return;
    }

    /*
     * Promotion?
     */
    const selectedPiece = chess.get(selectedSquare);

    if (
      selectedPiece?.type === "p" &&
      (square[1] === "8" || square[1] === "1")
    ) {
      setPromotionFrom(selectedSquare);

      setPromotionSquare(square);

      setSelectedSquare(null);

      setLegalMoves([]);

      return;
    }

    void submitMove(selectedSquare, square);
  }

  function promotePawn(piece: "q" | "r" | "b" | "n") {
    if (!promotionFrom || !promotionSquare) {
      return;
    }

    const from = promotionFrom;

    const to = promotionSquare;

    setPromotionFrom(null);

    setPromotionSquare(null);

    void submitMove(from, to, piece);
  }

  /*
   * ----------------------------------
   * LOADING / ERROR
   * ----------------------------------
   */

  if (loading || !room || !gameState || mySeat === null) {
    return (
      <main
        className="
          flex
          min-h-screen
          items-center
          justify-center
          bg-zinc-950
          text-zinc-400
        "
      >
        Loading multiplayer game...
      </main>
    );
  }

  const white = players.find((player) => player.seat === 0);

  const black = players.find((player) => player.seat === 1);

  const isMyTurn = chess.turn() === myColor;
  const myRematchReady =
    mySeat === 0
      ? gameState.white_rematch_ready
      : gameState.black_rematch_ready;

  const opponentRematchReady =
    mySeat === 0
      ? gameState.black_rematch_ready
      : gameState.white_rematch_ready;

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
        {/* =========================================================
          HEADER
         ========================================================= */}

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

              <h1 className="mt-0.5 text-2xl font-black tracking-tight text-white">
                {t("Multiplayer")}
              </h1>

              <p className="mt-0.5 text-sm text-zinc-500">
                {t("Online game")} · {t("Room")} {room.code}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <ChessLanguageSelector
              language={language}
              onChange={changeLanguage}
              label={t("Language")}
            />

            <div
              className={`
              flex
              items-center
              gap-2
              rounded-full
              border
              px-3
              py-1.5
              text-xs
              font-bold

              ${
                gameState.status === "finished"
                  ? "border-zinc-700 bg-zinc-800 text-zinc-400"
                  : isMyTurn
                    ? "border-amber-500/20 bg-amber-400/10 text-amber-200"
                    : "border-white/10 bg-white/5 text-zinc-400"
              }
            `}
            >
              {gameState.status === "finished" ? (
                <>● {t("Game finished")}</>
              ) : isMyTurn ? (
                <>
                  <span className="h-2 w-2 animate-pulse rounded-full bg-amber-400" />
                  {t("Your turn")}
                </>
              ) : (
                <>
                  <span className="h-2 w-2 rounded-full bg-zinc-600" />
                  {t("Opponent's turn")}
                </>
              )}
            </div>

            <Link
              to="/chess/classic/multiplayer"
              className="
              rounded-full
              border
              border-white/10
              bg-white/5
              px-3
              py-1.5
              text-xs
              font-semibold
              text-zinc-400
              transition
              hover:bg-white/10
              hover:text-white
            "
            >
              {t("Leave")}
            </Link>
          </div>
        </header>

        {/* =========================================================
          MAIN
         ========================================================= */}

        <main
          className="
          grid
          gap-6
          xl:grid-cols-[300px_minmax(0,1fr)_300px]
        "
        >
          {/* =========================================================
            LEFT SIDEBAR
           ========================================================= */}

          <aside className="min-w-0">
            <div className="space-y-4 xl:sticky xl:top-6">
              {/* PLAYERS */}

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
                <div className="mb-4">
                  <h2 className="text-sm font-bold text-zinc-100">
                    {t("Players")}
                  </h2>

                  <p className="mt-1 text-xs text-zinc-500">
                    {t("White and Black")}
                  </p>
                </div>

                <div className="space-y-3">
                  <PlayerBar
                    name={white?.display_name ?? t("White")}
                    color="white"
                    active={
                      gameState.status === "playing" && chess.turn() === "w"
                    }
                    me={mySeat === 0}
                    t={t}
                  />

                  <PlayerBar
                    name={black?.display_name ?? t("Black")}
                    color="black"
                    active={
                      gameState.status === "playing" && chess.turn() === "b"
                    }
                    me={mySeat === 1}
                    t={t}
                  />
                </div>
              </section>

              {/* ROOM INFORMATION */}

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
                <div>
                  <h2 className="text-sm font-bold text-zinc-100">
                    {t("Room")}
                  </h2>

                  <p className="mt-1 text-xs text-zinc-500">
                    {t("Multiplayer connection")}
                  </p>
                </div>

                <div className="mt-4 space-y-2">
                  <div
                    className="
                    flex
                    items-center
                    justify-between
                    rounded-xl
                    border
                    border-white/5
                    bg-black/20
                    px-3
                    py-3
                  "
                  >
                    <span className="text-xs text-zinc-500">
                      {t("Room code")}
                    </span>

                    <span
                      className="
                      font-black
                      tracking-[0.18em]
                      text-amber-200
                    "
                    >
                      {room.code}
                    </span>
                  </div>

                  <div
                    className="
                    flex
                    items-center
                    justify-between
                    rounded-xl
                    border
                    border-white/5
                    bg-black/20
                    px-3
                    py-3
                  "
                  >
                    <span className="text-xs text-zinc-500">{t("Status")}</span>

                    <span className="text-xs font-bold capitalize text-zinc-300">
                      {gameState.status}
                    </span>
                  </div>

                  <div
                    className="
                    flex
                    items-center
                    justify-between
                    rounded-xl
                    border
                    border-white/5
                    bg-black/20
                    px-3
                    py-3
                  "
                  >
                    <span className="text-xs text-zinc-500">
                      {t("Your color")}
                    </span>

                    <span className="text-sm font-bold text-zinc-200">
                      {mySeat === 0 ? t("White") : t("Black")}
                    </span>
                  </div>
                </div>
              </section>

              {/* CONNECTION */}

              <section
                className="
                rounded-3xl
                border
                border-emerald-500/10
                bg-emerald-500/[0.04]
                p-4
              "
              >
                <div className="flex items-center gap-3">
                  <span
                    className="
                    h-2.5
                    w-2.5
                    rounded-full
                    bg-emerald-400
                    shadow-[0_0_10px_rgba(52,211,153,0.5)]
                  "
                  />

                  <div>
                    <p className="text-sm font-bold text-zinc-200">
                      {t("Connected")}
                    </p>

                    <p className="mt-0.5 text-[11px] text-zinc-500">
                      Supabase Realtime
                    </p>
                  </div>
                </div>
              </section>
            </div>
          </aside>

          {/* =========================================================
            CENTER
           ========================================================= */}

          <section className="min-w-0">
            <div className="mx-auto max-w-[820px]">
              {/* STATUS */}

              <div
                className={`
                mb-3
                flex
                items-center
                justify-between
                rounded-2xl
                border
                px-4
                py-3
                shadow-lg
                shadow-black/10
                backdrop-blur-md

                ${
                  gameState.status === "finished"
                    ? "border-white/10 bg-zinc-900/75"
                    : isMyTurn
                      ? "border-amber-500/20 bg-amber-400/[0.07]"
                      : "border-white/10 bg-zinc-900/75"
                }
              `}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`
                    flex
                    h-9
                    w-9
                    items-center
                    justify-center
                    rounded-xl
                    text-xl

                    ${
                      isMyTurn
                        ? "bg-amber-400/10 text-amber-200"
                        : "bg-white/5 text-zinc-500"
                    }
                  `}
                  >
                    {mySeat === 0 ? "♔" : "♚"}
                  </div>

                  <div>
                    <p className="text-sm font-bold text-zinc-100">
                      {gameState.status === "finished"
                        ? t("Game finished")
                        : isMyTurn
                          ? t("Your turn")
                          : t("Opponent's turn")}
                    </p>

                    <p className="mt-0.5 text-xs text-zinc-500">
                      {gameState.status === "finished"
                        ? t(gameState.end_reason ?? "Game Over")
                        : moving
                          ? t("Sending move...")
                          : isMyTurn
                            ? t("Choose a piece")
                            : t("Waiting for the next move")}
                    </p>
                  </div>
                </div>

                {gameState.status === "playing" && (
                  <span
                    className={`
                    rounded-full
                    px-3
                    py-1
                    text-[10px]
                    font-black
                    uppercase
                    tracking-widest

                    ${
                      isMyTurn
                        ? "bg-amber-400/10 text-amber-300"
                        : "bg-white/5 text-zinc-500"
                    }
                  `}
                  >
                    {chess.turn() === "w" ? t("White") : t("Black")}
                  </span>
                )}
              </div>

              {/* ERROR */}

              {error && (
                <div
                  className="
                  mb-3
                  rounded-2xl
                  border
                  border-red-500/20
                  bg-red-500/10
                  px-4
                  py-3
                  text-center
                  text-sm
                  text-red-300
                "
                >
                  {error}
                </div>
              )}

              {/* PROMOTION */}

              {promotionFrom && promotionSquare && (
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

              {/* =====================================================
                BOARD
               ===================================================== */}

              <div className="relative">
                <Board
                  board={board}
                  selectedSquare={selectedSquare}
                  legalMoves={legalMoves}
                  lastMove={lastMove}
                  checkedKingSquare={checkedKingSquare}
                  onSquareClick={handleSquareClick}
                  orientation={orientation}
                />

                {/* GAME OVER */}

                {gameState.status === "finished" && (
                  <div
                    className="
                    absolute
                    inset-0
                    z-30
                    flex
                    items-center
                    justify-center
                    rounded-[28px]
                    bg-black/75
                    p-6
                    backdrop-blur-sm
                  "
                  >
                    <div
                      className="
                      w-full
                      max-w-sm
                      rounded-3xl
                      border
                      border-white/10
                      bg-zinc-900/95
                      p-7
                      text-center
                      shadow-2xl
                      shadow-black/50
                    "
                    >
                      <div
                        className="
                        mx-auto
                        flex
                        h-16
                        w-16
                        items-center
                        justify-center
                        rounded-2xl
                        border
                        border-amber-500/20
                        bg-amber-400/10
                        text-4xl
                        text-amber-100
                      "
                      >
                        {gameState.winner === "draw"
                          ? "½"
                          : gameState.winner === "white"
                            ? "♔"
                            : "♚"}
                      </div>

                      <p
                        className="
                        mt-5
                        text-[10px]
                        font-black
                        uppercase
                        tracking-[0.28em]
                        text-amber-400
                      "
                      >
                        Game Over
                      </p>

                      <h2 className="mt-2 text-3xl font-black text-white">
                        {gameState.winner === "draw"
                          ? "Remis"
                          : (gameState.winner === "white" && mySeat === 0) ||
                              (gameState.winner === "black" && mySeat === 1)
                            ? t("You win")
                            : t("You lose")}
                      </h2>

                      <p className="mt-2 capitalize text-sm text-zinc-500">
                        {t(gameState.end_reason ?? "")}
                      </p>

                      <button
                        type="button"
                        disabled={myRematchReady || actionLoading === "rematch"}
                        onClick={requestRematch}
                        className="
                        mt-7
                        w-full
                        rounded-xl
                        bg-amber-400
                        px-5
                        py-3
                        font-black
                        text-zinc-950
                        transition
                        hover:bg-amber-300
                        disabled:cursor-not-allowed
                        disabled:opacity-40
                      "
                      >
                        {myRematchReady ? t("Rematch requested") : t("Rematch")}
                      </button>

                      {myRematchReady && !opponentRematchReady && (
                        <div
                          className="
                            mt-3
                            flex
                            items-center
                            justify-center
                            gap-2
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
                          {t("Waiting for opponent...")}
                        </div>
                      )}

                      {opponentRematchReady && !myRematchReady && (
                        <p
                          className="
                            mt-3
                            text-xs
                            font-semibold
                            text-emerald-300
                          "
                        >
                          {t("Opponent wants a rematch.")}
                        </p>
                      )}

                      <Link
                        to="/chess/classic/multiplayer"
                        className="
                        mt-3
                        block
                        w-full
                        rounded-xl
                        border
                        border-white/10
                        bg-white/5
                        px-5
                        py-3
                        font-semibold
                        text-zinc-300
                        transition
                        hover:bg-white/10
                        hover:text-white
                      "
                      >
                        {t("Back to lobby")}
                      </Link>
                    </div>
                  </div>
                )}
              </div>

              {/* MOBILE INFO */}

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
                <span className="text-sm text-zinc-500">{t("Moves")}</span>

                <span className="text-sm font-bold text-zinc-200">
                  {gameState.moves.length}
                </span>
              </div>
            </div>
          </section>

          {/* =========================================================
            RIGHT SIDEBAR
           ========================================================= */}

          <aside className="min-w-0">
            <div className="space-y-4 xl:sticky xl:top-6">
              {/* GAME CONTROLS */}

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
                    {t("Game and actions")}
                  </p>
                </div>

                <div className="space-y-2">
                  {gameState.status === "playing" && (
                    <button
                      type="button"
                      onClick={() => setShowResignConfirm(true)}
                      className="
                      w-full
                      rounded-xl
                      border
                      border-red-500/20
                      bg-red-500/10
                      px-4
                      py-3
                      text-sm
                      font-bold
                      text-red-300
                      transition
                      hover:border-red-500/30
                      hover:bg-red-500/20
                    "
                    >
                      {t("Resign")}
                    </button>
                  )}

                  <Link
                    to="/chess/classic/multiplayer"
                    className="
                    block
                    w-full
                    rounded-xl
                    border
                    border-white/10
                    bg-white/5
                    px-4
                    py-3
                    text-center
                    text-sm
                    font-semibold
                    text-zinc-400
                    transition
                    hover:bg-white/10
                    hover:text-white
                  "
                  >
                    {t("Leave game")}
                  </Link>
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
                    {gameState.moves.length}
                  </span>
                </div>

                <div
                  className="
                  max-h-[420px]
                  min-h-32
                  overflow-y-auto
                  rounded-2xl
                  border
                  border-white/5
                  bg-black/20
                  p-2
                "
                >
                  {gameState.moves.length === 0 ? (
                    <div className="py-8 text-center">
                      <div className="text-2xl text-zinc-700">♟</div>

                      <p className="mt-2 text-xs text-zinc-600">
                        {t("No moves yet")}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {gameState.moves.map((move, index) => (
                        <div
                          key={`${move}-${index}`}
                          className="
                          flex
                          items-center
                          gap-3
                          rounded-xl
                          px-3
                          py-2
                          transition
                          hover:bg-white/5
                        "
                        >
                          <span
                            className="
                            flex
                            h-6
                            min-w-6
                            items-center
                            justify-center
                            rounded-lg
                            bg-white/5
                            text-[10px]
                            font-bold
                            text-zinc-600
                          "
                          >
                            {index + 1}
                          </span>

                          <span className="font-mono text-sm font-semibold text-zinc-300">
                            {move}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>

              {/* GAME INFO */}

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
                <div className="mb-4">
                  <h2 className="text-sm font-bold text-zinc-100">
                    {t("Game")}
                  </h2>

                  <p className="mt-1 text-xs text-zinc-500">
                    {t("Current game state")}
                  </p>
                </div>

                <div className="space-y-2">
                  <div
                    className="
                    flex
                    items-center
                    justify-between
                    rounded-xl
                    bg-black/20
                    px-3
                    py-2.5
                  "
                  >
                    <span className="text-xs text-zinc-500">{t("Turn")}</span>

                    <span className="text-xs font-bold text-zinc-300">
                      {chess.turn() === "w" ? t("White") : t("Black")}
                    </span>
                  </div>

                  <div
                    className="
                    flex
                    items-center
                    justify-between
                    rounded-xl
                    bg-black/20
                    px-3
                    py-2.5
                  "
                  >
                    <span className="text-xs text-zinc-500">
                      {t("Half-moves")}
                    </span>

                    <span className="text-xs font-bold text-amber-200">
                      {gameState.moves.length}
                    </span>
                  </div>

                  <div
                    className="
                    flex
                    items-center
                    justify-between
                    rounded-xl
                    bg-black/20
                    px-3
                    py-2.5
                  "
                  >
                    <span className="text-xs text-zinc-500">
                      {t("Version")}
                    </span>

                    <span className="text-xs font-bold text-zinc-400">
                      {gameState.version}
                    </span>
                  </div>
                </div>
              </section>
            </div>
          </aside>
        </main>

        {/* =========================================================
          RESIGN MODAL
         ========================================================= */}

        {showResignConfirm && gameState.status === "playing" && (
          <div
            className="
              fixed
              inset-0
              z-50
              flex
              items-center
              justify-center
              bg-black/75
              px-6
              backdrop-blur-sm
            "
          >
            <div
              className="
                w-full
                max-w-sm
                rounded-3xl
                border
                border-white/10
                bg-zinc-900
                p-7
                text-center
                shadow-2xl
                shadow-black/50
              "
            >
              <div
                className="
                  mx-auto
                  flex
                  h-14
                  w-14
                  items-center
                  justify-center
                  rounded-2xl
                  border
                  border-red-500/20
                  bg-red-500/10
                  text-3xl
                "
              >
                ⚑
              </div>

              <h2 className="mt-5 text-2xl font-black text-white">
                {t("Resign game?")}
              </h2>

              <p className="mt-2 text-sm leading-6 text-zinc-500">
                {t("Your opponent wins the game.")}
              </p>

              <div className="mt-7 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setShowResignConfirm(false)}
                  className="
                    rounded-xl
                    border
                    border-white/10
                    bg-white/5
                    px-4
                    py-3
                    font-semibold
                    text-zinc-300
                    transition
                    hover:bg-white/10
                  "
                >
                  {t("Cancel")}
                </button>

                <button
                  type="button"
                  disabled={actionLoading === "resign"}
                  onClick={resignGame}
                  className="
                    rounded-xl
                    bg-red-500
                    px-4
                    py-3
                    font-bold
                    text-white
                    transition
                    hover:bg-red-400
                    disabled:opacity-40
                  "
                >
                  {t("Resign now")}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PlayerBar({
  name,
  color,
  active,
  me = false,
  t,
}: {
  name: string;
  color: "white" | "black";
  active: boolean;
  me?: boolean;
  t: (key: string) => string;
}) {
  return (
    <div
      className={`
        relative
        rounded-2xl
        border
        px-3
        py-3
        transition-all
        duration-200

        ${
          active
            ? `
              border-amber-400/25
              bg-amber-400/[0.07]
              shadow-[0_0_20px_rgba(251,191,36,0.06)]
            `
            : `
              border-white/5
              bg-black/20
            `
        }
      `}
    >
      <div className="flex items-center gap-3">
        <div
          className={`
            flex
            h-11
            w-11
            shrink-0
            items-center
            justify-center
            rounded-xl
            text-2xl
            shadow-inner

            ${
              color === "white"
                ? `
                  bg-[#fff3d5]
                  text-zinc-900
                `
                : `
                  border
                  border-white/10
                  bg-zinc-800
                  text-zinc-100
                `
            }
          `}
        >
          {color === "white" ? "♔" : "♚"}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-bold text-zinc-100">{name}</p>

            {me && (
              <span
                className="
                  rounded-full
                  bg-amber-400/10
                  px-2
                  py-0.5
                  text-[8px]
                  font-black
                  uppercase
                  tracking-widest
                  text-amber-300
                "
              >
                {t("You")}
              </span>
            )}
          </div>

          <p className="mt-0.5 text-[11px] text-zinc-500">
            {color === "white" ? t("White") : t("Black")}
          </p>
        </div>

        {active && (
          <div
            className="
              flex
              shrink-0
              items-center
              gap-1.5
              rounded-full
              bg-amber-400/10
              px-2
              py-1
              text-[9px]
              font-black
              uppercase
              tracking-wider
              text-amber-300
            "
          >
            <span
              className="
                h-1.5
                w-1.5
                animate-pulse
                rounded-full
                bg-amber-400
              "
            />
            {t("Turn")}
          </div>
        )}
      </div>
    </div>
  );
}
