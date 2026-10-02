import VisibleGameResult from "@/components/chess/VisibleGameResult";
import { playChessSound, type ChessSoundEvent } from "@/games/chess/audio/chessAudio";
import ChessMoveHistoryList from "../ChessMoveHistoryList";
import ChessPageHeader from "@/components/chess/ChessPageHeader";
import { ui, useUiLanguage } from "@/i18n/ui";
import { useAppLanguage } from "@/i18n/languageStore";
import { useRef, useEffect, useMemo, useState } from "react";

import { Chess, type Square } from "chess.js";

import { getSquareName, type PieceType } from "../../../utils/chessUtils.ts";

import Board from "./Board.tsx";

import {
  playPieceSelectSound,
  playPieceMoveSound,
  playPieceCaptureSound,
} from "../../../utils/sound.ts";

import PromotionBar from "./PromotionBar";
import { THREE_LIVES_MAX_HP } from "../../../games/chess/variants/threeLives.ts";

import {
  buildThreeLivesPowerupState,
  createThreeLivesHeartSeed,
} from "../../../games/chess/variants/threeLivesPowerups.ts";

import {
  buildThreeLivesMatchStats,
  type ThreeLivesHitMoment,
  type ThreeLivesStatsPiece,
} from "../../../games/chess/variants/threeLivesStats.ts";

import { useDelayedBoardOrientation } from "@/hooks/useDelayedBoardOrientation.ts";
import { useVariantChessAi } from "@/hooks/useVariantChessAi";
import {
  chessColorFromPlayerColor,
  oppositeChessColor,
  type Difficulty,
  type ChessPlayerColor,
} from "../../../games/chess/ai/variantAi.ts";

/* =========================================================
   TYPES
   ========================================================= */

type Language = "en" | "de" | "bar" | "ko" | "ru" | "es" | "pt";
type StatsTab = "overview" | "pressure" | "moments";


