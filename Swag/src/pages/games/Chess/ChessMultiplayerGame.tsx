import { ui, useUiLanguage } from "@/i18n/ui";
import { useAppLanguage } from "@/i18n/languageStore";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Link, useParams } from "react-router-dom";

import { Chess, type Square } from "chess.js";

import Board from "../../../components/chess/singleplayer/Board.tsx";
import PromotionBar from "../../../components/chess/singleplayer/PromotionBar.tsx";
import ChessGameReview from "../../../components/chess/singleplayer/ChessGameReview.tsx";
import ChessMatchStatus from "../../../components/chess/singleplayer/ChessMatchStatus.tsx";
import { ProfileAvatar } from "../../../components/social/ProfileAvatarPicker.tsx";

import { type PieceType } from "../../../utils/chessUtils.ts";
import {
  playPieceSelectSound,
  playPieceMoveSound,
  playPieceCaptureSound,
  playRandomSound,
} from "../../../utils/sound.ts";

import { supabase } from "../../../lib/supabase.ts";
import { useAuth } from "../../../context/AuthContext.tsx";

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
  chosen_color: "white" | "black" | null;
};

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

  undo_requested_by: string | null;
  undo_requested_version: number | null;

  /*
   * Persistent anti-spam marker:
   * once this user requested Undo for this exact game version,
   * the same move cannot be requested again after Decline.
   */
  undo_last_requested_by: string | null;
  undo_last_requested_version: number | null;
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
  "Undo request sent": "Rücknahme angefragt",
  "Waiting for opponent response...": "Warte auf Antwort des Gegners...",
  "Opponent requests to undo the last move.":
    "Der Gegner möchte den letzten Zug zurücknehmen.",
  "Accept Undo": "Rücknahme akzeptieren",
  Decline: "Ablehnen",
  "Only the player who made the last move can request undo.":
    "Nur der Spieler, der den letzten Zug gemacht hat, kann eine Rücknahme anfragen.",
  "You already requested undo for this move.":
    "Für diesen Zug hast du bereits eine Rücknahme angefragt.",
  "Choose Side": "Seite wählen",
  "Side selection locks after the first move.":
    "Die Seitenwahl wird nach dem ersten Zug gesperrt.",
  Chosen: "Gewählt",
  Current: "Aktuell",
  "A side already chosen by your opponent is locked.":
    "Eine vom Gegner bereits gewählte Seite ist gesperrt.",
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
  "Undo request sent": "Zrucknehma angfragt",
  "Waiting for opponent response...": "Wart auf de Antwort vom Gegner...",
  "Opponent requests to undo the last move.":
    "Da Gegner mecht den letzten Zug zrucknehma.",
  "Accept Undo": "Zrucknehma erlaubn",
  Decline: "Ablehna",
  "Only the player who made the last move can request undo.":
    "Bloß da Spieler vom letzten Zug ko a Zrucknehma anfragn.",
  "You already requested undo for this move.":
    "Für den Zug host scho a Zrucknehma angfragt.",
  "Choose Side": "Seitn aussuacha",
  "Side selection locks after the first move.":
    "Nachm ersten Zug is d Seitnwahl gspeichert.",
  Chosen: "G'wählt",
  Current: "Aktuell",
  "A side already chosen by your opponent is locked.":
    "A Seitn, de da Gegner scho g'wählt hod, is g'sperrt.",
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
  "Undo request sent": "되돌리기 요청 전송됨",
  "Waiting for opponent response...": "상대의 응답을 기다리는 중...",
  "Opponent requests to undo the last move.":
    "상대가 마지막 수를 되돌리기를 요청했습니다.",
  "Accept Undo": "되돌리기 수락",
  Decline: "거절",
  "Only the player who made the last move can request undo.":
    "마지막 수를 둔 플레이어만 되돌리기를 요청할 수 있습니다.",
  "You already requested undo for this move.":
    "이 수에 대해서는 이미 되돌리기를 요청했습니다.",
  "Choose Side": "진영 선택",
  "Side selection locks after the first move.":
    "첫 수가 두어진 뒤에는 진영을 바꿀 수 없습니다.",
  Chosen: "선택",
  Current: "현재",
  "A side already chosen by your opponent is locked.":
    "상대가 이미 선택한 진영은 선택할 수 없습니다.",
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
  "Undo request sent": "Запрос отмены отправлен",
  "Waiting for opponent response...": "Ожидание ответа соперника...",
  "Opponent requests to undo the last move.":
    "Соперник просит отменить последний ход.",
  "Accept Undo": "Принять отмену",
  Decline: "Отклонить",
  "Only the player who made the last move can request undo.":
    "Запросить отмену может только игрок, сделавший последний ход.",
  "You already requested undo for this move.":
    "Вы уже запрашивали отмену этого хода.",
  "Choose Side": "Выбрать сторону",
  "Side selection locks after the first move.":
    "Выбор стороны блокируется после первого хода.",
  Chosen: "Выбрано",
  Current: "Сейчас",
  "A side already chosen by your opponent is locked.":
    "Сторона, уже выбранная соперником, недоступна.",
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

