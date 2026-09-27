import ChessPageHeader from "@/components/chess/ChessPageHeader";
import { ui, useUiLanguage } from "@/i18n/ui";
import { useAppLanguage } from "@/i18n/languageStore";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Chess, type Square } from "chess.js";

import Board from "../../../components/chess/singleplayer/Board.tsx";
import PromotionBar from "../../../components/chess/singleplayer/PromotionBar.tsx";
import ChessMatchStatus from "../../../components/chess/singleplayer/ChessMatchStatus.tsx";

import {
  playPieceSelectSound,
  playPieceMoveSound,
  playPieceCaptureSound,
  playRandomSound,
} from "../../../utils/sound.ts";

import { getSquareName, type PieceType } from "../../../utils/chessUtils.ts";

import { useStockfish } from "@/hooks/useStockfish";

import ChessGameReview from "../../../components/chess/singleplayer/ChessGameReview.tsx";
import { ProfileAvatar } from "../../../components/social/ProfileAvatarPicker.tsx";
import { supabase } from "../../../lib/supabase.ts";
import { useAuth } from "../../../context/AuthContext.tsx";

import {
  useStockfishAnalysis,
  type StockfishAnalysisLine,
} from "@/hooks/useStockfishAnalysis";

/* =========================================================
   TYPES
   ========================================================= */

type GameResult = {
  title: string;
  message: string;
  winner: "human" | "stockfish" | "draw";
};

type ChessComputerBoardProps = {
  playerColor: "white" | "black";

  skillLevel: number;

  thinkTime: number;

  randomMoveChance: number;

  onChangeSettings: () => void;
};

type MoveQuality =
  | "Best"
  | "Excellent"
  | "Good"
  | "Inaccuracy"
  | "Mistake"
  | "Blunder";

type MoveFeedback = {
  quality: MoveQuality;

  centipawnLoss: number;

  bestMove: string | null;

  playedMove: string;
};

type SuggestedMove = {
  uci: string;

  san: string;

  evaluation: string;
};