const deTranslations: Record<string, string> = {
  "Player Lives": "Spielerleben",
  "Collect hearts or land checks": "Herzen sammeln oder Schach geben",
  "White bonus hearts": "Bonusherzen Weiß",
  "Black bonus hearts": "Bonusherzen Schwarz",
  "Hearts collected": "Herzen eingesammelt",
  "Bonus-heart pickups": "Eingesammelte Bonusherzen",
  "Nobody has collected a bonus heart yet":
    "Noch hat niemand ein Bonusherz eingesammelt",
  "Three Lives Stats": "Drei-Leben-Statistik",
  "Fun numbers from this match": "Spaßzahlen aus dieser Partie",
  Overview: "Übersicht",
  Pressure: "Druck",
  Moments: "Momente",
  plies: "Halbzüge",
  "White hits": "Treffer Weiß",
  "Black hits": "Treffer Schwarz",
  "lives left": "Leben übrig",
  "White captures": "Schläge Weiß",
  "Black captures": "Schläge Schwarz",
  material: "Material",
  "Current quiet stretch": "Aktuelle Ruhephase",
  "Moves since the last life was lost":
    "Halbzüge seit dem letzten verlorenen Leben",
  "Last-life moves": "Züge mit letztem Leben",
  "How many moves were played while hanging on with one heart":
    "Züge, die mit nur einem Herz überlebt wurden",
  "Pressure leader": "Druckführer",
  "Dead even": "Völlig ausgeglichen",
  "Just for fun: 3 points per check + 1 per capture":
    "Nur zum Spaß: 3 Punkte pro Schach + 1 pro Schlag",
  "White danger piece": "Gefährlichste weiße Figur",
  "Black danger piece": "Gefährlichste schwarze Figur",
  "No checks yet": "Noch kein Schach",
  "Best check run": "Beste Schachserie",
  "Consecutive life hits by the same side":
    "Aufeinanderfolgende Lebenstreffer derselben Seite",
  "First blood": "Erster Treffer",
  "Latest hit": "Letzter Treffer",
  "Nobody has lost a life yet": "Noch hat niemand ein Leben verloren",
  "Still waiting for the first check": "Noch kein erster Schachtreffer",
  "Longest peaceful stretch": "Längste friedliche Phase",
  "No hearts lost": "Keine Herzen verloren",
  "Life-loss timeline": "Lebensverlust-Timeline",
  "All six hearts are still intact. Suspiciously peaceful.":
    "Alle sechs Herzen sind noch da. Verdächtig friedlich.",
  hit: "traf",
  "Chess Variant": "Schachvariante",
  "Three Lives Chess": "Drei-Leben-Schach",
  "Every check costs one life · Checkmate still wins":
    "Jedes Schach kostet ein Leben · Schachmatt gewinnt weiterhin",
  "White lives": "Weiße Leben",
  "Black lives": "Schwarze Leben",
  "White checks received": "Schachs gegen Weiß",
  "Black checks received": "Schachs gegen Schwarz",
  "No lives remaining": "Keine Leben mehr",
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
  "Player Lives": "Spieler-Lebn",
  "Collect hearts or land checks": "Herzn sammln oder Schach gebn",
  "White bonus hearts": "Bonusherzn Weiß",
  "Black bonus hearts": "Bonusherzn Schwarz",
  "Hearts collected": "Herzn g'sammelt",
  "Bonus-heart pickups": "G'sammelte Bonusherzn",
  "Nobody has collected a bonus heart yet":
    "No hod koana a Bonusherz g'sammelt",
  "Three Lives Stats": "Drei-Lebn-Statistik",
  "Fun numbers from this match": "A paar lustige Zahlen aus da Partie",
  Overview: "Übersicht",
  Pressure: "Druck",
  Moments: "Momente",
  plies: "Halbzüg",
  "White hits": "Treffer Weiß",
  "Black hits": "Treffer Schwarz",
  "lives left": "Lebn übrig",
  "White captures": "Schläge Weiß",
  "Black captures": "Schläge Schwarz",
  material: "Material",
  "Current quiet stretch": "Aktuelle Ruhe",
  "Moves since the last life was lost": "Halbzüg seitm letzten verlorenen Lebn",
  "Last-life moves": "Züg mitm letzten Lebn",
  "How many moves were played while hanging on with one heart":
    "Züg, de mit bloß oan Herz überlebt worn san",
  "Pressure leader": "Druckführer",
  "Dead even": "Genau gleich",
  "Just for fun: 3 points per check + 1 per capture":
    "Bloß zum Spaß: 3 Punkt pro Schach + 1 pro Schlag",
  "White danger piece": "G'fährlichste weiße Figur",
  "Black danger piece": "G'fährlichste schwarze Figur",
  "No checks yet": "No koa Schach",
  "Best check run": "Beste Schachserie",
  "Consecutive life hits by the same side":
    "Lebnstreffer hintereinander von derselben Seitn",
  "First blood": "Erster Treffer",
  "Latest hit": "Letzter Treffer",
  "Nobody has lost a life yet": "No hod koana a Lebn verlor'n",
  "Still waiting for the first check": "No koa erster Schachtreffer",
  "Longest peaceful stretch": "Längste friedliche Zeit",
  "No hearts lost": "Koa Herz verlor'n",
  "Life-loss timeline": "Lebnverlust-Verlauf",
  "All six hearts are still intact. Suspiciously peaceful.":
    "Alle sechs Herz san no do. Verdächtig friedlich.",
  hit: "hod troffa",
  "Chess Variant": "Schachvariantn",
  "Three Lives Chess": "Drei-Lebn-Schach",
  "Every check costs one life · Checkmate still wins":
    "Jeds Schach kost a Lebn · Schachmatt gwinnt trotzdem",
  "White lives": "Weiße Lebn",
  "Black lives": "Schwarze Lebn",
  "White checks received": "Schachs gegen Weiß",
  "Black checks received": "Schachs gegen Schwarz",
  "No lives remaining": "Koa Lebn mehr",
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
  "Player Lives": "플레이어 목숨",
  "Collect hearts or land checks": "하트를 모으거나 체크하세요",
  "White bonus hearts": "백 보너스 하트",
  "Black bonus hearts": "흑 보너스 하트",
  "Hearts collected": "획득한 하트",
  "Bonus-heart pickups": "보너스 하트 획득",
  "Nobody has collected a bonus heart yet":
    "아직 보너스 하트를 획득한 플레이어가 없습니다",
  "Three Lives Stats": "세 목숨 통계",
  "Fun numbers from this match": "이번 게임의 재미있는 기록",
  Overview: "개요",
  Pressure: "압박",
  Moments: "순간들",
  plies: "하프무브",
  "White hits": "백의 체크 타격",
  "Black hits": "흑의 체크 타격",
  "lives left": "목숨 남음",
  "White captures": "백의 잡은 기물",
  "Black captures": "흑의 잡은 기물",
  material: "기물 가치",
  "Current quiet stretch": "현재 평온 구간",
  "Moves since the last life was lost": "마지막 목숨 손실 이후 하프무브 수",
  "Last-life moves": "마지막 목숨으로 버틴 수",
  "How many moves were played while hanging on with one heart":
    "목숨 하나만 남은 상태에서 둔 수",
  "Pressure leader": "압박 우세",
  "Dead even": "완전 동률",
  "Just for fun: 3 points per check + 1 per capture":
    "재미용 점수: 체크 3점 + 잡기 1점",
  "White danger piece": "백의 가장 위험한 기물",
  "Black danger piece": "흑의 가장 위험한 기물",
  "No checks yet": "아직 체크 없음",
  "Best check run": "최고 연속 체크",
  "Consecutive life hits by the same side": "같은 편의 연속 목숨 타격",
  "First blood": "첫 타격",
  "Latest hit": "최근 타격",
  "Nobody has lost a life yet": "아직 아무도 목숨을 잃지 않았습니다",
  "Still waiting for the first check": "아직 첫 체크를 기다리는 중",
  "Longest peaceful stretch": "가장 긴 평온 구간",
  "No hearts lost": "목숨 손실 없음",
  "Life-loss timeline": "목숨 손실 기록",
  "All six hearts are still intact. Suspiciously peaceful.":
    "아직 여섯 목숨이 전부 멀쩡합니다. 너무 평화롭네요.",
  hit: "타격",
  "Chess Variant": "체스 변형",
  "Three Lives Chess": "세 목숨 체스",
  "Every check costs one life · Checkmate still wins":
    "체크를 받을 때마다 목숨 1개 감소 · 체크메이트는 즉시 승리",
  "White lives": "백 목숨",
  "Black lives": "흑 목숨",
  "White checks received": "백이 받은 체크",
  "Black checks received": "흑이 받은 체크",
  "No lives remaining": "남은 목숨 없음",
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
  "Player Lives": "Жизни игроков",
  "Collect hearts or land checks": "Собирайте сердца или ставьте шах",
  "White bonus hearts": "Бонусные сердца белых",
  "Black bonus hearts": "Бонусные сердца чёрных",
  "Hearts collected": "Собрано сердец",
  "Bonus-heart pickups": "Подобранные бонусные сердца",
  "Nobody has collected a bonus heart yet":
    "Пока никто не подобрал бонусное сердце",
  "Three Lives Stats": "Статистика «Три жизни»",
  "Fun numbers from this match": "Забавные цифры этой партии",
  Overview: "Обзор",
  Pressure: "Давление",
  Moments: "Моменты",
  plies: "полуходов",
  "White hits": "Удары белых",
  "Black hits": "Удары чёрных",
  "lives left": "жизней осталось",
  "White captures": "Взятия белых",
  "Black captures": "Взятия чёрных",
  material: "материала",
  "Current quiet stretch": "Текущая тихая серия",
  "Moves since the last life was lost": "Полуходов с последней потери жизни",
  "Last-life moves": "Ходы на последней жизни",
  "How many moves were played while hanging on with one heart":
    "Ходы, сыгранные с одной оставшейся жизнью",
  "Pressure leader": "Лидер давления",
  "Dead even": "Полное равенство",
  "Just for fun: 3 points per check + 1 per capture":
    "Просто для веселья: 3 очка за шах + 1 за взятие",
  "White danger piece": "Самая опасная фигура белых",
  "Black danger piece": "Самая опасная фигура чёрных",
  "No checks yet": "Шахов пока нет",
  "Best check run": "Лучшая серия шахов",
  "Consecutive life hits by the same side":
    "Последовательные потери жизни от одной стороны",
  "First blood": "Первый удар",
  "Latest hit": "Последний удар",
  "Nobody has lost a life yet": "Пока никто не потерял жизнь",
  "Still waiting for the first check": "Первого шаха пока не было",
  "Longest peaceful stretch": "Самый длинный мирный отрезок",
  "No hearts lost": "Без потери жизней",
  "Life-loss timeline": "Хронология потерь жизни",
  "All six hearts are still intact. Suspiciously peaceful.":
    "Все шесть жизней целы. Подозрительно мирно.",
  hit: "нанесли удар",
  "Chess Variant": "Шахматный вариант",
  "Three Lives Chess": "Шахматы «Три жизни»",
  "Every check costs one life · Checkmate still wins":
    "Каждый шах отнимает жизнь · Мат по-прежнему сразу побеждает",
  "White lives": "Жизни белых",
  "Black lives": "Жизни чёрных",
  "White checks received": "Шахов получили белые",
  "Black checks received": "Шахов получили чёрные",
  "No lives remaining": "Жизни закончились",
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



function translateChess(language: Language, key: string): string {
  if (language === "en") return key;
  if (language === "de") return deTranslations[key] ?? ui(key);
  if (language === "bar")
    return bavarianTranslations[key] ?? deTranslations[key] ?? ui(key);
  if (language === "ko") return koreanTranslations[key] ?? ui(key);
  if (language === "ru") return russianTranslations[key] ?? ui(key);
  return ui(key);
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
   COMPONENT
   ========================================================= */

type VariantAiBoardProps = {
  aiMode?: boolean;
  playerColor?: ChessPlayerColor;
  difficulty?: Difficulty;
  onChangeSettings?: () => void;
};

export default function ThreeLivesChessBoard({
  aiMode = false,
  playerColor = "white",
  difficulty = "casual",
}: VariantAiBoardProps) {
  useUiLanguage();
  const { language } = useAppLanguage();
  const t = (key: string) => translateChess(language, key);

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

  const [, setGameOverReason] = useState("");

  const [, setWinner] = useState<"white" | "black" | "draw">("white");

  const [, setWhiteCheckCounter] = useState<number>(0);

  const [, setBlackCheckCounter] = useState<number>(0);

  const [, setIllegal] = useState(false);

  /* =======================================================
     LOCAL PLAYERS
     ======================================================= */

  const [whitePlayer] = useState("");

  const [blackPlayer] = useState("");

  const [historyPreviewPly, setHistoryPreviewPly] = useState<number | null>(
    null,
  );

  /* =======================================================
     THREE LIVES STATS
     ======================================================= */

  const [statsTab, setStatsTab] = useState<StatsTab>("overview");

  /*
   * One seed per game keeps the "random" heart positions stable across
   * re-renders, Undo and historical preview.
   */
  const [heartSeed, setHeartSeed] = useState<number>(createThreeLivesHeartSeed);

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

        commitAiMove(move.from, move.to, move.promotion);
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
    position,
    moveHistory.length,
    gameOver,
    historyPreviewPly,
    promotionFrom,
    promotionSquare,
    chooseAiMove,
  ]);

  /* =======================================================
     BOARD
     ======================================================= */

  const board = game.board();

  /* =======================================================
     CLICKABLE MOVE HISTORY PREVIEW
     ======================================================= */

  const powerupState = useMemo(
    () => buildThreeLivesPowerupState(moveHistory, heartSeed),
    [moveHistory, heartSeed],
  );

  const historyRows = useMemo(() => {
    const replay = new Chess();

    return moveHistory.map((san, index) => {
      const move = replay.move(san);
      const lifeState = powerupState.timeline[index];

      return {
        ply: index + 1,
        moveNumber: Math.floor(index / 2) + 1,
        color: move.color,
        san: move.san,
        from: move.from,
        to: move.to,
        piece: move.piece as PieceType,
        fenAfter: replay.fen(),
        damagedSide: lifeState?.damagedSide ?? null,
        heartPickedBy: lifeState?.heartPickedBy ?? null,
        heartPickedSquare: lifeState?.heartPickedSquare ?? null,
        whiteHpAfter: lifeState?.whiteHpAfter ?? THREE_LIVES_MAX_HP,
        blackHpAfter: lifeState?.blackHpAfter ?? THREE_LIVES_MAX_HP,
        activeHeartsAfter: lifeState?.activeHeartsAfter ?? [],
      };
    });
  }, [moveHistory, powerupState.timeline]);

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
   * Local Hotseat orientation:
   * after a move, keep the mover at the bottom for 1.5 seconds,
   * then flip to the new side-to-move.
   */
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

  const matchStats = useMemo(
    () => buildThreeLivesMatchStats(moveHistory, heartSeed),
    [moveHistory, heartSeed],
  );

  const displayedWhiteHp =
    historyPreviewPly !== null
      ? (powerupState.timeline[historyPreviewPly - 1]?.whiteHpAfter ??
        THREE_LIVES_MAX_HP)
      : powerupState.whiteHp;

  const displayedBlackHp =
    historyPreviewPly !== null
      ? (powerupState.timeline[historyPreviewPly - 1]?.blackHpAfter ??
        THREE_LIVES_MAX_HP)
      : powerupState.blackHp;

  const displayedHeartSquares: Square[] =
    historyPreviewPly !== null
      ? (powerupState.timeline[historyPreviewPly - 1]?.activeHeartsAfter ??
        powerupState.initialHeartSquares)
      : powerupState.activeHearts;

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

  function playSound(sound: string) { playChessSound(sound as ChessSoundEvent); }

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

  function checkGameOver(playResultSound = false, seedOverride?: number) {
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

    const lifeState = buildThreeLivesPowerupState(
      game.history(),
      seedOverride ?? heartSeed,
    );

    if (lifeState.winnerByHp) {
      setGameOver(true);
      setGameOverReason("No lives remaining");
      setWinner(lifeState.winnerByHp);

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
     RESTART
     ======================================================= */

  function restartGame() {
    setHistoryPreviewPly(null);
    setStatsTab("overview");
    setHeartSeed(createThreeLivesHeartSeed());

    game.reset();
    snapToSide(game.turn());

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
  }

  /* =======================================================
     UNDO
     ======================================================= */

  function undoMove() {
    const move = game.undo();
    if (aiMode) return;
    if (!move) {
      return;
    }

    snapToSide(game.turn());

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
     PROMOTION
     ======================================================= */

  function promotePawn(piece: "q" | "r" | "b" | "n") {
    if (!promotionFrom || !promotionSquare || gameOver) {
      return;
    }

    try {
      const move = game.move({
        from: promotionFrom,

        to: promotionSquare,

        promotion: piece,
      });

      const afterFen = game.fen();

      setHistoryPreviewPly(null);

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
      if (game.isCheck()) {
        if (game.turn() === "w") {
          setWhiteCheckCounter((counter) => counter + 1);
        } else {
          setBlackCheckCounter((counter) => counter + 1);
        }

        if (!game.isCheckmate()) {
          playSound("check");
        }
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

  function commitAiMove(
    from: Square,
    to: Square,
    promotion?: "q" | "r" | "b" | "n",
  ) {
    if (gameOver || historyPreviewPly !== null) {
      return;
    }

    try {
      const move = game.move({
        from,
        to,
        ...(promotion ? { promotion } : {}),
      });

      const afterFen = game.fen();

      setHistoryPreviewPly(null);
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
      setIllegal(false);
      setPromotionFrom(null);
      setPromotionSquare(null);
      setSelectedSquare(null);
      setLegalMoves([]);

      if (game.isCheck()) {
        if (game.turn() === "w") {
          setWhiteCheckCounter((counter) => counter + 1);
        } else {
          setBlackCheckCounter((counter) => counter + 1);
        }

        if (!game.isCheckmate()) {
          playSound("check");
        }
      } else if (move.isKingsideCastle() || move.isQueensideCastle()) {
        playChessSound("castle");
      }

      setPosition(afterFen);
      checkGameOver(true);
    } catch {
      setIllegal(true);
    }
  }

  /* =======================================================
     BOARD CLICK
     ======================================================= */

  function handleSquareClick(row: number, column: number) {
    if (aiMode && game.turn() !== humanColor) return;

    if (gameOver || historyPreviewPly !== null) {
      return;
    }
    if (promotionFrom && promotionSquare) {
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

      const move = game.move({
        from: selectedSquare,

        to: square,
      });

      const afterFen = game.fen();

      setHistoryPreviewPly(null);

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

      if (game.isCheck()) {
        if (game.turn() === "w") {
          setWhiteCheckCounter((counter) => counter + 1);
        } else {
          setBlackCheckCounter((counter) => counter + 1);
        }

        if (!game.isCheckmate()) {
          playSound("check");
        }
      } else if (move.isKingsideCastle() || move.isQueensideCastle()) {
        playChessSound("castle");
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

        <ChessPageHeader className="
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
          " description={<> {t("Every check costs one life · Checkmate still wins")} </>}>


          <div className="flex flex-wrap items-center justify-end gap-2">
            <div
              className="
                flex
                items-center
                gap-2
                rounded-full
                border
                border-red-400/15
                bg-red-400/[0.06]
                px-3
                py-1.5
                text-xs
                font-bold
              "
            >
              <span className="text-[#fff3d5]">♔</span>
              <span className="tracking-wide text-red-300">
                {"♥".repeat(displayedWhiteHp)}
                <span className="text-zinc-700">
                  {"♥".repeat(
                    Math.max(0, THREE_LIVES_MAX_HP - displayedWhiteHp),
                  )}
                </span>
              </span>

              <span className="mx-1 text-zinc-700">·</span>

              <span className="text-zinc-400">♚</span>
              <span className="tracking-wide text-red-300">
                {"♥".repeat(displayedBlackHp)}
                <span className="text-zinc-700">
                  {"♥".repeat(
                    Math.max(0, THREE_LIVES_MAX_HP - displayedBlackHp),
                  )}
                </span>
              </span>
            </div>

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
        </ChessPageHeader>

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

                <ThreeLivesGameControls
                  onUndo={undoMove}
                  onRestart={restartGame}
                  undoDisabled={aiMode}
                  t={t}
                />
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
                  <CapturedPiecesGrid
                    capturedBlack={capturedBlack}
                    capturedWhite={capturedWhite}
                    t={t}
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

                <ChessMoveHistoryList
                  listClassName="max-h-80 rounded-2xl border border-white/5 bg-black/20"
                  selectedPly={historyPreviewPly}
                  emptyLabel={t("No moves yet")}
                  entries={historyRows.map((move) => ({
                    ply: move.ply,
                    side: move.color,
                    moveNumber: move.moveNumber,
                    content: (
                      <>
                        <span className="text-base leading-none">{getHistoryPieceSymbol(move.color, move.piece)}</span>
                        <span className="truncate font-mono text-xs font-bold text-zinc-200">{move.san}</span>
                      </>
                    ),
                    trailing: move.damagedSide ? (
                      <span className="rounded-full bg-red-400/10 px-1.5 py-0.5 font-black text-red-300">−1 ♥</span>
                    ) : null,
                  }))}
                  onSelect={(ply) => {
                    setHistoryPreviewPly(ply);
                    setSelectedSquare(null);
                    setLegalMoves([]);
                  }}
                />
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
                <VisibleGameResult />
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

                    <p className="mt-1 text-sm font-bold text-white">{ui("Move")}{historyPreview.moveNumber}
                      {historyPreview.color === "w" ? "." : "..."}{" "}
                      {historyPreview.san}
                    </p>

                    <p className="mt-1 text-[10px] font-semibold text-zinc-500">
                      ♔ {historyPreview.whiteHpAfter} ♥ · ♚{" "}
                      {historyPreview.blackHpAfter} ♥
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
                selectedSquare={historyPreviewMove ? null : selectedSquare}
                legalMoves={historyPreviewMove ? [] : legalMoves}
                lastMove={historyPreviewMove ?? lastMove}
                checkedKingSquare={
                  historyPreview
                    ? historyPreviewCheckedKingSquare
                    : checkedKingSquare
                }
                onSquareClick={
                  historyPreview || flipPending ? () => {} : handleSquareClick
                }
                heartSquares={displayedHeartSquares}
                orientation={boardOrientation}
              />

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
                  PLAYER LIVES
                 =========================================== */}

              <section
                className="
                  rounded-3xl
                  border
                  border-red-400/15
                  bg-zinc-900/80
                  p-4
                  shadow-xl
                  shadow-black/20
                  backdrop-blur-md
                "
              >
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-black text-zinc-100">
                      {t("Player Lives")}
                    </h2>

                    <p className="mt-1 text-xs text-zinc-500">
                      {t("Collect hearts or land checks")}
                    </p>
                  </div>

                  <span className="text-2xl text-red-300">♥</span>
                </div>

                <div className="space-y-3">
                  <div
                    className="
                      rounded-2xl
                      border
                      border-[#fff3d5]/15
                      bg-[#fff3d5]/[0.04]
                      p-4
                    "
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-xs font-black uppercase tracking-widest text-zinc-500">
                          ♔ {whitePlayer.trim() || t("White")}
                        </p>

                        <p className="mt-3 break-words text-3xl leading-none tracking-[0.12em] text-red-300">
                          {"♥".repeat(displayedWhiteHp)}
                          <span className="text-zinc-800">
                            {"♥".repeat(
                              Math.max(
                                0,
                                THREE_LIVES_MAX_HP - displayedWhiteHp,
                              ),
                            )}
                          </span>
                        </p>
                      </div>

                      <span className="text-4xl font-black leading-none text-[#fff3d5]">
                        {displayedWhiteHp}
                      </span>
                    </div>
                  </div>

                  <div
                    className="
                      rounded-2xl
                      border
                      border-white/10
                      bg-white/[0.03]
                      p-4
                    "
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-xs font-black uppercase tracking-widest text-zinc-500">
                          ♚ {blackPlayer.trim() || t("Black")}
                        </p>

                        <p className="mt-3 break-words text-3xl leading-none tracking-[0.12em] text-red-300">
                          {"♥".repeat(displayedBlackHp)}
                          <span className="text-zinc-800">
                            {"♥".repeat(
                              Math.max(
                                0,
                                THREE_LIVES_MAX_HP - displayedBlackHp,
                              ),
                            )}
                          </span>
                        </p>
                      </div>

                      <span className="text-4xl font-black leading-none text-zinc-100">
                        {displayedBlackHp}
                      </span>
                    </div>
                  </div>
                </div>
              </section>

              {/* ===========================================
                  THREE LIVES STATS
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
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg">♥</span>

                      <h2 className="font-bold text-zinc-100">
                        {t("Three Lives Stats")}
                      </h2>
                    </div>

                    <p className="mt-1 text-xs text-zinc-500">
                      {t("Fun numbers from this match")}
                    </p>
                  </div>

                  <span
                    className="
                      rounded-full
                      border
                      border-red-400/15
                      bg-red-400/[0.07]
                      px-2.5
                      py-1
                      text-[9px]
                      font-black
                      uppercase
                      tracking-wider
                      text-red-300
                    "
                  >
                    {matchStats.totalPlies} {t("plies")}
                  </span>
                </div>

                <div
                  className="
                    mt-4
                    grid
                    grid-cols-3
                    gap-1
                    rounded-xl
                    border
                    border-white/5
                    bg-black/20
                    p-1
                  "
                >
                  {(
                    [
                      ["overview", "Overview"],
                      ["pressure", "Pressure"],
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
                            ? "bg-red-400/15 text-red-200"
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
                        label={t("White hits")}
                        value={String(matchStats.whiteChecksDealt)}
                        detail={`${displayedWhiteHp} ${t("lives left")}`}
                      />

                      <StatCard
                        icon="♚"
                        label={t("Black hits")}
                        value={String(matchStats.blackChecksDealt)}
                        detail={`${displayedBlackHp} ${t("lives left")}`}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <StatCard
                        icon="⚔"
                        label={t("White captures")}
                        value={String(matchStats.whiteCaptures)}
                        detail={`${matchStats.whiteMaterialTaken} ${t("material")}`}
                      />

                      <StatCard
                        icon="⚔"
                        label={t("Black captures")}
                        value={String(matchStats.blackCaptures)}
                        detail={`${matchStats.blackMaterialTaken} ${t("material")}`}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <StatCard
                        icon="♥"
                        label={t("White bonus hearts")}
                        value={String(matchStats.whiteHeartsClaimed)}
                        detail={t("Hearts collected")}
                      />

                      <StatCard
                        icon="♥"
                        label={t("Black bonus hearts")}
                        value={String(matchStats.blackHeartsClaimed)}
                        detail={t("Hearts collected")}
                      />
                    </div>

                    <div
                      className="
                        rounded-xl
                        border
                        border-white/5
                        bg-black/20
                        px-3
                        py-3
                      "
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs text-zinc-500">
                          {t("Current quiet stretch")}
                        </span>

                        <span className="text-sm font-black text-zinc-200">
                          {matchStats.currentCalmStreak} {t("plies")}
                        </span>
                      </div>

                      <p className="mt-1 text-[10px] text-zinc-700">
                        {t("Moves since the last life was lost")}
                      </p>
                    </div>

                    <div
                      className="
                        rounded-xl
                        border
                        border-red-400/10
                        bg-red-400/[0.04]
                        px-3
                        py-3
                      "
                    >
                      <p className="text-[10px] font-black uppercase tracking-wider text-red-300">
                        {t("Last-life moves")}
                      </p>

                      <div className="mt-2 flex items-center justify-between text-xs">
                        <span className="text-zinc-500">♔ {t("White")}</span>
                        <span className="font-black text-zinc-200">
                          {matchStats.whiteLastLifeMoves}
                        </span>
                      </div>

                      <div className="mt-1 flex items-center justify-between text-xs">
                        <span className="text-zinc-500">♚ {t("Black")}</span>
                        <span className="font-black text-zinc-200">
                          {matchStats.blackLastLifeMoves}
                        </span>
                      </div>

                      <p className="mt-2 text-[10px] leading-4 text-zinc-700">
                        {t(
                          "How many moves were played while hanging on with one heart",
                        )}
                      </p>
                    </div>
                  </div>
                )}

                {statsTab === "pressure" && (
                  <div className="mt-4 space-y-3">
                    <div
                      className="
                        rounded-2xl
                        border
                        border-amber-400/10
                        bg-amber-400/[0.04]
                        p-3
                      "
                    >
                      <p className="text-[10px] font-black uppercase tracking-wider text-amber-300">
                        {t("Pressure leader")}
                      </p>

                      <div className="mt-2 flex items-end justify-between gap-3">
                        <div>
                          <p className="text-xl font-black text-white">
                            {matchStats.pressureLeader === "even" ? t("Dead even") : matchStats.pressureLeader === "white" ? `♔ ${t("White")}` : `♚ ${t("Black")}`}
                          </p>

                          <p className="mt-1 text-[10px] text-zinc-700">
                            {t(
                              "Just for fun: 3 points per check + 1 per capture",
                            )}
                          </p>
                        </div>

                        <div className="text-right text-xs font-black">
                          <p className="text-[#fff3d5]">
                            {matchStats.whitePressureScore}
                          </p>
                          <p className="text-zinc-400">
                            {matchStats.blackPressureScore}
                          </p>
                        </div>
                      </div>
                    </div>

                    <DangerPieceCard
                      side="white"
                      dangerousPiece={matchStats.whiteDangerousPiece}
                      t={t}
                    />

                    <DangerPieceCard
                      side="black"
                      dangerousPiece={matchStats.blackDangerousPiece}
                      t={t}
                    />

                    <div
                      className="
                        rounded-xl
                        border
                        border-white/5
                        bg-black/20
                        px-3
                        py-3
                      "
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs text-zinc-500">
                          {t("Best check run")}
                        </span>

                        <span className="text-sm font-black text-zinc-200">
                          {matchStats.longestCheckRun.count === 0 ? "—" : `${
                                matchStats.longestCheckRun.side === "white"
                                  ? "♔"
                                  : "♚"
                              } ×${matchStats.longestCheckRun.count}`}
                        </span>
                      </div>

                      <p className="mt-1 text-[10px] text-zinc-700">
                        {t("Consecutive life hits by the same side")}
                      </p>
                    </div>
                  </div>
                )}

                {statsTab === "moments" && (
                  <div className="mt-4 space-y-3">
                    <MomentCard
                      title={t("First blood")}
                      moment={matchStats.firstHit}
                      emptyText={t("Nobody has lost a life yet")}
                      onSelect={(ply) => {
                        setHistoryPreviewPly(ply);
                        setSelectedSquare(null);
                        setLegalMoves([]);
                      }}
                      t={t}
                    />

                    <MomentCard
                      title={t("Latest hit")}
                      moment={matchStats.latestHit}
                      emptyText={t("Still waiting for the first check")}
                      onSelect={(ply) => {
                        setHistoryPreviewPly(ply);
                        setSelectedSquare(null);
                        setLegalMoves([]);
                      }}
                      t={t}
                    />

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
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-wider text-zinc-600">
                          {t("Longest peaceful stretch")}
                        </p>

                        <p className="mt-1 text-xs text-zinc-500">
                          {t("No hearts lost")}
                        </p>
                      </div>

                      <span className="text-xl font-black text-zinc-200">
                        {matchStats.longestCalmStreak}
                      </span>
                    </div>

                    <div
                      className="
                        rounded-xl
                        border
                        border-white/5
                        bg-black/20
                        p-3
                      "
                    >
                      <p className="text-[10px] font-black uppercase tracking-wider text-zinc-600">
                        {t("Life-loss timeline")}
                      </p>

                      {matchStats.hitMoments.length === 0 ? (
                        <p className="mt-3 text-xs text-zinc-700">
                          {t(
                            "All six hearts are still intact. Suspiciously peaceful.",
                          )}
                        </p>
                      ) : (
                        <div className="mt-3 space-y-2">
                          {matchStats.hitMoments
                            .slice(-5)
                            .reverse()
                            .map((moment) => (
                              <button
                                key={`${moment.ply}-${moment.san}`}
                                type="button"
                                onClick={() => {
                                  setHistoryPreviewPly(moment.ply);
                                  setSelectedSquare(null);
                                  setLegalMoves([]);
                                }}
                                className="
                                  flex
                                  w-full
                                  items-center
                                  justify-between
                                  gap-3
                                  rounded-lg
                                  border
                                  border-white/5
                                  bg-white/[0.025]
                                  px-2.5
                                  py-2
                                  text-left
                                  transition
                                  hover:border-red-400/20
                                  hover:bg-red-400/[0.05]
                                "
                              >
                                <div className="min-w-0">
                                  <p className="truncate font-mono text-xs font-black text-zinc-200">
                                    {moment.san}
                                  </p>

                                  <p className="mt-0.5 text-[9px] text-zinc-700">
                                    {t("Move")} {moment.moveNumber} ·{" "}
                                    {moment.attacker === "white" ? t("White") : t("Black")}{" "}
                                    {t("hit")}
                                  </p>
                                </div>

                                <span className="shrink-0 text-[10px] font-black text-red-300">
                                  ♔ {moment.whiteHpAfter}♥ · ♚{" "}
                                  {moment.blackHpAfter}♥
                                </span>
                              </button>
                            ))}
                        </div>
                      )}
                    </div>

                    <div
                      className="
                        rounded-xl
                        border
                        border-white/5
                        bg-black/20
                        p-3
                      "
                    >
                      <p className="text-[10px] font-black uppercase tracking-wider text-zinc-600">
                        {t("Bonus-heart pickups")}
                      </p>

                      {matchStats.heartPickups.length === 0 ? (
                        <p className="mt-3 text-xs text-zinc-700">
                          {t("Nobody has collected a bonus heart yet")}
                        </p>
                      ) : (
                        <div className="mt-3 space-y-2">
                          {matchStats.heartPickups
                            .slice(-5)
                            .reverse()
                            .map((pickup) => (
                              <button
                                key={`pickup-${pickup.ply}-${pickup.square}`}
                                type="button"
                                onClick={() => {
                                  setHistoryPreviewPly(pickup.ply);
                                  setSelectedSquare(null);
                                  setLegalMoves([]);
                                }}
                                className="
                                  flex
                                  w-full
                                  items-center
                                  justify-between
                                  gap-3
                                  rounded-lg
                                  border
                                  border-white/5
                                  bg-white/[0.025]
                                  px-2.5
                                  py-2
                                  text-left
                                  transition
                                  hover:border-red-400/20
                                  hover:bg-red-400/[0.05]
                                "
                              >
                                <div>
                                  <p className="font-mono text-xs font-black text-zinc-200">
                                    {pickup.san}
                                  </p>

                                  <p className="mt-0.5 text-[9px] text-zinc-700">
                                    {pickup.side === "white" ? t("White") : t("Black")}{" "}
                                    · {pickup.square}
                                  </p>
                                </div>

                                <span className="text-xs font-black text-red-300">
                                  +1 ♥
                                </span>
                              </button>
                            ))}
                        </div>
                      )}
                    </div>
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
   THREE LIVES GAME CONTROLS
   ========================================================= */

function ThreeLivesGameControls({
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
  useUiLanguage();
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onUndo}
          disabled={undoDisabled}
          className="
            rounded-xl
            border
            border-white/10
            bg-white/5
            px-3
            py-2.5
            text-sm
            font-bold
            text-zinc-300
            transition
            hover:bg-white/10
            hover:text-white
            disabled:cursor-not-allowed
    disabled:border-white/5
    disabled:bg-white/[0.02]
    disabled:text-zinc-600
    disabled:opacity-50
    disabled:hover:bg-white/[0.02]
          "
        >
          ↶ {t("Undo")}
        </button>

        <button
          type="button"
          onClick={onRestart}
          className="
            rounded-xl
            border
            border-red-400/15
            bg-red-400/[0.06]
            px-3
            py-2.5
            text-sm
            font-bold
            text-red-300
            transition
            hover:bg-red-400/[0.12]
          "
        >
          ↻ {t("Restart")}
        </button>
      </div>
    </div>
  );
}

/* =========================================================
   THREE LIVES STATS HELPERS
   ========================================================= */

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
  useUiLanguage();
  return (
    <div className="rounded-xl border border-white/5 bg-black/20 px-3 py-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm">{icon}</span>
        <span className="text-xl font-black text-zinc-100">{value}</span>
      </div>

      <p className="mt-2 text-[10px] font-black uppercase tracking-wider text-zinc-600">
        {ui(label)}
      </p>

      <p className="mt-1 text-[10px] text-zinc-700">{detail}</p>
    </div>
  );
}

const statsPieceNames: Record<ThreeLivesStatsPiece, string> = {
  p: "Pawn",
  n: "Knight",
  b: "Bishop",
  r: "Rook",
  q: "Queen",
  k: "King",
};

const statsPieceSymbols: Record<
  "white" | "black",
  Record<ThreeLivesStatsPiece, string>
> = {
  white: { p: "♙", n: "♘", b: "♗", r: "♖", q: "♕", k: "♔" },
  black: { p: "♟", n: "♞", b: "♝", r: "♜", q: "♛", k: "♚" },
};

function DangerPieceCard({
  side,
  dangerousPiece,
  t,
}: {
  side: "white" | "black";
  dangerousPiece: {
    piece: ThreeLivesStatsPiece;
    checks: number;
  } | null;
  t: (key: string) => string;
}) {
  useUiLanguage();
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-black/20 px-3 py-3">
      <div className="flex items-center gap-3">
        <span className="text-2xl">
          {dangerousPiece ? statsPieceSymbols[side][dangerousPiece.piece] : side === "white" ? "♔" : "♚"}
        </span>

        <div>
          <p className="text-[10px] font-black uppercase tracking-wider text-zinc-600">
            {side === "white" ? t("White danger piece") : t("Black danger piece")}
          </p>

          <p className="mt-1 text-xs font-bold text-zinc-300">
            {dangerousPiece ? t(statsPieceNames[dangerousPiece.piece]) : t("No checks yet")}
          </p>
        </div>
      </div>

      <span className="text-lg font-black text-red-300">
        {dangerousPiece ? `×${dangerousPiece.checks}` : "—"}
      </span>
    </div>
  );
}

function MomentCard({
  title,
  moment,
  emptyText,
  onSelect,
  t,
}: {
  title: string;
  moment: ThreeLivesHitMoment | null;
  emptyText: string;
  onSelect: (ply: number) => void;
  t: (key: string) => string;
}) {
  useUiLanguage();
  return (
    <button
      type="button"
      disabled={!moment}
      onClick={() => {
        if (moment) onSelect(moment.ply);
      }}
      className="
        w-full
        rounded-xl
        border
        border-white/5
        bg-black/20
        px-3
        py-3
        text-left
        transition
        enabled:hover:border-red-400/20
        enabled:hover:bg-red-400/[0.05]
        disabled:cursor-default
      "
    >
      <p className="text-[10px] font-black uppercase tracking-wider text-zinc-600">
        {ui(title)}
      </p>

      {moment ? (
        <div className="mt-2 flex items-center justify-between gap-3">
          <div>
            <p className="font-mono text-sm font-black text-zinc-200">
              {moment.san}
            </p>

            <p className="mt-1 text-[10px] text-zinc-700">
              {moment.attacker === "white" ? t("White") : t("Black")} ·{" "}
              {t("Move")} {moment.moveNumber}
            </p>
          </div>

          <div className="text-right">
            <p className="text-xs font-black text-red-300">−1 ♥</p>

            <p className="mt-1 text-[9px] text-zinc-700">
              ♔ {moment.whiteHpAfter} · ♚ {moment.blackHpAfter}
            </p>
          </div>
        </div>
      ) : (
        <p className="mt-2 text-xs text-zinc-700">{emptyText}</p>
      )}
    </button>
  );
}

/* =========================================================
   HEART POWER-UP OVERLAY
   ========================================================= */

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