const pieceValues: Record<string, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0,
};


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
  useUiLanguage();
  const { roomCode } = useParams();

  const { user, profile } = useAuth();

  const { language, setLanguage } = useAppLanguage();
  const t = (key: string) => translateChess(language, key);

  function changeLanguage(nextLanguage: Language) {
    setLanguage(nextLanguage);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("chess-language", nextLanguage);
    }
  }

  const [room, setRoom] = useState<ChessRoom | null>(null);

  const [players, setPlayers] = useState<RoomPlayer[]>([]);

  const [playerAvatarIds, setPlayerAvatarIds] = useState<
    Record<string, string>
  >({});

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

  const [reviewOpen, setReviewOpen] = useState(false);

  /*
   * Keep an independent copy of the completed game's moves.
   * This prevents a late Realtime packet from making post-game review
   * disappear for one side.
   */
  const [completedGameMoves, setCompletedGameMoves] = useState<string[]>([]);

  const [historyPreviewPly, setHistoryPreviewPly] = useState<number | null>(
    null,
  );

  const [savedGames, setSavedGames] = useState<SavedGame[]>([]);
  const [saveName, setSaveName] = useState("");
  const [savingGame, setSavingGame] = useState(false);
  const [savedGamesOpen, setSavedGamesOpen] = useState(false);

  const [actionLoading, setActionLoading] = useState<
    "resign" | "rematch" | "undo-request" | "undo-response" | "side" | null
  >(null);

  const playerUserIdsKey = useMemo(
    () =>
      [...new Set(players.map((player) => player.user_id))].sort().join(","),
    [players],
  );

  useEffect(() => {
    const userIds = playerUserIdsKey
      ? playerUserIdsKey.split(",").filter(Boolean)
      : [];

    if (userIds.length === 0) {
      setPlayerAvatarIds({});
      return;
    }

    let cancelled = false;

    async function loadPlayerAvatars() {
      const { data, error: avatarError } = await supabase
        .from("profiles")
        .select("id, avatar_id")
        .in("id", userIds);

      if (avatarError) {
        console.error("Could not load player avatars:", avatarError);

        /*
         * The local player's avatar can still be shown from AuthContext
         * if the project's profile RLS does not expose other profiles.
         */
        const ownAvatar =
          (profile as { avatar_id?: string | null } | null)?.avatar_id ?? "m1";

        if (!cancelled && user?.id) {
          setPlayerAvatarIds((current) => ({
            ...current,
            [user.id]: ownAvatar,
          }));
        }

        return;
      }

      const next: Record<string, string> = {};

      for (const row of data ?? []) {
        if (
          typeof row.id === "string" &&
          typeof row.avatar_id === "string" &&
          row.avatar_id.length > 0
        ) {
          next[row.id] = row.avatar_id;
        }
      }

      /*
       * Keep the authenticated user's context value as a fallback.
       */
      if (user?.id && !next[user.id]) {
        next[user.id] =
          (profile as { avatar_id?: string | null } | null)?.avatar_id ?? "m1";
      }

      if (!cancelled) {
        setPlayerAvatarIds(next);
      }
    }

    void loadPlayerAvatars();

    return () => {
      cancelled = true;
    };
  }, [playerUserIdsKey, user?.id, profile]);

  useEffect(() => {
    if (user) {
      void loadSavedGames();
    } else {
      setSavedGames([]);
    }
  }, [user?.id]);

  async function loadSavedGames() {
    if (!user) return;

    const { data, error: savedError } = await supabase
      .from("games")
      .select(
        "id, created_at, name, white_player, black_player, fen, moves, white_check_counter, black_check_counter, user_id",
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (savedError) {
      console.error("Error loading saved games:", savedError);
      return;
    }

    setSavedGames((data ?? []) as SavedGame[]);
  }

  async function saveCurrentGame() {
    if (!user || !room || !gameState || savingGame) return;

    setSavingGame(true);

    const whitePlayer =
      players.find((player) => player.chosen_color === "white") ??
      players.find((player) => player.seat === 0);
    const blackPlayer =
      players.find((player) => player.chosen_color === "black") ??
      players.find((player) => player.seat === 1);

    const { error: saveError } = await supabase.from("games").insert({
      user_id: user.id,
      name: saveName.trim() || `Multiplayer ${room.code}`,
      white_player: whitePlayer?.display_name ?? "White",
      black_player: blackPlayer?.display_name ?? "Black",
      fen: gameState.fen,
      moves: gameState.moves,
      white_check_counter: materialState.whiteChecks,
      black_check_counter: materialState.blackChecks,
    });

    setSavingGame(false);

    if (saveError) {
      console.error("Error saving multiplayer game:", saveError);
      setError(saveError.message);
      return;
    }

    setSaveName("");
    await loadSavedGames();
  }

  async function deleteSavedGame(id: string) {
    if (!user) return;

    const { error: deleteError } = await supabase
      .from("games")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (deleteError) {
      console.error("Error deleting saved game:", deleteError);
      return;
    }

    setSavedGames((games) => games.filter((game) => game.id !== id));
  }

  // Multiplayer deliberately has NO live Stockfish/Coach hook.
  // Engine analysis is only mounted after the game through ChessGameReview.
  const lastSeenMoveCountRef = useRef(0);

  /*
   * Deduplicate game-end sounds by the finished game itself, not by row
   * version or delivery order. Polling and Realtime may observe the same
   * checkmate in either order, but the signature below stays identical.
   */
  const lastGameEndSoundKeyRef = useRef<string | null>(null);

  function playSound(sound: string) {
    const audio = new Audio(`/sounds/${sound}.mp3`);
    audio.play().catch(() => {});
  }

  function getGameEndSoundKey(game: MultiplayerGame): string | null {
    if (game.status !== "finished") {
      return null;
    }

    const lastMove = game.moves[game.moves.length - 1] ?? "no-move";

    return [
      game.moves.length,
      lastMove,
      game.winner ?? "no-winner",
      game.end_reason ?? "no-reason",
    ].join("|");
  }

  function maybePlayGameEndSound(game: MultiplayerGame) {
    /*
     * A genuine rematch/new game resets the deduplication key.
     */
    if (game.status === "playing" && game.moves.length === 0) {
      lastGameEndSoundKeyRef.current = null;
      return;
    }

    const soundKey = getGameEndSoundKey(game);

    if (!soundKey || lastGameEndSoundKeyRef.current === soundKey) {
      return;
    }

    lastGameEndSoundKeyRef.current = soundKey;
    playSound(game.winner === "draw" ? "draw" : "checkmate");
  }
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
      return;
    }

    await refreshChessGameState();
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

  async function refreshChessGameState() {
    if (!room) {
      return;
    }

    const { data, error: refreshError } = await supabase
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
          black_rematch_ready,
          undo_requested_by,
          undo_requested_version,
          undo_last_requested_by,
          undo_last_requested_version
        `,
      )
      .eq("room_id", room.id)
      .single();

    if (refreshError || !data) {
      console.error("Could not refresh chess game:", refreshError);
      return;
    }

    const refreshedGame = data as MultiplayerGame;

    setGameState((current) => {
      if (
        current &&
        current.version === refreshedGame.version &&
        current.fen === refreshedGame.fen &&
        current.status === refreshedGame.status &&
        current.winner === refreshedGame.winner &&
        current.end_reason === refreshedGame.end_reason &&
        current.undo_requested_by === refreshedGame.undo_requested_by &&
        current.undo_requested_version ===
          refreshedGame.undo_requested_version &&
        current.undo_last_requested_by ===
          refreshedGame.undo_last_requested_by &&
        current.undo_last_requested_version ===
          refreshedGame.undo_last_requested_version &&
        current.white_rematch_ready === refreshedGame.white_rematch_ready &&
        current.black_rematch_ready === refreshedGame.black_rematch_ready &&
        current.moves.length === refreshedGame.moves.length &&
        current.moves.every(
          (move, index) => move === refreshedGame.moves[index],
        )
      ) {
        return current;
      }

      return refreshedGame;
    });

    maybePlayGameEndSound(refreshedGame);
    lastSeenMoveCountRef.current = (refreshedGame.moves ?? []).length;

    if (
      refreshedGame.moves.length > 0 &&
      (refreshedGame.status === "finished" ||
        refreshedGame.winner !== null ||
        refreshedGame.end_reason !== null)
    ) {
      setCompletedGameMoves(refreshedGame.moves);
    }
  }

  async function refreshRoomPlayers() {
    if (!room || !user) {
      return;
    }

    const { data, error: playerRefreshError } = await supabase
      .from("chess_room_players")
      .select(
        `
          room_id,
          user_id,
          seat,
          display_name,
          chosen_color
        `,
      )
      .eq("room_id", room.id)
      .order("seat", {
        ascending: true,
      });

    if (playerRefreshError || !data) {
      console.error("Could not refresh chess players:", playerRefreshError);
      return;
    }

    const refreshedPlayers = data as RoomPlayer[];

    setPlayers(refreshedPlayers);

    const me = refreshedPlayers.find((player) => player.user_id === user.id);

    if (me) {
      setMySeat(me.seat);
    }
  }

  async function chooseSide(color: "white" | "black") {
    if (
      !room ||
      !gameState ||
      gameState.moves.length !== 0 ||
      gameState.status !== "playing" ||
      actionLoading
    ) {
      return;
    }

    setActionLoading("side");
    setError(null);

    const { error: sideError } = await supabase.rpc("choose_chess_side", {
      p_room_id: room.id,
      p_color: color,
    });

    if (sideError) {
      console.error("choose_chess_side failed:", sideError);
      setError(sideError.message);
    }

    await refreshRoomPlayers();
    setSelectedSquare(null);
    setLegalMoves([]);
    setPromotionFrom(null);
    setPromotionSquare(null);
    setActionLoading(null);
  }

  function buildUndoSnapshot(moves: string[]) {
    if (moves.length === 0) {
      return null;
    }

    const replay = new Chess();
    let previousLastFrom: Square | null = null;
    let previousLastTo: Square | null = null;

    for (let index = 0; index < moves.length - 1; index += 1) {
      const replayedMove = replay.move(moves[index]);
      previousLastFrom = replayedMove.from;
      previousLastTo = replayedMove.to;
    }

    return {
      previousFen: replay.fen(),
      previousLastFrom,
      previousLastTo,
    };
  }

  async function requestUndo() {
    if (
      !room ||
      !gameState ||
      gameState.status !== "playing" ||
      gameState.moves.length === 0 ||
      gameState.undo_requested_by ||
      actionLoading
    ) {
      return;
    }

    /*
     * One SAN entry equals one ply:
     *   odd number of plies  -> White made the latest move (seat 0)
     *   even number of plies -> Black made the latest move (seat 1)
     */
    const requestLastMoverSeat = gameState.moves.length % 2 === 1 ? 0 : 1;

    if (mySeat !== requestLastMoverSeat) {
      setError(t("Only the player who made the last move can request undo."));
      return;
    }

    const alreadyRequestedThisMove =
      Boolean(user?.id) &&
      gameState.undo_last_requested_by === user?.id &&
      gameState.undo_last_requested_version === gameState.version;

    if (alreadyRequestedThisMove) {
      setError(t("You already requested undo for this move."));
      return;
    }

    const snapshot = buildUndoSnapshot(gameState.moves);

    if (!snapshot) {
      return;
    }

    setActionLoading("undo-request");
    setError(null);

    const { error: undoError } = await supabase.rpc("request_chess_undo", {
      p_room_id: room.id,
      p_previous_fen: snapshot.previousFen,
      p_previous_last_from: snapshot.previousLastFrom,
      p_previous_last_to: snapshot.previousLastTo,
    });

    if (undoError) {
      console.error(undoError);
      setError(undoError.message);
    } else if (user?.id) {
      setGameState((current) =>
        current
          ? {
              ...current,
              undo_requested_by: user.id,
              undo_last_requested_by: user.id,
              undo_last_requested_version: current.version,
            }
          : current,
      );
    }

    /*
     * Do not depend only on Realtime for an undo request.
     * Fetch the authoritative row immediately so both clients see
     * the pending state consistently even if a Realtime event is late.
     */
    await refreshChessGameState();
    setActionLoading(null);
  }

  async function respondToUndo(accept: boolean) {
    if (
      !room ||
      !gameState ||
      gameState.status !== "playing" ||
      !gameState.undo_requested_by ||
      actionLoading
    ) {
      return;
    }

    setActionLoading("undo-response");
    setError(null);

    const { error: undoError } = await supabase.rpc("respond_chess_undo", {
      p_room_id: room.id,
      p_accept: accept,
    });

    if (undoError) {
      console.error(undoError);
      setError(undoError.message);
    } else {
      setGameState((current) =>
        current
          ? {
              ...current,
              undo_requested_by: null,
              undo_requested_version: null,
            }
          : current,
      );

      if (accept) {
        /*
         * If the last move disappears, any historical preview based on
         * the old move list must be closed.
         */
        setHistoryPreviewPly(null);
        setSelectedSquare(null);
        setLegalMoves([]);
        setPromotionFrom(null);
        setPromotionSquare(null);
      }
    }

    await refreshChessGameState();
    setActionLoading(null);
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

  /* =========================================================
     CLICKABLE MOVE HISTORY PREVIEW
     ========================================================= */

  const historyRows = useMemo(() => {
    const replay = new Chess();
    const rows: Array<{
      ply: number;
      moveNumber: number;
      color: "w" | "b";
      san: string;
      from: Square;
      to: Square;
      piece: string;
      fenAfter: string;
    }> = [];

    for (const [index, san] of (gameState?.moves ?? []).entries()) {
      try {
        const move = replay.move(san);

        rows.push({
          ply: index + 1,
          moveNumber: Math.floor(index / 2) + 1,
          color: move.color,
          san: move.san,
          from: move.from,
          to: move.to,
          piece: move.piece,
          fenAfter: replay.fen(),
        });
      } catch {
        break;
      }
    }

    return rows;
  }, [gameState?.moves]);

  const materialState = useMemo(() => {
    const replay = new Chess();
    const capturedWhite: PieceType[] = [];
    const capturedBlack: PieceType[] = [];
    let whiteChecks = 0;
    let blackChecks = 0;

    for (const san of gameState?.moves ?? []) {
      const move = replay.move(san);

      if (move.captured) {
        if (move.color === "w") capturedBlack.push(move.captured as PieceType);
        else capturedWhite.push(move.captured as PieceType);
      }

      if (replay.isCheck()) {
        if (replay.turn() === "w") whiteChecks += 1;
        else blackChecks += 1;
      }
    }

    const whiteMaterial = capturedBlack.reduce(
      (total, piece) => total + pieceValues[piece],
      0,
    );
    const blackMaterial = capturedWhite.reduce(
      (total, piece) => total + pieceValues[piece],
      0,
    );

    return {
      capturedWhite,
      capturedBlack,
      whiteChecks,
      blackChecks,
      materialDifference: whiteMaterial - blackMaterial,
    };
  }, [gameState?.moves]);

  function playMoveFeedbackSound(moves: string[]) {
    if (moves.length === 0) return;

    try {
      const replay = new Chess();
      let last = null as ReturnType<Chess["move"]> | null;

      for (const san of moves) {
        last = replay.move(san);
      }

      if (!last) return;

      if (last.captured) playPieceCaptureSound(last.piece);
      else playPieceMoveSound(last.piece);

      if (!replay.isCheckmate() && replay.isCheck()) {
        playSound("check");
      } else if (last.isKingsideCastle() || last.isQueensideCastle()) {
        playRandomSound(["castle-1", "castle-2"]);
      }
    } catch {
      // Sound must never block multiplayer state updates.
    }
  }

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
          const files = "abcdefgh";

          for (let row = 0; row < previewBoard.length; row++) {
            for (let column = 0; column < previewBoard[row].length; column++) {
              const piece = previewBoard[row][column];

              if (piece?.type === "k" && piece.color === kingColor) {
                return `${files[column]}${8 - row}` as Square;
              }
            }
          }

          return null;
        })()
      : null;

  useEffect(() => {
    if (historyPreviewPly !== null && historyPreviewPly > historyRows.length) {
      setHistoryPreviewPly(null);
    }
  }, [historyPreviewPly, historyRows.length]);

  const myColor: "w" | "b" | null =
    mySeat === 0 ? "w" : mySeat === 1 ? "b" : null;

  const orientation: "white" | "black" = mySeat === 1 ? "black" : "white";

  const gameEndedForReview =
    gameState !== null &&
    gameState.moves.length > 0 &&
    (gameState.status === "finished" ||
      gameState.winner !== null ||
      gameState.end_reason !== null ||
      chess.isGameOver());

  const reviewMoves =
    completedGameMoves.length > 0
      ? completedGameMoves
      : (gameState?.moves ?? []);

  const gameReviewAvailable =
    reviewMoves.length > 0 &&
    (completedGameMoves.length > 0 || gameEndedForReview);

  useEffect(() => {
    if (!gameState) {
      return;
    }

    if (gameEndedForReview) {
      setCompletedGameMoves(gameState.moves);
      return;
    }

    if (gameState.status === "playing" && gameState.moves.length === 0) {
      setCompletedGameMoves([]);
      setReviewOpen(false);
    }
  }, [
    gameState?.status,
    gameState?.winner,
    gameState?.end_reason,
    gameState?.moves,
    gameEndedForReview,
  ]);

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
            display_name,
            chosen_color
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
  black_rematch_ready,
  undo_requested_by,
  undo_requested_version,
  undo_last_requested_by,
  undo_last_requested_version
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

    const loadedGame = gameData as MultiplayerGame;

    setGameState(loadedGame);
    lastSeenMoveCountRef.current = (loadedGame.moves ?? []).length;

    /*
     * If the page is opened/reloaded after the game already finished,
     * remember that result without replaying the end sound.
     */
    lastGameEndSoundKeyRef.current = getGameEndSoundKey(loadedGame);

    setLoading(false);
  }, [roomCode, user]);

  useEffect(() => {
    void loadGame();
  }, [loadGame]);

  /*
   * ----------------------------------
   * AUTHORITATIVE SYNC FALLBACK
   * ----------------------------------
   *
   * Realtime remains the fast path, but an UPDATE event can occasionally be
   * missed or delayed. Polling the single chess_games row once per second
   * guarantees that an undo request reaches the opponent's screen.
   */
  useEffect(() => {
    if (!room) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void refreshChessGameState();
      void refreshRoomPlayers();
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [room?.id]);

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
          const nextMoveCount = updated.moves?.length ?? 0;

          if (nextMoveCount > lastSeenMoveCountRef.current) {
            playMoveFeedbackSound(updated.moves);
          }

          maybePlayGameEndSound(updated);
          lastSeenMoveCountRef.current = nextMoveCount;

          if (
            nextMoveCount > 0 &&
            (updated.status === "finished" ||
              updated.winner !== null ||
              updated.end_reason !== null)
          ) {
            setCompletedGameMoves(updated.moves);
          } else if (updated.status === "playing" && nextMoveCount === 0) {
            setCompletedGameMoves([]);
            setReviewOpen(false);
          }

          setGameState(updated);

          /*
           * Clear selection after
           * either player moves.
           */
          setSelectedSquare(null);

          setLegalMoves([]);

          setPromotionFrom(null);

          setPromotionSquare(null);

          setHistoryPreviewPly(null);
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
    if (!room || !gameState || moving || gameState.undo_requested_by) {
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
      const fullMoveError = {
        code: moveError.code,
        message: moveError.message,
        details: moveError.details,
        hint: moveError.hint,
      };

      console.error(
        "play_chess_move failed:",
        JSON.stringify(fullMoveError, null, 2),
      );

      setError(
        [moveError.code, moveError.message, moveError.details, moveError.hint]
          .filter(Boolean)
          .join(" · "),
      );

      await loadGame();

      return;
    }

    const submittedMoves = [...gameState.moves, move.san];

    /*
     * IMPORTANT:
     *
     * Do NOT append the move locally with setGameState here.
     *
     * The Supabase UPDATE can reach the Realtime subscription before this
     * RPC promise resolves. If we then append the same SAN move locally,
     * the player who made the move can end up with the move twice:
     *
     *   server / opponent: [e4]
     *   local mover:       [e4, e4]
     *
     * That breaks last-mover detection (especially visible for White) and
     * also corrupts the move list passed into Game Review.
     *
     * chess_games is therefore the single authoritative source after every
     * successful multiplayer move.
     */
    if (lastSeenMoveCountRef.current < submittedMoves.length) {
      playMoveFeedbackSound(submittedMoves);
      lastSeenMoveCountRef.current = submittedMoves.length;
    }

    /*
     * Preserve the exact completed move list immediately so the Game Review
     * entry point is available even before the follow-up SELECT finishes.
     */
    if (outcome.finished) {
      setCompletedGameMoves(submittedMoves);
    }

    await refreshChessGameState();

    setSelectedSquare(null);

    setLegalMoves([]);

    setPromotionFrom(null);

    setPromotionSquare(null);
  }

  /*
   * ----------------------------------
   * BOARD CLICK
   * ----------------------------------
   */

  function handleSquareClick(row: number, column: number) {
    if (
      historyPreviewPly !== null ||
      !gameState ||
      !myColor ||
      moving ||
      gameState.undo_requested_by
    ) {
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

      playPieceSelectSound(clickedPiece.type);

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

      playPieceSelectSound(clickedPiece.type);

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
      >{ui("Loading multiplayer game...")}</main>
    );
  }

  const white = players.find((player) => player.seat === 0);

  const black = players.find((player) => player.seat === 1);

  const isMyTurn = chess.turn() === myColor;

  const undoRequestedByMe =
    Boolean(user?.id) && gameState.undo_requested_by === user?.id;

  const undoRequestedByOpponent =
    Boolean(gameState.undo_requested_by) &&
    gameState.undo_requested_by !== user?.id;

  const myPlayer = players.find((player) => player.user_id === user?.id);

  const opponentPlayer = players.find((player) => player.user_id !== user?.id);

  const whiteClaimedByOpponent = opponentPlayer?.chosen_color === "white";

  const blackClaimedByOpponent = opponentPlayer?.chosen_color === "black";

  /*
   * Only the player who made the latest move may request a takeback.
   *
   * SAN move-count parity is authoritative here:
   *   odd  -> White moved last (seat 0)
   *   even -> Black moved last (seat 1)
   */
  const lastMoverSeat = gameState.moves.length % 2 === 1 ? 0 : 1;

  const alreadyRequestedUndoForCurrentMove =
    Boolean(user?.id) &&
    gameState.undo_last_requested_by === user?.id &&
    gameState.undo_last_requested_version === gameState.version;

  const canRequestUndo =
    gameState.status === "playing" &&
    gameState.moves.length > 0 &&
    !gameState.undo_requested_by &&
    mySeat === lastMoverSeat &&
    !alreadyRequestedUndoForCurrentMove;

  const myRematchReady =
    mySeat === 0
      ? gameState.white_rematch_ready
      : gameState.black_rematch_ready;

  const opponentRematchReady =
    mySeat === 0
      ? gameState.black_rematch_ready
      : gameState.white_rematch_ready;

  const latestMoveSan = gameState.moves[gameState.moves.length - 1] ?? "";

  const latestMoverColor: "w" | "b" | null =
    gameState.moves.length === 0
      ? null
      : gameState.moves.length % 2 === 1
        ? "w"
        : "b";

  const latestMoverIsMe =
    latestMoverColor !== null && latestMoverColor === myColor;
  const latestMoverName = latestMoverIsMe
    ? t("You")
    : (opponentPlayer?.display_name ?? "Opponent");

  const multiplayerMatchStatus = (() => {
    if (historyPreview) {
      return {
        event: "info" as const,
        message: `${t("History Preview")} · ${historyPreview.san}`,
        detail: `${t("Move")} ${historyPreview.moveNumber}${
          historyPreview.color === "w" ? "." : "..."
        }`,
      };
    }

    if (
      gameState.status === "finished" ||
      gameState.winner !== null ||
      gameState.end_reason !== null
    ) {
      return {
        event:
          gameState.winner === "draw"
            ? ("draw" as const)
            : ("checkmate" as const),
        message:
          gameState.winner === "draw"
            ? t("Draw")
            : gameState.winner === "white"
              ? t("White has won!")
              : t("Black has won!"),
        detail: t(gameState.end_reason ?? ""),
      };
    }

    if (chess.isCheck()) {
      const iAmInCheck = chess.turn() === myColor;

      return {
        event: "check" as const,
        message: iAmInCheck
          ? t("Your king is in check")
          : `${opponentPlayer?.display_name ?? "Opponent"} is in check`,
        detail: iAmInCheck ? t("Your turn") : t("Opponent's turn"),
      };
    }

    if (latestMoverColor && /^O-O-O/.test(latestMoveSan)) {
      return {
        event: "castle" as const,
        message: `${latestMoverName} castled queenside`,
        detail: latestMoveSan,
      };
    }

    if (latestMoverColor && /^O-O/.test(latestMoveSan)) {
      return {
        event: "castle" as const,
        message: `${latestMoverName} castled kingside`,
        detail: latestMoveSan,
      };
    }

    if (latestMoverColor && latestMoveSan.includes("=")) {
      return {
        event: "promotion" as const,
        message: `${latestMoverName} promoted a pawn`,
        detail: latestMoveSan,
      };
    }

    if (latestMoverColor && latestMoveSan.includes("x")) {
      return {
        event: "capture" as const,
        message: `${latestMoverName} captured a piece`,
        detail: latestMoveSan,
      };
    }

    return {
      event: "turn" as const,
      message: isMyTurn ? t("Your turn") : t("Opponent's turn"),
      detail: `${gameState.moves.length} ${t("moves")}`,
    };
  })();

  const multiplayerPlayerOrder: Array<"white" | "black"> =
    orientation === "white" ? ["black", "white"] : ["white", "black"];

  return (
    <div
      className="
      relative
      left-1/2
      classic-game-page min-h-[var(--app-height)]
      w-screen
      -translate-x-1/2
      overflow-x-hidden
      bg-[#05080d]
      bg-[radial-gradient(circle_at_50%_-10%,rgba(245,158,11,0.12),transparent_30%),radial-gradient(circle_at_12%_38%,rgba(37,99,235,0.09),transparent_27%),linear-gradient(180deg,#03070b_0%,#07111b_48%,#020509_100%)]
      px-3
      py-3
      text-zinc-100
      sm:px-5
      lg:px-6
    "
    >
      <div className="relative z-10 h-full w-full max-w-none">
        {/* =========================================================
          HEADER
         ========================================================= */}

        <header
          className="
          mb-2
          flex
          shrink-0
          items-center
          justify-end
          gap-2
        "
        >
          <div className="hidden">
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
          gap-4
          chess-game-grid classic-game-grid xl:grid-cols-[minmax(260px,19vw)_minmax(0,1fr)_minmax(260px,19vw)]
        "
        >
          {/* =========================================================
            LEFT SIDEBAR
           ========================================================= */}

          <aside className="order-3 min-w-0 xl:order-1 xl:pr-1">
            <div className="flex h-full min-h-0 flex-col gap-3">
              {/* CAPTURED PIECES — same baseline as Hotseat */}

              <section
                className="order-1 
                  rounded-3xl
                  border
                  border-amber-400/15
                  bg-[linear-gradient(145deg,rgba(10,18,28,.97),rgba(5,10,17,.94))]
                  p-4
                  shadow-2xl
                  shadow-black/35
                  backdrop-blur-xl
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
                    className={`rounded-xl px-2.5 py-1 text-xs font-bold ${
                      materialState.materialDifference > 0
                        ? "bg-amber-400/10 text-amber-200"
                        : materialState.materialDifference < 0
                          ? "bg-white/10 text-zinc-300"
                          : "bg-white/5 text-zinc-500"
                    }`}
                  >
                    {materialState.materialDifference > 0 &&
                      `${t("White")} +${materialState.materialDifference}`}
                    {materialState.materialDifference < 0 &&
                      `${t("Black")} +${Math.abs(materialState.materialDifference)}`}
                    {materialState.materialDifference === 0 && t("Equal")}
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
                    capturedBlack={materialState.capturedBlack}
                    capturedWhite={materialState.capturedWhite}
                    t={t}
                  />
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-black/20 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wider text-zinc-600">
                      {t("White in check")}
                    </p>
                    <p className="mt-1 font-bold text-zinc-300">
                      {materialState.whiteChecks}
                    </p>
                  </div>

                  <div className="rounded-xl bg-black/20 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wider text-zinc-600">
                      {t("Black in check")}
                    </p>
                    <p className="mt-1 font-bold text-zinc-300">
                      {materialState.blackChecks}
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
                    {gameState.moves.length}
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
                              {getMultiplayerHistoryPieceSymbol(
                                move.color,
                                move.piece,
                              )}
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

              {/* SAVED GAMES */}
              <section className="order-4 overflow-hidden xl:hidden rounded-3xl border border-amber-400/15 bg-[linear-gradient(145deg,rgba(10,18,28,.97),rgba(5,10,17,.94))] shadow-2xl shadow-black/35 backdrop-blur-xl">
                <button
                  type="button"
                  onClick={() => setSavedGamesOpen((open) => !open)}
                  className="flex w-full items-center justify-between gap-3 bg-amber-300/[0.025] px-4 py-3.5 text-left transition hover:bg-amber-300/[0.05]"
                >
                  <div>
                    <h2 className="font-serif text-lg font-semibold text-[#f6ead1]">
                      {t("Saved Games")}
                    </h2>
                    <p className="mt-0.5 text-[10px] uppercase tracking-[0.18em] text-zinc-600">
                      {t("Previous games")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-lg border border-amber-300/10 bg-amber-300/[0.06] px-2 py-1 text-xs font-bold text-amber-200">
                      {savedGames.length}
                    </span>
                    <span className="rounded-lg border border-amber-400/20 bg-amber-400/10 px-3 py-1.5 text-xs font-black text-amber-300">
                      {savedGamesOpen ? ui("Hide") : ui("Show")}
                    </span>
                  </div>
                </button>

                {savedGamesOpen && (
                  <div className="border-t border-white/5">
                    <div className="flex gap-2 p-3 pb-2">
                      <input
                        value={saveName}
                        onChange={(event) => setSaveName(event.target.value)}
                        placeholder={t("Game name")}
                        className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/25 px-3 py-2.5 text-xs text-zinc-100 outline-none transition placeholder:text-zinc-700 focus:border-amber-400/35"
                      />
                      <button
                        type="button"
                        disabled={savingGame || gameState.moves.length === 0}
                        onClick={() => void saveCurrentGame()}
                        className="rounded-xl border border-amber-400/25 bg-amber-400/10 px-3 py-2.5 text-xs font-black text-amber-200 transition hover:bg-amber-400/20 disabled:cursor-not-allowed disabled:opacity-35"
                      >
                        {savingGame ? "…" : t("Save")}
                      </button>
                    </div>
                    <div className="max-h-80 space-y-1 overflow-y-auto p-2 pt-0 [scrollbar-width:thin]">
                      {savedGames.length === 0 ? (
                        <div className="py-5 text-center text-xs text-zinc-600">
                          {t("No saved games yet")}
                        </div>
                      ) : (
                        savedGames.map((savedGame) => (
                          <div
                            key={savedGame.id}
                            className="group flex items-center gap-2 rounded-2xl border border-transparent px-3 py-2.5 transition hover:border-amber-300/10 hover:bg-amber-300/[0.035]"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-bold text-zinc-200">
                                {savedGame.name || t("Unnamed Game")}
                              </p>
                              <p className="mt-1 truncate text-[10px] text-zinc-600">
                                {savedGame.white_player || t("White")}{" "}
                                <span className="px-1 text-zinc-700">{ui("vs")}</span>{" "}
                                {savedGame.black_player || t("Black")}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => void deleteSavedGame(savedGame.id)}
                              className="rounded-lg border border-red-500/10 bg-red-500/[0.04] px-2 py-1.5 text-[10px] font-bold text-red-300/80 opacity-70 transition hover:bg-red-500/10 hover:text-red-200 group-hover:opacity-100"
                              title={t("Delete game")}
                            >
                              ×
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </section>
              {/* ROOM INFORMATION */}

              <section className="hidden">
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

              <section className="hidden">
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

                    <p className="mt-0.5 text-[11px] text-zinc-500">{ui("Supabase Realtime")}</p>
                  </div>
                </div>
              </section>
            </div>
          </aside>

          {/* =========================================================
            CENTER
           ========================================================= */}

          <section className="order-1 min-w-0 xl:order-2">
            <div className="mx-auto w-full max-w-[820px] xl:flex xl:max-w-none xl:flex-col">
              <section className="mb-2 shrink-0 rounded-2xl border border-amber-400/30 bg-[#08111c]/90 px-4 py-2.5 text-center shadow-[0_0_40px_rgba(245,158,11,0.08)] backdrop-blur-xl">
                <p className="text-[10px] font-black uppercase tracking-[0.28em] text-amber-400">
                  {t("Classic Chess")}
                </p>
                <h1 className="mt-1 font-serif text-3xl font-semibold text-[#f7ead0]">
                  {t("Multiplayer")}
                </h1>
                <p className="mt-1 text-xs text-zinc-500">
                  {t("Room")}{" "}
                  <span className="font-black tracking-[0.18em] text-zinc-300">
                    {room.code}
                  </span>
                </p>
              </section>

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
                  {ui(error)}
                </div>
              )}

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

              <ChessMatchStatus
                event={multiplayerMatchStatus.event}
                message={multiplayerMatchStatus.message}
                detail={multiplayerMatchStatus.detail}
                label={ui("Match status")}
                className="mb-2"
                effects={[
                  {
                    id: "room",
                    label: t("Room"),
                    value: room.code,
                    tone: "blue",
                  },
                  ...(myRematchReady && !opponentRematchReady
                    ? [
                        {
                          id: "rematch-waiting",
                          label: t("Waiting for opponent..."),
                          tone: "amber" as const,
                        },
                      ]
                    : opponentRematchReady && !myRematchReady
                      ? [
                          {
                            id: "rematch-offer",
                            label: t("Opponent wants a rematch."),
                            tone: "emerald" as const,
                          },
                        ]
                      : []),
                ]}
                actions={
                  gameReviewAvailable && !historyPreview ? (
                    <>
                      <button
                        type="button"
                        disabled={reviewMoves.length === 0}
                        onClick={() => {
                          setHistoryPreviewPly(null);
                          setReviewOpen(true);
                        }}
                        className="rounded-lg border border-amber-300/25 bg-amber-300/[0.10] px-3 py-2 text-[10px] font-black text-amber-100 transition hover:bg-amber-300/[0.16] disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {t("Open Game Review")}
                      </button>

                      <button
                        type="button"
                        disabled={myRematchReady || actionLoading === "rematch"}
                        onClick={requestRematch}
                        className="rounded-lg border border-emerald-300/20 bg-emerald-300/[0.08] px-3 py-2 text-[10px] font-black text-emerald-100 transition hover:bg-emerald-300/[0.14] disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {myRematchReady ? t("Rematch requested") : t("Rematch")}
                      </button>

                      <Link
                        to="/chess/classic/multiplayer"
                        className="rounded-lg border border-white/10 bg-white/[0.045] px-3 py-2 text-[10px] font-black text-zinc-300 transition hover:bg-white/[0.08] hover:text-white"
                      >
                        {t("Back to lobby")}
                      </Link>
                    </>
                  ) : undefined
                }
              />

              {/* =====================================================
                BOARD
               ===================================================== */}

              <div className="relative shrink-0">
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
                  onSquareClick={historyPreview ? () => {} : handleSquareClick}
                  orientation={orientation}
                />
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

          <aside className="order-2 min-w-0 xl:order-3 xl:h-full xl:min-h-0 xl:overflow-y-auto xl:pl-1 [scrollbar-width:thin]">
            <div className="space-y-3">
              {/* PLAYERS — ordered to match the visible board */}
              <div className="shrink-0 space-y-2">
                {multiplayerPlayerOrder.map((color, index) => {
                  const player = color === "white" ? white : black;
                  const fallbackAvatar = color === "white" ? "m1" : "f1";

                  return (
                    <div key={color} className="space-y-2">
                      <PlayerBar
                        name={
                          player?.display_name ??
                          t(color === "white" ? "White" : "Black")
                        }
                        avatarId={
                          player
                            ? (playerAvatarIds[player.user_id] ??
                              fallbackAvatar)
                            : fallbackAvatar
                        }
                        color={color}
                        active={
                          gameState.status === "playing" &&
                          chess.turn() === (color === "white" ? "w" : "b")
                        }
                        me={player?.user_id === user?.id}
                        t={t}
                      />

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

              {/* GAME CONTROLS */}

              <section className="rounded-3xl border border-amber-400/15 bg-[linear-gradient(145deg,rgba(10,18,28,.97),rgba(5,10,17,.94))] p-4 shadow-2xl shadow-black/35 backdrop-blur-xl">
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

                    <h2 className="font-serif text-xl font-semibold text-[#f6ead1]">
                      {t("Game Controls")}
                    </h2>
                  </div>

                  <p className="mt-1.5 text-xs text-zinc-500">
                    {t("Game and actions")}
                  </p>
                </div>

                <div className="space-y-2">
                  <button
                    type="button"
                    disabled={savingGame || gameState.moves.length === 0}
                    onClick={() => void saveCurrentGame()}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-amber-400/25 bg-amber-400/10 px-4 py-3 text-sm font-bold text-amber-200 transition hover:border-amber-300/40 hover:bg-amber-400/20 disabled:cursor-not-allowed disabled:opacity-35"
                  >
                    <span aria-hidden="true">▣</span>
                    <span>
                      {savingGame ? "…" : `${t("Save")} ${t("Game")}`}
                    </span>
                  </button>

                  {gameState.status === "playing" &&
                    gameState.moves.length === 0 && (
                      <div
                        className="
                          mb-3
                          rounded-2xl
                          border
                          border-white/10
                          bg-black/20
                          p-3
                        "
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-xs font-black text-zinc-200">
                              {t("Choose Side")}
                            </p>
                            <p className="mt-1 text-[10px] leading-4 text-zinc-600">
                              {t("Side selection locks after the first move.")}
                            </p>
                          </div>

                          <span className="rounded-lg bg-white/5 px-2 py-1 text-[10px] font-bold text-zinc-500">
                            {myPlayer?.chosen_color ? `${t("Chosen")}: ${
                                  myPlayer.chosen_color === "white"
                                    ? t("White")
                                    : t("Black")
                                }` : `${t("Current")}: ${
                                  mySeat === 0 ? t("White") : t("Black")
                                }`}
                          </span>
                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            disabled={
                              actionLoading !== null || whiteClaimedByOpponent
                            }
                            onClick={() => void chooseSide("white")}
                            className={`
                              rounded-xl
                              border
                              px-3
                              py-3
                              text-sm
                              font-black
                              transition
                              disabled:cursor-not-allowed
                              disabled:opacity-35

                              ${
                                myPlayer?.chosen_color === "white"
                                  ? "border-amber-400/30 bg-amber-400/15 text-amber-200"
                                  : "border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10"
                              }
                            `}
                          >
                            ♔ {t("White")}
                          </button>

                          <button
                            type="button"
                            disabled={
                              actionLoading !== null || blackClaimedByOpponent
                            }
                            onClick={() => void chooseSide("black")}
                            className={`
                              rounded-xl
                              border
                              px-3
                              py-3
                              text-sm
                              font-black
                              transition
                              disabled:cursor-not-allowed
                              disabled:opacity-35

                              ${
                                myPlayer?.chosen_color === "black"
                                  ? "border-amber-400/30 bg-amber-400/15 text-amber-200"
                                  : "border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10"
                              }
                            `}
                          >
                            ♚ {t("Black")}
                          </button>
                        </div>

                        {(whiteClaimedByOpponent || blackClaimedByOpponent) && (
                          <p className="mt-2 text-center text-[10px] text-zinc-600">
                            {t(
                              "A side already chosen by your opponent is locked.",
                            )}
                          </p>
                        )}
                      </div>
                    )}

                  {gameState.status === "playing" &&
                    !gameState.undo_requested_by && (
                      <>
                        <button
                          type="button"
                          disabled={!canRequestUndo || actionLoading !== null}
                          onClick={() => void requestUndo()}
                          className="
                          w-full
                          rounded-xl
                          border
                          border-white/10
                          bg-white/5
                          px-4
                          py-3
                          text-sm
                          font-bold
                          text-zinc-300
                          transition
                          hover:bg-white/10
                          disabled:cursor-not-allowed
                          disabled:opacity-40
                        "
                        >
                          {actionLoading === "undo-request" ? t("Undo request sent") : t("Undo Move")}
                        </button>

                        {!canRequestUndo && gameState.moves.length > 0 && (
                          <p className="px-1 text-center text-[10px] leading-4 text-zinc-600">
                            {alreadyRequestedUndoForCurrentMove ? t("You already requested undo for this move.") : t(
                                  "Only the player who made the last move can request undo.",
                                )}
                          </p>
                        )}
                      </>
                    )}

                  {undoRequestedByMe && (
                    <div
                      className="
                        rounded-xl
                        border
                        border-amber-400/15
                        bg-amber-400/5
                        px-3
                        py-3
                        text-center
                      "
                    >
                      <p className="text-xs font-bold text-amber-300">
                        {t("Undo request sent")}
                      </p>
                      <p className="mt-1 text-[10px] text-zinc-500">
                        {t("Waiting for opponent response...")}
                      </p>
                    </div>
                  )}

                  {undoRequestedByOpponent && (
                    <div
                      className="
                        rounded-xl
                        border
                        border-amber-400/20
                        bg-amber-400/10
                        p-3
                      "
                    >
                      <p className="text-xs font-bold text-amber-200">
                        {t("Opponent requests to undo the last move.")}
                      </p>

                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          disabled={actionLoading !== null}
                          onClick={() => void respondToUndo(true)}
                          className="
                            rounded-lg
                            bg-amber-400
                            px-3
                            py-2
                            text-xs
                            font-black
                            text-zinc-950
                            transition
                            hover:bg-amber-300
                            disabled:opacity-40
                          "
                        >
                          {t("Accept Undo")}
                        </button>

                        <button
                          type="button"
                          disabled={actionLoading !== null}
                          onClick={() => void respondToUndo(false)}
                          className="
                            rounded-lg
                            border
                            border-white/10
                            bg-white/5
                            px-3
                            py-2
                            text-xs
                            font-bold
                            text-zinc-300
                            transition
                            hover:bg-white/10
                            disabled:opacity-40
                          "
                        >
                          {t("Decline")}
                        </button>
                      </div>
                    </div>
                  )}

                  {gameState.status === "playing" && (
                    <button
                      type="button"
                      disabled={Boolean(gameState.undo_requested_by)}
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
                      disabled:cursor-not-allowed
                      disabled:opacity-40
                    "
                    >
                      {t("Resign")}
                    </button>
                  )}

                  {gameReviewAvailable && (
                    <button
                      type="button"
                      disabled={reviewMoves.length === 0}
                      onClick={() => {
                        setHistoryPreviewPly(null);
                        setReviewOpen(true);
                      }}
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
                        disabled:opacity-40
                      "
                    >
                      <span>♞</span>
                      <span>{t("Open Game Review")}</span>
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

              <section className="hidden">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-bold text-zinc-100">
                      {t("Move History")}
                    </h2>

                    <p className="mt-1 text-xs text-zinc-500">
                      {t("Game history")}
                    </p>
                  </div>

                  <span className="rounded-xl bg-white/5 px-2.5 py-1 text-xs font-semibold text-zinc-400">
                    {gameState.moves.length}
                  </span>
                </div>

                <div className="max-h-[420px] overflow-y-auto rounded-2xl border border-white/5 bg-black/20">
                  {historyRows.length === 0 ? (
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
                        {historyRows.map((move) => {
                          const selected = historyPreviewPly === move.ply;

                          return (
                            <tr
                              key={move.ply}
                              tabIndex={0}
                              onClick={() => {
                                setHistoryPreviewPly(move.ply);
                                setSelectedSquare(null);
                                setLegalMoves([]);
                                setPromotionFrom(null);
                                setPromotionSquare(null);
                              }}
                              onKeyDown={(event) => {
                                if (
                                  event.key === "Enter" ||
                                  event.key === " "
                                ) {
                                  setHistoryPreviewPly(move.ply);
                                  setSelectedSquare(null);
                                  setLegalMoves([]);
                                  setPromotionFrom(null);
                                  setPromotionSquare(null);
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
                                  <span className="inline-flex items-center gap-1 rounded-full bg-[#fff3d5]/10 px-2 py-1 text-[9px] font-bold text-[#fff3d5]">
                                    ♔ {t("White")}
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-1 text-[9px] font-bold text-zinc-400">
                                    ♚ {t("Black")}
                                  </span>
                                )}
                              </td>

                              <td className="px-2 py-2.5">
                                <div className="flex items-center gap-2">
                                  <span className="w-5 text-center text-lg leading-none">
                                    {getMultiplayerHistoryPieceSymbol(
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

              {/* PIECE VALUES — same baseline as Hotseat */}
              {/* SAVED GAMES */}
              <section className="hidden overflow-hidden xl:block rounded-3xl border border-amber-400/15 bg-[linear-gradient(145deg,rgba(10,18,28,.97),rgba(5,10,17,.94))] shadow-2xl shadow-black/35 backdrop-blur-xl">
                <button
                  type="button"
                  onClick={() => setSavedGamesOpen((open) => !open)}
                  className="flex w-full items-center justify-between gap-3 bg-amber-300/[0.025] px-4 py-3.5 text-left transition hover:bg-amber-300/[0.05]"
                >
                  <div>
                    <h2 className="font-serif text-lg font-semibold text-[#f6ead1]">
                      {t("Saved Games")}
                    </h2>
                    <p className="mt-0.5 text-[10px] uppercase tracking-[0.18em] text-zinc-600">
                      {t("Previous games")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-lg border border-amber-300/10 bg-amber-300/[0.06] px-2 py-1 text-xs font-bold text-amber-200">
                      {savedGames.length}
                    </span>
                    <span className="rounded-lg border border-amber-400/20 bg-amber-400/10 px-3 py-1.5 text-xs font-black text-amber-300">
                      {savedGamesOpen ? ui("Hide") : ui("Show")}
                    </span>
                  </div>
                </button>

                {savedGamesOpen && (
                  <div className="border-t border-white/5">
                    <div className="flex gap-2 p-3 pb-2">
                      <input
                        value={saveName}
                        onChange={(event) => setSaveName(event.target.value)}
                        placeholder={t("Game name")}
                        className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/25 px-3 py-2.5 text-xs text-zinc-100 outline-none transition placeholder:text-zinc-700 focus:border-amber-400/35"
                      />
                      <button
                        type="button"
                        disabled={savingGame || gameState.moves.length === 0}
                        onClick={() => void saveCurrentGame()}
                        className="rounded-xl border border-amber-400/25 bg-amber-400/10 px-3 py-2.5 text-xs font-black text-amber-200 transition hover:bg-amber-400/20 disabled:cursor-not-allowed disabled:opacity-35"
                      >
                        {savingGame ? "…" : t("Save")}
                      </button>
                    </div>
                    <div className="max-h-80 space-y-1 overflow-y-auto p-2 pt-0 [scrollbar-width:thin]">
                      {savedGames.length === 0 ? (
                        <div className="py-5 text-center text-xs text-zinc-600">
                          {t("No saved games yet")}
                        </div>
                      ) : (
                        savedGames.map((savedGame) => (
                          <div
                            key={savedGame.id}
                            className="group flex items-center gap-2 rounded-2xl border border-transparent px-3 py-2.5 transition hover:border-amber-300/10 hover:bg-amber-300/[0.035]"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-bold text-zinc-200">
                                {savedGame.name || t("Unnamed Game")}
                              </p>
                              <p className="mt-1 truncate text-[10px] text-zinc-600">
                                {savedGame.white_player || t("White")}{" "}
                                <span className="px-1 text-zinc-700">{ui("vs")}</span>{" "}
                                {savedGame.black_player || t("Black")}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => void deleteSavedGame(savedGame.id)}
                              className="rounded-lg border border-red-500/10 bg-red-500/[0.04] px-2 py-1.5 text-[10px] font-bold text-red-300/80 opacity-70 transition hover:bg-red-500/10 hover:text-red-200 group-hover:opacity-100"
                              title={t("Delete game")}
                            >
                              ×
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
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

        <ChessGameReview
          moves={reviewMoves}
          orientation={orientation}
          open={gameReviewAvailable && reviewOpen}
          onClose={() => setReviewOpen(false)}
          puzzleSource={gameEndedForReview ? "multiplayer" : undefined}
          puzzlePlayerColor={
            gameEndedForReview && myColor
              ? myColor === "w"
                ? "white"
                : "black"
              : undefined
          }
        />
      </div>
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

function getMultiplayerHistoryPieceSymbol(color: "w" | "b", piece: string) {
  const symbols: Record<"w" | "b", Record<string, string>> = {
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

  return symbols[color][piece] ?? "";
}

function PlayerBar({
  name,
  avatarId,
  color,
  active,
  me = false,
  t,
}: {
  name: string;
  avatarId: string;
  color: "white" | "black";
  active: boolean;
  me?: boolean;
  t: (key: string) => string;
}) {
  useUiLanguage();
  return (
    <div
      className={`
        relative
        rounded-3xl
        border
        px-4
        py-3.5
        transition-all
        duration-200

        ${
          active
            ? `
              border-amber-400/30
              bg-[linear-gradient(145deg,rgba(39,30,13,.52),rgba(7,14,22,.95))]
              shadow-[0_0_26px_rgba(251,191,36,0.07)]
            `
            : `
              border-white/10
              bg-[linear-gradient(145deg,rgba(10,18,28,.96),rgba(5,10,17,.94))]
            `
        }
      `}
    >
      <div className="flex items-center gap-3">
        <div
          className={`
            h-14
            w-14
            shrink-0
            overflow-hidden
            rounded-full
            ring-4 ring-white/[0.025]
            border
            ${color === "white" ? "border-amber-100/25" : "border-white/10"}
          `}
        >
          <ProfileAvatar avatarId={avatarId} className="h-full w-full" />
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