type EngineMove = {
  from: Square;
  to: Square;

  promotion?: "q" | "r" | "b" | "n";
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
  "Available after the game ends": "Nach Spielende verfügbar",
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
  "Enable Chess Coach": "Schach-Coach aktivieren",
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
  Beginner: "Anfänger",
  Easy: "Leicht",
  Normal: "Normal",
  Hard: "Schwer",
  Expert: "Experte",
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
  "White has won!": "Weiß hat gewonnen!",
  "Black has won!": "Schwarz hat gewonnen!",
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
  "Available after the game ends": "Nachm Spui verfügbar",
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
  Difficulty: "Schwierigkeit",
  Beginner: "Anfänger",
  Easy: "Leicht",
  Normal: "Normal",
  Hard: "Schwer",
  Expert: "Experte",
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
  "White has won!": "Weiß hod gwunna!",
  "Black has won!": "Schwarz hod gwunna!",
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
  "Available after the game ends": "게임 종료 후 사용할 수 있습니다",
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
  "Enable Chess Coach": "체스 코치 활성화",
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
  Beginner: "초급",
  Easy: "쉬움",
  Normal: "보통",
  Hard: "어려움",
  Expert: "전문가",
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
  "White has won!": "백이 승리했습니다!",
  "Black has won!": "흑이 승리했습니다!",
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
  "Available after the game ends": "Доступно после окончания партии",
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
  "Enable Chess Coach": "Включить шахматного тренера",
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
  Beginner: "Начальный",
  Easy: "Легко",
  Normal: "Нормально",
  Hard: "Сложно",
  Expert: "Эксперт",
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
  "White has won!": "Белые победили!",
  "Black has won!": "Чёрные победили!",
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



function translateChess(language: Language, key: string): string {
  if (language === "en") return key;
  if (language === "de") return deTranslations[key] ?? ui(key);
  if (language === "bar")
    return bavarianTranslations[key] ?? deTranslations[key] ?? ui(key);
  if (language === "ko") return koreanTranslations[key] ?? ui(key);
  return russianTranslations[key] ?? ui(key);
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
  useUiLanguage();
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
      <span className="hidden lg:inline">{ui(label)}</span>
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
            {ui(option.label)}
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


/* =========================================================
   COACH HELPERS
   ========================================================= */

function analysisScore(line: StockfishAnalysisLine | undefined) {
  if (!line) {
    return 0;
  }

  /*
   * Convert mate into a very large
   * centipawn-like value.
   */
  if (line.mate !== null) {
    if (line.mate > 0) {
      return 100000 - Math.abs(line.mate) * 100;
    }

    return -100000 + Math.abs(line.mate) * 100;
  }

  return line.scoreCp ?? 0;
}

function classifyMove(centipawnLoss: number, isBestMove: boolean): MoveQuality {
  if (isBestMove) {
    return "Best";
  }

  if (centipawnLoss <= 25) {
    return "Excellent";
  }

  if (centipawnLoss <= 60) {
    return "Good";
  }

  if (centipawnLoss <= 120) {
    return "Inaccuracy";
  }

  if (centipawnLoss <= 250) {
    return "Mistake";
  }

  return "Blunder";
}

function formatEvaluation(line: StockfishAnalysisLine) {
  if (line.mate !== null) {
    return line.mate > 0 ? `M${line.mate}` : `-M${Math.abs(line.mate)}`;
  }

  const pawns = (line.scoreCp ?? 0) / 100;

  return pawns >= 0 ? `+${pawns.toFixed(2)}` : pawns.toFixed(2);
}

function uciToSan(fen: string, uci: string) {
  const temporaryGame = new Chess(fen);

  const from = uci.slice(0, 2) as Square;

  const to = uci.slice(2, 4) as Square;

  const promotion =
    uci.length > 4 ? (uci[4] as "q" | "r" | "b" | "n") : undefined;

  try {
    const move = temporaryGame.move({
      from,
      to,
      promotion,
    });

    return move.san;
  } catch {
    return uci;
  }
}

function getRandomLegalMove(game: Chess): EngineMove | null {
  const moves = game.moves({
    verbose: true,
  });

  if (moves.length === 0) {
    return null;
  }

  const randomMove = moves[Math.floor(Math.random() * moves.length)];

  return {
    from: randomMove.from,

    to: randomMove.to,

    promotion: randomMove.promotion
      ? (randomMove.promotion as "q" | "r" | "b" | "n")
      : undefined,
  };
}

type DifficultyLabel = "Beginner" | "Easy" | "Normal" | "Hard" | "Expert";

function getDifficultyLabel(skillLevel: number): DifficultyLabel {
  if (skillLevel <= 3) return "Beginner";
  if (skillLevel <= 7) return "Easy";
  if (skillLevel <= 11) return "Normal";
  if (skillLevel <= 15) return "Hard";
  return "Expert";
}

/* =========================================================
   COMPONENT
   ========================================================= */

export default function ChessComputerBoard({
  playerColor,
  skillLevel,
  thinkTime,
  randomMoveChance,
  onChangeSettings,
}: ChessComputerBoardProps) {
  useUiLanguage();
  const { user, profile } = useAuth();

  const [humanAvatarId, setHumanAvatarId] = useState(
    () => (profile as { avatar_id?: string | null } | null)?.avatar_id ?? "m1",
  );

  const { language, setLanguage } = useAppLanguage();
  const t = (key: string) => translateChess(language, key);
  const difficultyLabel = getDifficultyLabel(skillLevel);

  function changeLanguage(nextLanguage: Language) {
    setLanguage(nextLanguage);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("chess-language", nextLanguage);
    }
  }

  useEffect(() => {
    const contextAvatar =
      (profile as { avatar_id?: string | null } | null)?.avatar_id ?? "m1";

    setHumanAvatarId(contextAvatar);

    if (!user) {
      return;
    }

    let cancelled = false;

    async function loadCurrentAvatar() {
      const { data, error } = await supabase
        .from("profiles")
        .select("avatar_id")
        .eq("id", user?.id)
        .maybeSingle();

      if (error) {
        console.error("Could not load profile avatar:", error);
        return;
      }

      if (
        !cancelled &&
        typeof data?.avatar_id === "string" &&
        data.avatar_id.length > 0
      ) {
        setHumanAvatarId(data.avatar_id);
      }
    }

    void loadCurrentAvatar();

    return () => {
      cancelled = true;
    };
  }, [user?.id, profile]);

  const [game] = useState(() => new Chess());

  /*
   * chess.js mutates the Chess object.
   *
   * position exists mainly to trigger
   * React re-renders after moves.
   */
  const [position, setPosition] = useState(game.fen());

  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);

  const [legalMoves, setLegalMoves] = useState<Square[]>([]);

  const [lastMove, setLastMove] = useState<{
    from: Square;
    to: Square;
  } | null>(null);

  const [, setMoveHistory] = useState<string[]>([]);

  const [historyPreviewPly, setHistoryPreviewPly] = useState<number | null>(
    null,
  );

  const [capturedWhite, setCapturedWhite] = useState<PieceType[]>([]);

  const [capturedBlack, setCapturedBlack] = useState<PieceType[]>([]);

  const [promotionFrom, setPromotionFrom] = useState<Square | null>(null);

  const [promotionSquare, setPromotionSquare] = useState<Square | null>(null);

  const [gameResult, setGameResult] = useState<GameResult | null>(null);

  const [reviewOpen, setReviewOpen] = useState(false);

  const [showResignConfirm, setShowResignConfirm] = useState(false);

  const [coachModeEnabled, setCoachModeEnabled] = useState(false);

  /*
   * ---------------------------------------------------------
   * STOCKFISH OPPONENT
   * ---------------------------------------------------------
   */

  const { ready, thinking, setSkillLevel, getBestMove } = useStockfish();

  /*
   * ---------------------------------------------------------
   * SEPARATE STOCKFISH COACH
   * ---------------------------------------------------------
   *
   * This worker is independent from the engine
   * playing against the human.
   */

  const {
    ready: analysisReady,
    analyzing,
    analyzePosition,
  } = useStockfishAnalysis();

  const [helpVisible, setHelpVisible] = useState(false);

  const [suggestedMoves, setSuggestedMoves] = useState<SuggestedMove[]>([]);

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

  const [moveFeedback, setMoveFeedback] = useState<MoveFeedback | null>(null);

  /*
   * Protect against late Stockfish
   * game responses after resignation.
   */
  const gameEndedRef = useRef(false);

  /*
   * Protect against old Coach analysis
   * returning after restart / another move.
   */
  const coachGenerationRef = useRef(0);

  const humanColor = playerColor === "white" ? "w" : "b";

  const computerColor = humanColor === "w" ? "b" : "w";

  function toggleCoachMode() {
    if (coachModeEnabled) {
      coachGenerationRef.current += 1;
      setMoveFeedback(null);
      setHelpVisible(false);
      setSuggestedMoves([]);
      setHighlightedSuggestionUci(null);
    }

    setCoachModeEnabled((enabled) => !enabled);
  }

  function playSound(sound: string) {
    const audio = new Audio(`/sounds/${sound}.mp3`);
    audio.play().catch(() => {});
  }

  const board = game.board();

  /*
   * Authoritative history for anything the user sees.
   *
   * `game` is a mutable chess.js object, while `position` is updated
   * after every move/undo/restart and therefore acts as the React
   * revision key. This prevents the visible move history from lagging
   * one state update behind the actual board.
   */
  const currentMoveHistory = useMemo(() => game.history(), [game, position]);

  /* =========================================================
     CLICKABLE MOVE HISTORY PREVIEW
     ========================================================= */

  const historyRows = useMemo(() => {
    const replay = new Chess();

    return currentMoveHistory.map((san, index) => {
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
  }, [currentMoveHistory]);

  const historyPreview =
    historyPreviewPly !== null
      ? (historyRows[historyPreviewPly - 1] ?? null)
      : null;

  useEffect(() => {
    setMoveHistory((previous) => {
      if (
        previous.length === currentMoveHistory.length &&
        previous.every((move, index) => move === currentMoveHistory[index])
      ) {
        return previous;
      }

      return currentMoveHistory;
    });

    if (
      historyPreviewPly !== null &&
      historyPreviewPly > currentMoveHistory.length
    ) {
      setHistoryPreviewPly(null);
    }
  }, [currentMoveHistory, historyPreviewPly]);

  const historyPreviewChess = useMemo(
    () => (historyPreview ? new Chess(historyPreview.fenAfter) : null),
    [historyPreview?.fenAfter],
  );

  const displayedBoard = historyPreviewChess
    ? historyPreviewChess.board()
    : board;

  const historyPreviewMove = historyPreview
    ? {
        from: historyPreview.from,
        to: historyPreview.to,
      }
    : null;

  const checkCounters = useMemo(() => {
    const replay = new Chess();
    let whiteChecks = 0;
    let blackChecks = 0;

    for (const san of currentMoveHistory) {
      replay.move(san);

      if (replay.isCheck()) {
        if (replay.turn() === "w") whiteChecks += 1;
        else blackChecks += 1;
      }
    }

    return { whiteChecks, blackChecks };
  }, [currentMoveHistory]);

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

  /* =========================================================
     MATERIAL
     ========================================================= */

  const whiteMaterial = capturedBlack.reduce(
    (total, piece) => total + (pieceValues[piece] ?? 0),
    0,
  );

  const blackMaterial = capturedWhite.reduce(
    (total, piece) => total + (pieceValues[piece] ?? 0),
    0,
  );

  const materialDifference = whiteMaterial - blackMaterial;

  /* =========================================================
     CHECKED KING
     ========================================================= */

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

  /* =========================================================
     STOCKFISH DIFFICULTY
     ========================================================= */

  useEffect(() => {
    if (!ready) {
      return;
    }

    setSkillLevel(skillLevel);
  }, [ready, skillLevel, setSkillLevel]);

  /* =========================================================
     COACH - GRADE HUMAN MOVE
     ========================================================= */

  async function gradeHumanMove(
    beforeFen: string,
    afterFen: string,
    playedUci: string,
    playedSan: string,
  ) {
    if (!coachModeEnabled || !analysisReady) {
      return;
    }

    /*
     * Every move gets a generation number.
     *
     * If another game starts before
     * analysis finishes, discard it.
     */
    const generation = ++coachGenerationRef.current;

    const before = await analyzePosition(beforeFen, {
      multiPV: 1,
      moveTime: 500,
    });

    if (generation !== coachGenerationRef.current || before.length === 0) {
      return;
    }

    const bestLine = before[0];

    const bestMove = bestLine.pv[0] ?? null;

    const bestScore = analysisScore(bestLine);

    /*
     * afterFen has the opponent to move.
     *
     * Stockfish evaluates from the
     * current side-to-move perspective,
     * so negate the result to get the
     * human player's perspective.
     */
    const after = await analyzePosition(afterFen, {
      multiPV: 1,
      moveTime: 500,
    });

    if (generation !== coachGenerationRef.current || after.length === 0) {
      return;
    }

    const scoreAfterMove = -analysisScore(after[0]);

    const centipawnLoss = Math.max(0, bestScore - scoreAfterMove);

    const isBestMove = bestMove === playedUci;

    setMoveFeedback({
      quality: classifyMove(centipawnLoss, isBestMove),

      centipawnLoss,

      bestMove,

      playedMove: playedSan,
    });
  }

  /* =========================================================
     COACH - HELP / BEST MOVES
     ========================================================= */

  async function toggleHelp() {
    /*
     * Second click hides help.
     */
    if (helpVisible) {
      setHelpVisible(false);
      setHighlightedSuggestionUci(null);

      return;
    }

    if (
      !coachModeEnabled ||
      !analysisReady ||
      analyzing ||
      thinking ||
      gameResult ||
      game.turn() !== humanColor
    ) {
      return;
    }

    const fen = game.fen();

    setHelpVisible(true);
    setSuggestedMoves([]);
    setHighlightedSuggestionUci(null);

    /*
     * Analyze fresh position.
     */
    const lines = await analyzePosition(fen, {
      multiPV: 3,
      moveTime: 700,
    });

    /*
     * User may have moved while
     * Stockfish was calculating.
     */
    if (game.fen() !== fen || game.turn() !== humanColor) {
      setHelpVisible(false);

      return;
    }

    const suggestions = lines
      .slice(0, 3)
      .filter((line) => line.pv.length > 0)
      .map((line) => {
        const uci = line.pv[0];

        return {
          uci,

          san: uciToSan(fen, uci),

          evaluation: formatEvaluation(line),
        };
      });

    setSuggestedMoves(suggestions);

    /*
     * Automatically show the #1 suggestion on the board.
     * The user can click #2 / #3 in the Coach panel to switch it.
     */
    setHighlightedSuggestionUci(suggestions[0]?.uci ?? null);
  }

  /* =========================================================
     COMPUTER MOVE
     ========================================================= */

  const makeComputerMove = useCallback(async () => {
    if (gameEndedRef.current) {
      return;
    }

    if (!ready) {
      return;
    }

    if (game.isGameOver()) {
      return;
    }

    if (game.turn() !== computerColor) {
      return;
    }

    let computerMove: EngineMove | null = null;

    /*
     * BEGINNER / EASY:
     *
     * Occasionally make a completely
     * legal but deliberately weak move.
     */
    const shouldPlayWeakMove =
      randomMoveChance > 0 && Math.random() < randomMoveChance;

    if (shouldPlayWeakMove) {
      computerMove = getRandomLegalMove(game);
    } else {
      const stockfishMove = await getBestMove(game.fen(), thinkTime);

      if (gameEndedRef.current) {
        return;
      }

      if (!stockfishMove) {
        return;
      }

      computerMove = {
        from: stockfishMove.from as Square,

        to: stockfishMove.to as Square,

        promotion:
          (stockfishMove.promotion as "q" | "r" | "b" | "n" | undefined) ?? "q",
      };
    }

    if (!computerMove) {
      return;
    }

    try {
      const move = game.move({
        from: computerMove.from,

        to: computerMove.to,

        promotion: computerMove.promotion,
      });

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

      if (!game.isCheckmate() && game.isCheck()) {
        playSound("check");
      } else if (move.isKingsideCastle() || move.isQueensideCastle()) {
        playRandomSound(["castle-1", "castle-2"]);
      }

      setMoveHistory(game.history());

      /*
       * New human position =
       * previous hints are obsolete.
       */
      setHelpVisible(false);

      setSuggestedMoves([]);

      setHighlightedSuggestionUci(null);

      setPosition(game.fen());
    } catch (error) {
      console.error("Invalid Stockfish move:", computerMove, error);
    }
  }, [ready, game, computerColor, getBestMove, thinkTime, randomMoveChance]);

  /* =========================================================
     GAME OVER
     ========================================================= */

  useEffect(() => {
    if (gameResult) {
      return;
    }

    if (!game.isGameOver()) {
      return;
    }

    if (game.isCheckmate()) {
      const humanLost = game.turn() === humanColor;

      finishGame({
        title: "Checkmate",

        message: humanLost ? "Stockfish wins." : "You defeated Stockfish.",

        winner: humanLost ? "stockfish" : "human",
      });

      return;
    }

    if (game.isStalemate()) {
      finishGame({
        title: "Draw",

        message: "The game ended in stalemate.",

        winner: "draw",
      });

      return;
    }

    if (game.isThreefoldRepetition()) {
      finishGame({
        title: "Draw",

        message: "Threefold repetition.",

        winner: "draw",
      });

      return;
    }

    if (game.isInsufficientMaterial()) {
      finishGame({
        title: "Draw",

        message: "Insufficient material.",

        winner: "draw",
      });

      return;
    }

    if (game.isDrawByFiftyMoves()) {
      finishGame({
        title: "Draw",

        message: "50-move rule.",

        winner: "draw",
      });

      return;
    }

    if (game.isDraw()) {
      finishGame({
        title: "Draw",

        message: "The game ended in a draw.",

        winner: "draw",
      });
    }
  }, [position, game, gameResult, humanColor]);

  /* =========================================================
     AUTOMATIC STOCKFISH TURN
     ========================================================= */

  useEffect(() => {
    if (!ready || thinking) {
      return;
    }

    if (!game.isGameOver() && game.turn() === computerColor) {
      void makeComputerMove();
    }
  }, [ready, thinking, position, game, computerColor, makeComputerMove]);

  /* =========================================================
     RESIGN
     ========================================================= */

  function resignGame() {
    finishGame({
      title: "You resigned",

      message: "Stockfish wins by resignation.",

      winner: "stockfish",
    });
  }

  /* =========================================================
     HUMAN BOARD CLICK
     ========================================================= */

  function handleSquareClick(row: number, column: number) {
    if (historyPreviewPly !== null) {
      return;
    }

    if (!ready || thinking) {
      return;
    }

    /*
     * If user explicitly requested Help,
     * let the short analysis finish first.
     */
    if (analyzing && helpVisible) {
      return;
    }

    if (gameEndedRef.current) {
      return;
    }

    if (promotionFrom && promotionSquare) {
      return;
    }

    if (game.isGameOver()) {
      return;
    }

    if (game.turn() !== humanColor) {
      return;
    }

    /*
     * The Coach overlay uses selectedSquare/legalMoves only as a visual preview.
     * Once the player clicks the board, return to normal board interaction
     * and continue processing this same click.
     */
    if (helpVisible) {
      setHelpVisible(false);
      setSuggestedMoves([]);
      setHighlightedSuggestionUci(null);
    }

    const square = getSquareName(row, column);

    const clickedPiece = game.get(square);

    /*
     * Select first piece.
     */
    if (selectedSquare === null) {
      if (!clickedPiece) {
        return;
      }

      if (clickedPiece.color !== humanColor) {
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

    /*
     * Clicking another own piece
     * changes selection.
     */
    if (clickedPiece && clickedPiece.color === humanColor) {
      setSelectedSquare(square);

      playPieceSelectSound(clickedPiece.type);

      const moves = game.moves({
        square,
        verbose: true,
      });

      setLegalMoves(moves.map((move) => move.to));

      return;
    }

    const selectedPiece = game.get(selectedSquare);

    /*
     * Promotion.
     */
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

    try {
      const beforeFen = game.fen();

      const move = game.move({
        from: selectedSquare,

        to: square,
      });

      const afterFen = game.fen();

      const playedUci = `${move.from}${move.to}${move.promotion ?? ""}`;

      /*
       * Analyze asynchronously.
       *
       * Computer uses a DIFFERENT
       * Stockfish worker.
       */
      void gradeHumanMove(beforeFen, afterFen, playedUci, move.san);

      /*
       * Existing hint belongs to
       * previous position.
       */
      setHelpVisible(false);

      setSuggestedMoves([]);

      setHighlightedSuggestionUci(null);

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

      if (!game.isCheckmate() && game.isCheck()) {
        playSound("check");
      } else if (move.isKingsideCastle() || move.isQueensideCastle()) {
        playRandomSound(["castle-1", "castle-2"]);
      }

      setMoveHistory(game.history());

      setSelectedSquare(null);

      setLegalMoves([]);

      setPosition(game.fen());
    } catch {
      setSelectedSquare(null);

      setLegalMoves([]);
    }
  }

  /* =========================================================
     FINISH GAME
     ========================================================= */

  function finishGame(result: GameResult) {
    gameEndedRef.current = true;

    if (result.winner === "draw") {
      playSound("draw");
    } else {
      playSound("checkmate");
    }

    /*
     * Invalidate pending Coach
     * analysis.
     */
    coachGenerationRef.current += 1;

    setGameResult(result);

    setSelectedSquare(null);

    setLegalMoves([]);

    setPromotionFrom(null);

    setPromotionSquare(null);

    setHelpVisible(false);

    setSuggestedMoves([]);

    setHighlightedSuggestionUci(null);

    setShowResignConfirm(false);
  }

  /* =========================================================
     PROMOTION
     ========================================================= */

  function promotePawn(piece: "q" | "r" | "b" | "n") {
    if (!promotionFrom || !promotionSquare) {
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

      void gradeHumanMove(beforeFen, afterFen, playedUci, move.san);

      setHelpVisible(false);

      setSuggestedMoves([]);

      setHighlightedSuggestionUci(null);

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

      if (!game.isCheckmate() && game.isCheck()) {
        playSound("check");
      } else if (move.isKingsideCastle() || move.isQueensideCastle()) {
        playRandomSound(["castle-1", "castle-2"]);
      }

      setMoveHistory(game.history());

      setPromotionFrom(null);

      setPromotionSquare(null);

      setSelectedSquare(null);

      setLegalMoves([]);

      setPosition(game.fen());
    } catch (error) {
      console.error("Promotion failed:", error);

      setPromotionFrom(null);

      setPromotionSquare(null);
    }
  }

  /* =========================================================
     RESTART
     ========================================================= */

  function restartGame() {
    setReviewOpen(false);
    setHistoryPreviewPly(null);
    gameEndedRef.current = false;

    /*
     * Cancel relevance of old Coach
     * calculations.
     */
    coachGenerationRef.current += 1;

    game.reset();

    setGameResult(null);

    setShowResignConfirm(false);

    setSelectedSquare(null);

    setLegalMoves([]);

    setLastMove(null);

    setPromotionFrom(null);

    setPromotionSquare(null);

    setCapturedWhite([]);

    setCapturedBlack([]);

    setMoveHistory([]);

    setHelpVisible(false);

    setSuggestedMoves([]);

    setHighlightedSuggestionUci(null);

    setMoveFeedback(null);

    setPosition(game.fen());
  }

  function synchronizeGameState() {
    const sans = game.history();

    const replay = new Chess();

    const newCapturedWhite: PieceType[] = [];

    const newCapturedBlack: PieceType[] = [];

    let newLastMove: {
      from: Square;
      to: Square;
    } | null = null;

    for (const san of sans) {
      const move = replay.move(san);

      if (move.captured) {
        if (move.color === "w") {
          newCapturedBlack.push(move.captured as PieceType);
        } else {
          newCapturedWhite.push(move.captured as PieceType);
        }
      }

      newLastMove = {
        from: move.from,
        to: move.to,
      };
    }

    setCapturedWhite(newCapturedWhite);

    setCapturedBlack(newCapturedBlack);

    setLastMove(newLastMove);

    setMoveHistory(sans);

    setPosition(game.fen());
  }
  const hasHumanMove = currentMoveHistory.length > (humanColor === "b" ? 1 : 0);

  function undoLastTurn() {
    if (thinking || analyzing || !hasHumanMove) {
      return;
    }

    setHistoryPreviewPly(null);
    gameEndedRef.current = false;

    coachGenerationRef.current += 1;

    setGameResult(null);

    /*
     * Normally it is now the human's
     * turn, meaning the engine has just
     * replied.
     *
     * Remove engine move + previous
     * human move.
     */
    if (game.turn() === humanColor) {
      game.undo();
      game.undo();
    } else {
      /*
       * Human move itself ended the
       * game before Stockfish replied.
       */
      game.undo();
    }

    setSelectedSquare(null);

    setLegalMoves([]);

    setPromotionFrom(null);

    setPromotionSquare(null);

    setHelpVisible(false);

    setSuggestedMoves([]);

    setHighlightedSuggestionUci(null);

    setMoveFeedback(null);

    synchronizeGameState();
  }

  const latestMoveSan = currentMoveHistory[currentMoveHistory.length - 1] ?? "";

  const latestMoverColor: "w" | "b" | null =
    currentMoveHistory.length === 0
      ? null
      : currentMoveHistory.length % 2 === 1
        ? "w"
        : "b";

  const latestMoverLabel =
    latestMoverColor === null
      ? null
      : latestMoverColor === humanColor
        ? t("You")
        : "Stockfish";

  const singleplayerMatchStatus = (() => {
    if (historyPreview) {
      return {
        event: "info" as const,
        message: `${t("History Preview")} · ${historyPreview.san}`,
        detail: `${t("Move")} ${historyPreview.moveNumber}${
          historyPreview.color === "w" ? "." : "..."
        }`,
      };
    }

    if (gameResult) {
      const winnerColor =
        gameResult.winner === "draw"
          ? null
          : gameResult.winner === "human"
            ? humanColor
            : humanColor === "w"
              ? "b"
              : "w";

      return {
        event:
          gameResult.winner === "draw"
            ? ("draw" as const)
            : ("checkmate" as const),
        message:
          winnerColor === null
            ? t("Draw")
            : winnerColor === "w"
              ? t("White has won!")
              : t("Black has won!"),
        detail: t(gameResult.message),
      };
    }

    if (game.isCheck()) {
      const humanInCheck = game.turn() === humanColor;

      return {
        event: "check" as const,
        message: humanInCheck
          ? t("You are in check")
          : t("Stockfish is in check"),
        detail: humanInCheck ? t("Your turn") : t("Stockfish's turn"),
      };
    }

    if (latestMoverLabel && /^O-O-O/.test(latestMoveSan)) {
      return {
        event: "castle" as const,
        message: `${latestMoverLabel} castled queenside`,
        detail: latestMoveSan,
      };
    }

    if (latestMoverLabel && /^O-O/.test(latestMoveSan)) {
      return {
        event: "castle" as const,
        message: `${latestMoverLabel} castled kingside`,
        detail: latestMoveSan,
      };
    }

    if (latestMoverLabel && latestMoveSan.includes("=")) {
      return {
        event: "promotion" as const,
        message: `${latestMoverLabel} promoted a pawn`,
        detail: latestMoveSan,
      };
    }

    if (latestMoverLabel && latestMoveSan.includes("x")) {
      return {
        event: "capture" as const,
        message: `${latestMoverLabel} captured a piece`,
        detail: latestMoveSan,
      };
    }

    return {
      event: "turn" as const,
      message:
        game.turn() === humanColor ? t("Your turn") : t("Stockfish's turn"),
      detail: `${currentMoveHistory.length} ${t("moves")}`,
    };
  })();

  const singleplayerPlayerOrder: Array<"w" | "b"> =
    playerColor === "white" ? ["b", "w"] : ["w", "b"];

  return (
    <div className="relative left-1/2 classic-game-page min-h-[var(--app-height)] w-screen -translate-x-1/2 overflow-x-hidden bg-[#05080d] bg-[radial-gradient(circle_at_50%_-10%,rgba(245,158,11,0.12),transparent_30%),radial-gradient(circle_at_12%_38%,rgba(14,165,233,0.08),transparent_28%),linear-gradient(180deg,#03070b_0%,#07111b_48%,#020509_100%)] px-3 py-3 sm:px-5 lg:px-6">
      <ChessPageHeader className="mb-4" />
      <div className="mb-2 flex shrink-0 justify-end">
        <ChessLanguageSelector
          language={language}
          onChange={changeLanguage}
          label={t("Language")}
        />
      </div>

      <main
        className="
          grid
          gap-4
          chess-game-grid classic-game-grid xl:grid-cols-[minmax(260px,19vw)_minmax(0,1fr)_minmax(260px,19vw)]
        "
      >
        {/* =====================================================
            LEFT SIDEBAR
           ===================================================== */}

        <aside className="order-3 min-w-0 xl:order-1 xl:pr-1">
          <div className="flex h-full min-h-0 flex-col gap-3">
            {/* =================================================
                CHESS COACH TOGGLE
               ================================================= */}

            <button
              type="button"
              onClick={toggleCoachMode}
              aria-pressed={coachModeEnabled}
              className={`group flex w-full items-center justify-between gap-4 rounded-3xl border p-4 text-left shadow-xl shadow-black/20 backdrop-blur-md transition ${
                coachModeEnabled
                  ? "border-amber-400/30 bg-[linear-gradient(145deg,rgba(40,31,13,.65),rgba(8,15,23,.96))] shadow-[0_0_26px_rgba(251,191,36,.06)] hover:bg-amber-400/[0.10]"
                  : "border-amber-400/12 bg-[linear-gradient(145deg,rgba(10,18,28,.97),rgba(5,10,17,.94))] hover:border-amber-400/25"
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl transition ${
                    coachModeEnabled
                      ? "bg-amber-400/15 text-amber-200"
                      : "bg-white/5 text-zinc-500 group-hover:text-amber-300"
                  }`}
                >
                  ♞
                </div>

                <div>
                  <p className="font-serif text-lg font-semibold text-[#f6ead1]">
                    {t("Chess Coach")}
                  </p>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    {coachModeEnabled ? t("Live analysis enabled") : t("Enable Chess Coach")}
                  </p>
                </div>
              </div>

              <div
                className={`relative h-6 w-11 shrink-0 rounded-full border transition ${
                  coachModeEnabled
                    ? "border-amber-400/30 bg-amber-400/20"
                    : "border-white/10 bg-black/30"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-4 w-4 rounded-full transition-all ${
                    coachModeEnabled
                      ? "left-[22px] bg-amber-300"
                      : "left-1 bg-zinc-500"
                  }`}
                />
              </div>
            </button>

            {coachModeEnabled && (
              <section className="rounded-3xl border border-amber-400/15 bg-[linear-gradient(145deg,rgba(10,18,28,.97),rgba(5,10,17,.94))] p-4 shadow-2xl shadow-black/35 backdrop-blur-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-serif text-xl font-semibold text-[#f6ead1]">
                      {t("Chess Coach")}
                    </h2>

                    <p className="mt-1 text-xs text-zinc-500">
                      {t("Optional Stockfish analysis")}
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

                {/* LAST MOVE RATING */}

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
                      {t("Your last move")}
                    </p>

                    <div className="mt-2 flex items-center justify-between gap-3">
                      <span className="font-mono text-lg font-bold text-white">
                        {moveFeedback.playedMove}
                      </span>

                      <MoveQualityBadge quality={moveFeedback.quality} />
                    </div>

                    {moveFeedback.quality !== "Best" && (
                      <p className="mt-2 text-xs text-zinc-500">
                        {t("Evaluation loss")}:{" "}
                        {(moveFeedback.centipawnLoss / 100).toFixed(2)}{" "}
                        {t("pawns")}
                      </p>
                    )}

                    {moveFeedback.bestMove &&
                      moveFeedback.quality !== "Best" && (
                        <p className="mt-1 text-[11px] text-zinc-600">
                          {t("Engine preferred")}:{" "}
                          <span className="font-mono text-zinc-400">
                            {uciToSan(
                              /*
                               * We do not retain the
                               * exact old FEN here,
                               * therefore show the UCI
                               * fallback safely.
                               */
                              game.fen(),
                              moveFeedback.bestMove,
                            )}
                          </span>
                        </p>
                      )}
                  </div>
                )}

                {/* HELP BUTTON */}

                <button
                  type="button"
                  disabled={
                    !analysisReady ||
                    analyzing ||
                    thinking ||
                    gameResult !== null ||
                    game.turn() !== humanColor
                  }
                  onClick={toggleHelp}
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
                  {analyzing ? t("Analyzing...") : helpVisible ? t("Hide Help") : t("Help · Best Moves")}
                </button>

                {/* BEST MOVES */}

                {helpVisible && (
                  <div className="mt-3 space-y-2">
                    {suggestedMoves.length === 0 ? (
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
                        {analyzing ? t("Stockfish is analyzing...") : t("No analysis available.")}
                      </div>
                    ) : (
                      suggestedMoves.map((suggestion, index) => {
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
                                    hover:border-white/10
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
                                      ? "bg-amber-300 text-zinc-950"
                                      : "bg-amber-400/10 text-amber-300"
                                  }
                                `}
                              >
                                {index + 1}
                              </span>

                              <div>
                                <p
                                  className={`font-mono text-sm font-bold ${
                                    selected
                                      ? "text-amber-200"
                                      : "text-zinc-200"
                                  }`}
                                >
                                  {suggestion.san}
                                </p>

                                <p className="text-[10px] text-zinc-600">
                                  {suggestion.uci}
                                </p>
                              </div>
                            </div>

                            <div className="text-right">
                              <span className="block text-xs font-semibold text-zinc-400">
                                {suggestion.evaluation}
                              </span>

                              <span
                                className={`mt-0.5 block text-[9px] font-bold ${
                                  selected ? "text-amber-300" : "text-zinc-700"
                                }`}
                              >
                                {selected ? t("Shown on board") : t("Click to show")}
                              </span>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </section>
            )}

            {/* CAPTURED PIECES */}

            <section className="order-1 rounded-3xl border border-amber-400/15 bg-[linear-gradient(145deg,rgba(10,18,28,.97),rgba(5,10,17,.94))] p-4 shadow-2xl shadow-black/35 backdrop-blur-xl">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-serif text-lg font-semibold text-[#f6ead1]">
                    {t("Captured Pieces")}
                  </h2>
                  <p className="mt-0.5 text-[10px] uppercase tracking-[0.18em] text-zinc-600">
                    {t("Material overview")}
                  </p>
                </div>

                <span className="rounded-xl border border-amber-300/10 bg-amber-300/[0.05] px-2.5 py-1 text-xs font-bold text-amber-100/80">
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
                <CapturedPiecesGrid
                  capturedBlack={capturedBlack}
                  capturedWhite={capturedWhite}
                  t={t}
                />
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-black/20 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wider text-zinc-600">
                    {t("White in check")}
                  </p>
                  <p className="mt-1 font-bold text-zinc-300">
                    {checkCounters.whiteChecks}
                  </p>
                </div>

                <div className="rounded-xl bg-black/20 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wider text-zinc-600">
                    {t("Black in check")}
                  </p>
                  <p className="mt-1 font-bold text-zinc-300">
                    {checkCounters.blackChecks}
                  </p>
                </div>
              </div>
            </section>
            {/* MOVE HISTORY */}
            <section className="order-3 flex min-h-[140px] flex-1 flex-col overflow-hidden rounded-3xl border border-amber-400/15 bg-[#091019]/90 shadow-2xl shadow-black/30 backdrop-blur-xl">
              <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
                <div>
                  <h2 className="font-serif text-lg font-semibold text-[#f6ead1]">
                    {t("Move History")}
                  </h2>
                  <p className="mt-0.5 text-[10px] uppercase tracking-[0.2em] text-zinc-600">
                    {t("Game history")}
                  </p>
                </div>
                <span className="rounded-lg border border-white/5 bg-white/5 px-2.5 py-1 text-xs font-bold text-zinc-400">
                  {currentMoveHistory.length}
                </span>
              </div>
              <div className="max-h-64 min-h-0 flex-1 overflow-y-auto [scrollbar-width:thin] xl:max-h-none">
                {historyRows.length === 0 ? (
                  <div className="px-4 py-8 text-center text-xs text-zinc-600">
                    {t("No moves yet")}
                  </div>
                ) : (
                  <div className="divide-y divide-white/5">
                    {historyRows.map((move) => {
                      const selected = historyPreviewPly === move.ply;
                      return (
                        <button
                          key={move.ply}
                          type="button"
                          onClick={() => {
                            setHistoryPreviewPly(move.ply);
                            setHelpVisible(false);
                            setSuggestedMoves([]);
                            setHighlightedSuggestionUci(null);
                            setSelectedSquare(null);
                            setLegalMoves([]);
                            setPromotionFrom(null);
                            setPromotionSquare(null);
                          }}
                          className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-white/[0.04] ${selected ? "bg-blue-400/10" : ""}`}
                        >
                          <span className="w-8 text-[10px] font-black text-zinc-600">
                            {move.moveNumber}
                            {move.color === "w" ? "." : "..."}
                          </span>
                          <span className="text-lg leading-none">
                            {getHistoryPieceSymbol(move.color, move.piece)}
                          </span>
                          <span className="font-mono text-xs font-bold text-zinc-200">
                            {move.san}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>
          </div>
        </aside>

        {/* =====================================================
            CENTER
           ===================================================== */}

        <section className="order-1 min-w-0 xl:order-2">
          <div className="mx-auto w-full max-w-[820px] xl:flex xl:max-w-none xl:flex-col">
            <section className="mb-2 shrink-0 rounded-2xl border border-amber-400/30 bg-[#08111c]/90 px-4 py-2.5 text-center shadow-[0_0_40px_rgba(245,158,11,0.08)] backdrop-blur-xl">
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-amber-400">
                {t("Classic Chess")}
              </p>
              <h1 className="mt-0.5 font-serif text-2xl font-semibold text-[#f7ead0]">{ui("Singleplayer")}</h1>
              <p className="mt-1 text-xs text-zinc-400">{t("Difficulty")}: {t(difficultyLabel)}</p>
            </section>

            {/* HISTORY PREVIEW STATUS */}

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

            {/* PROMOTION */}

            {promotionFrom && promotionSquare && !historyPreview && (
              <div className="mb-3">
                <PromotionBar onPromote={promotePawn} />
              </div>
            )}

            <ChessMatchStatus
              event={singleplayerMatchStatus.event}
              message={singleplayerMatchStatus.message}
              detail={singleplayerMatchStatus.detail}
              label={ui("Match status")}
              className="mb-2"
              actions={
                gameResult && !historyPreview ? (
                  <>
                    <button
                      type="button"
                      disabled={currentMoveHistory.length === 0}
                      onClick={() => setReviewOpen(true)}
                      className="rounded-lg border border-amber-300/25 bg-amber-300/[0.10] px-3 py-2 text-[10px] font-black text-amber-100 transition hover:bg-amber-300/[0.16] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {t("Open Game Review")}
                    </button>

                    <button
                      type="button"
                      onClick={restartGame}
                      className="rounded-lg border border-emerald-300/20 bg-emerald-300/[0.08] px-3 py-2 text-[10px] font-black text-emerald-100 transition hover:bg-emerald-300/[0.14]"
                    >
                      {t("Rematch")}
                    </button>

                    <button
                      type="button"
                      onClick={onChangeSettings}
                      className="rounded-lg border border-white/10 bg-white/[0.045] px-3 py-2 text-[10px] font-black text-zinc-300 transition hover:bg-white/[0.08] hover:text-white"
                    >
                      {t("Back to lobby")}
                    </button>
                  </>
                ) : undefined
              }
            />

            {/* BOARD */}

            <div className="relative shrink-0">
              <Board
                board={displayedBoard}
                selectedSquare={
                  historyPreview
                    ? null
                    : helpMove
                      ? helpMove.from
                      : selectedSquare
                }
                legalMoves={
                  historyPreview ? [] : helpMove ? [helpMove.to] : legalMoves
                }
                lastMove={historyPreviewMove ?? lastMove}
                checkedKingSquare={
                  historyPreview
                    ? historyPreviewCheckedKingSquare
                    : checkedKingSquare
                }
                onSquareClick={historyPreview ? () => {} : handleSquareClick}
                orientation={playerColor}
              />
            </div>
          </div>
        </section>

        {/* =====================================================
            RIGHT SIDEBAR
           ===================================================== */}

        <aside className="order-2 min-w-0 xl:order-3 xl:h-full xl:min-h-0 xl:overflow-y-auto xl:pl-1 [scrollbar-width:thin]">
          <div className="space-y-3">
            {/* PLAYERS — ordered to match the visible board */}
            <div className="shrink-0 space-y-2">
              {singleplayerPlayerOrder.map((color, index) => {
                const isHuman = color === humanColor;
                const active = game.turn() === color && !gameResult;

                return (
                  <div key={color} className="space-y-2">
                    <section
                      className={`rounded-3xl border p-3.5 shadow-2xl shadow-black/30 backdrop-blur-xl transition ${
                        active
                          ? "border-amber-400/30 bg-[linear-gradient(145deg,rgba(39,30,13,.52),rgba(7,14,22,.95))] shadow-[0_0_26px_rgba(251,191,36,.07)]"
                          : "border-white/10 bg-[linear-gradient(145deg,rgba(10,18,28,.96),rgba(5,10,17,.94))]"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {isHuman ? (
                          <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full border border-amber-300/25 bg-black/30 ring-4 ring-amber-400/5">
                            <ProfileAvatar
                              avatarId={humanAvatarId}
                              className="h-full w-full"
                            />
                          </div>
                        ) : (
                          <div
                            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-sky-300/20 bg-sky-300/[0.07] text-xl ring-4 ring-sky-400/5"
                            aria-label={ui("Stockfish")}
                          >
                            🤖
                          </div>
                        )}

                        <div className="min-w-0 flex-1">
                          <p className="truncate font-serif text-lg font-semibold text-[#f7ead0]">
                            {isHuman ? t("You") : ui("Stockfish")}
                          </p>
                          <p className="mt-0.5 text-xs text-zinc-500">
                            {color === "w" ? t("White") : t("Black")}
                          </p>
                        </div>

                        {active && (
                          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-amber-400 shadow-[0_0_14px_rgba(251,191,36,.65)]" />
                        )}
                      </div>
                    </section>

                    {index === 0 && (
                      <div className="flex items-center gap-2 px-2">
                        <span className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-white/20" />
                        <span className="rounded-full border border-amber-400/15 bg-amber-400/[0.06] px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.2em] text-amber-200/75">{ui("VS")}</span>
                        <span className="h-px flex-1 bg-gradient-to-l from-transparent via-white/10 to-white/20" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* =================================================
                GAME CONTROLS
               ================================================= */}

            <section className="rounded-3xl border border-amber-400/15 bg-[linear-gradient(145deg,rgba(10,18,28,.97),rgba(5,10,17,.94))] p-4 shadow-2xl shadow-black/35 backdrop-blur-xl">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-300/15 bg-amber-300/[0.07] text-lg text-amber-200">
                  ⚙
                </div>
                <h2 className="font-serif text-xl font-semibold text-[#f6ead1]">
                  {t("Game Controls")}
                </h2>
              </div>

              <p className="mt-1 text-xs text-zinc-500">
                {t("Stockfish game settings")}
              </p>

              <div className="mt-5 space-y-3">
                <div
                  className="
                    flex
                    items-center
                    justify-between
                    rounded-xl
                    bg-black/20
                    px-3
                    py-3
                  "
                >
                  <span className="text-sm text-zinc-500">
                    {t("Difficulty")}
                  </span>

                  <span className="text-sm font-semibold text-white">
                    {t(difficultyLabel)}
                  </span>
                </div>

                <div
                  className="
                    rounded-xl
                    bg-black/20
                    px-3
                    py-3
                  "
                >
                  <div className="flex items-center justify-between text-[10px] text-zinc-600">
                    <span>{t("Weak-move chance")}</span>

                    <span>{Math.round(randomMoveChance * 100)}%</span>
                  </div>
                </div>

                <div
                  className="
                    flex
                    items-center
                    justify-between
                    rounded-xl
                    bg-black/20
                    px-3
                    py-3
                  "
                >
                  <span className="text-sm text-zinc-500">{t("Side")}</span>

                  <span className="text-sm font-semibold text-white">
                    {playerColor === "white" ? t("White") : t("Black")}
                  </span>
                </div>
                <button
                  type="button"
                  disabled={thinking || analyzing || !hasHumanMove}
                  onClick={undoLastTurn}
                  className="
    w-full
    rounded-xl
    border
    border-amber-400/20
    bg-amber-400/10
    px-4
    py-3
    text-sm
    font-semibold
    text-amber-300
    transition
    hover:bg-amber-400/20
    disabled:opacity-40
  "
                >
                  ↶ {t("Undo Move")}
                </button>

                <button
                  type="button"
                  disabled={thinking}
                  onClick={restartGame}
                  className="
                    w-full
                    rounded-xl
                    bg-white/10
                    px-4
                    py-3
                    text-sm
                    font-semibold
                    text-white
                    transition
                    hover:bg-white/20
                    disabled:cursor-not-allowed
                    disabled:opacity-40
                  "
                >
                  {t("New Game")}
                </button>

                {gameResult === null && (
                  <button
                    type="button"
                    disabled={true}
                    onClick={() => setReviewOpen(true)}
                    className="
                    flex
                    w-full
                    items-center
                    justify-center
                    gap-2
                    rounded-xl
                    border
                    border-amber-400/20
                    bg-amber-400/10
                    px-4
                    py-3
                    text-sm
                    font-bold
                    text-amber-300
                    transition
                    hover:bg-amber-400/20
                    disabled:cursor-not-allowed
                    disabled:border-white/5
                    disabled:bg-white/[0.03]
                    disabled:text-zinc-600
                    disabled:hover:bg-white/[0.03]
                  "
                  >
                    <span>♞</span>
                    <span>{t("Open Game Review")}</span>
                  </button>
                )}

                {gameResult === null && (
                  <p className="text-center text-[10px] text-zinc-600">
                    {t("Available after the game ends")}
                  </p>
                )}

                <button
                  type="button"
                  disabled={thinking || gameResult !== null}
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
                    font-semibold
                    text-red-300
                    transition
                    hover:bg-red-500/20
                    disabled:opacity-40
                  "
                >
                  {t("Resign")}
                </button>
              </div>
            </section>

            {/* =================================================
                PIECE VALUES
               ================================================= */}

            {/* RESIGN MODAL */}

            {showResignConfirm && !gameResult && (
              <div
                className="
                    fixed
                    inset-0
                    z-50
                    flex
                    items-center
                    justify-center
                    bg-black/70
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
                    "
                >
                  <div className="text-4xl">⚑</div>

                  <h2 className="mt-4 text-2xl font-black text-white">
                    {t("Resign")}{ui("game?")}</h2>

                  <p className="mt-2 text-sm text-zinc-400">
                    {t("Stockfish will win the game.")}
                  </p>

                  <div className="mt-7 grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setShowResignConfirm(false)}
                      className="
                          rounded-xl
                          bg-white/10
                          px-4
                          py-3
                          font-semibold
                          text-white
                          hover:bg-white/20
                        "
                    >
                      {t("Cancel")}
                    </button>

                    <button
                      type="button"
                      onClick={resignGame}
                      className="
                          rounded-xl
                          bg-red-500
                          px-4
                          py-3
                          font-bold
                          text-white
                          hover:bg-red-400
                        "
                    >
                      {t("Resign")}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </aside>
      </main>
      <ChessGameReview
        moves={currentMoveHistory}
        orientation={playerColor}
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        puzzleSource={gameResult ? "singleplayer" : undefined}
        puzzlePlayerColor={gameResult ? playerColor : undefined}
      />
    </div>
  );
}

/* =========================================================
   HISTORY PIECE SYMBOL
   ========================================================= */

function CapturedPiecesGrid({
  capturedBlack,
  capturedWhite,
  t,
}: {
  capturedBlack: PieceType[];
  capturedWhite: PieceType[];
  t: (key: string) => string;
}) {
  useUiLanguage();
  const symbols: Record<"white" | "black", Record<PieceType, string>> = {
    white: {
      p: "♙",
      n: "♘",
      b: "♗",
      r: "♖",
      q: "♕",
      k: "♔",
    },
    black: {
      p: "♟",
      n: "♞",
      b: "♝",
      r: "♜",
      q: "♛",
      k: "♚",
    },
  };

  function CapturedRow({
    color,
    pieces,
  }: {
    color: "white" | "black";
    pieces: PieceType[];
  }) {
    return (
      <div className="grid grid-cols-[52px_minmax(0,1fr)] items-start gap-2">
        <div className="pt-2 text-[10px] font-black uppercase tracking-wider text-zinc-600">
          {color === "white" ? t("White") : t("Black")}
        </div>

        <div
          className="
            flex
            min-h-10
            flex-wrap
            content-start
            gap-1.5
            rounded-xl
            border
            border-white/5
            bg-black/20
            p-1.5
          "
        >
          {pieces.length === 0 ? (
            <span className="px-1 py-1 text-xs text-zinc-700">—</span>
          ) : (
            pieces.map((piece, index) => (
              <span
                key={`${color}-${piece}-${index}`}
                className="
                  flex
                  h-7
                  w-7
                  shrink-0
                  items-center
                  justify-center
                  rounded-lg
                  border
                  border-white/5
                  bg-white/[0.04]
                  text-[20px]
                  leading-none
                "
              >
                {symbols[color][piece]}
              </span>
            ))
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[96px] space-y-2">
      <CapturedRow color="black" pieces={capturedBlack} />
      <CapturedRow color="white" pieces={capturedWhite} />
    </div>
  );
}

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

/* =========================================================
   MOVE QUALITY BADGE
   ========================================================= */

function MoveQualityBadge({ quality }: { quality: MoveQuality }) {
  useUiLanguage();
  const styles: Record<MoveQuality, string> = {
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
        rounded-full
        border
        px-2.5
        py-1
        text-[10px]
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
