import { gameUi } from "../../../i18n/gameUi.ts";
import useChessBoardFit from "@/components/chess/useChessBoardFit";
import VisibleGameResult from "@/components/chess/VisibleGameResult";
import ChessPageHeader from "@/components/chess/ChessPageHeader";
import ChessMoveHistoryList from "../ChessMoveHistoryList";
import FourPlayerThemedPiece from "../FourPlayerThemedPiece";
import { boardColors, useChessSettings } from "@/context/ChessSettingsContext";
import { FOUR_PLAYER_HISTORY_SIDES } from "../moveHistorySides";
import { ui, useUiLanguage } from "@/i18n/ui";
import { useRef, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  translateChess,
  useChessLanguage,
  type TranslationTable,
} from "../../../games/chess/i18n/chessLanguage";

import {
  applyFourPlayerMove,
  cloneFourPlayerState,
  createInitialFourPlayerState,
  fourPlayerLabel,
  fourPlayerSquareName,
  getFourPlayerLegalMoves,
  isFourPlayerKingInCheck,
  isPlayableFourPlayerSquare,
  type FourPlayerColor,
  type FourPlayerSquare,
  type FourPlayerState,
} from "../../../games/chess/variants/fourPlayerChess";
import { chooseFourPlayerAiMove } from "../../../games/chess/ai/fourPlayerAi";
import { type Difficulty } from "../../../games/chess/ai/variantAi";

const translations: Partial<TranslationTable> = {
  de: {
    "Four Player Chess": "Vier-Spieler-Schach",
    "Four armies. One cross-shaped board. Last player standing wins.":
      "Vier Armeen. Ein kreuzförmiges Brett. Der letzte aktive Spieler gewinnt.",
    "Local four-player game": "Lokales Spiel für vier Spieler",
    "Clockwise turn order": "Zugreihenfolge im Uhrzeigersinn",
    "Four-way free-for-all": "Jeder gegen jeden zu viert",
    "Turn order: Red → Blue → Yellow → Green.":
      "Zugreihenfolge: Rot → Blau → Gelb → Grün.",
    "Each army has the normal 16 chess pieces.":
      "Jede Armee hat die normalen 16 Schachfiguren.",
    "Pawns move toward the opposite side of the cross.":
      "Bauern ziehen zur gegenüberliegenden Seite des Kreuzes.",
    "No castling and no en-passant.": "Keine Rochade und kein en passant.",
    "A pawn reaching the opposite outer edge automatically becomes a Queen.":
      "Ein Bauer am gegenüberliegenden Außenrand wird automatisch zur Dame.",
    "You may not leave your own King in check.":
      "Der eigene König darf nicht im Schach bleiben.",
    "A checkmated or stalemated player is eliminated and all of their pieces disappear.":
      "Ein matt- oder pattgesetzter Spieler scheidet aus; alle seine Figuren verschwinden.",
    "The last active player wins.": "Der letzte aktive Spieler gewinnt.",
    "14 × 14 cross": "14 × 14 Kreuz",
    "The four 3×3 corners are outside the board. Sliding pieces cannot move through them. Each army enters from one arm of the cross.":
      "Die vier 3×3-Ecken gehören nicht zum Brett. Linienfiguren können sie nicht durchqueren. Jede Armee startet an einem Arm des Kreuzes.",
    "to move": "am Zug",
    CHECK: "SCHACH",
    turns: "Züge",
    wins: "gewinnt",
    "Red moves first.": "Rot beginnt.",
    "was checkmated and eliminated.": "wurde mattgesetzt und eliminiert.",
    "was stalemated and eliminated.": "wurde pattgesetzt und eliminiert.",
    "promoted a pawn to Queen.": "hat einen Bauern zur Dame umgewandelt.",
    "castled.": "hat rochiert.",
  },
  bar: {
    "Four Player Chess": "Vier-Spieler-Schach",
    "Local four-player game": "Lokals Spiel für vier",
    "Clockwise turn order": "Zugreih im Uhrzeigersinn",
    "to move": "is dro",
    CHECK: "SCHACH",
    turns: "Züg",
    wins: "gwinnt",
    "was checkmated and eliminated.": "is matt und ausgschiedn.",
    "was stalemated and eliminated.": "is patt und ausgschiedn.",
    "promoted a pawn to Queen.": "hat an Baua zur Dame gmocht.",
    "castled.": "hat rochiert.",
  },
  ko: {
    "Four Player Chess": "4인 체스",
    "Four armies. One cross-shaped board. Last player standing wins.":
      "네 군대가 십자형 보드에서 싸우며 마지막 생존자가 승리합니다.",
    "Local four-player game": "로컬 4인 게임",
    "Clockwise turn order": "시계 방향 차례",
    "Four-way free-for-all": "4인 개인전",
    "Turn order: Red → Blue → Yellow → Green.":
      "차례: 빨강 → 파랑 → 노랑 → 초록.",
    "Each army has the normal 16 chess pieces.":
      "각 군대는 표준 16기물을 가집니다.",
    "Pawns move toward the opposite side of the cross.":
      "폰은 십자 보드의 반대편을 향해 이동합니다.",
    "No castling and no en-passant.": "캐슬링과 앙파상은 없습니다.",
    "A pawn reaching the opposite outer edge automatically becomes a Queen.":
      "폰이 반대편 외곽에 도달하면 자동으로 퀸이 됩니다.",
    "You may not leave your own King in check.":
      "자신의 킹을 체크 상태로 둘 수 없습니다.",
    "A checkmated or stalemated player is eliminated and all of their pieces disappear.":
      "체크메이트 또는 스테일메이트된 플레이어는 탈락하고 모든 기물이 사라집니다.",
    "The last active player wins.": "마지막 활성 플레이어가 승리합니다.",
    "14 × 14 cross": "14 × 14 십자형",
    "The four 3×3 corners are outside the board. Sliding pieces cannot move through them. Each army enters from one arm of the cross.":
      "네 개의 3×3 모서리는 보드 밖입니다. 장거리 기물은 그곳을 통과할 수 없으며 각 군대는 십자의 한쪽 팔에서 시작합니다.",
    "to move": "차례",
    CHECK: "체크",
    turns: "턴",
    wins: "승리",
    "Red moves first.": "빨강이 먼저 둡니다.",
    "was checkmated and eliminated.": "체크메이트되어 탈락했습니다.",
    "was stalemated and eliminated.": "스테일메이트되어 탈락했습니다.",
    "promoted a pawn to Queen.": "폰을 퀸으로 승격했습니다.",
    "castled.": "캐슬링했습니다.",
  },
  ru: {
    "Four Player Chess": "Шахматы на четверых",
    "Four armies. One cross-shaped board. Last player standing wins.":
      "Четыре армии на крестообразной доске. Побеждает последний оставшийся игрок.",
    "Local four-player game": "Локальная игра на четверых",
    "Clockwise turn order": "Порядок хода по часовой стрелке",
    "Four-way free-for-all": "Каждый за себя",
    "Turn order: Red → Blue → Yellow → Green.":
      "Порядок: Красный → Синий → Жёлтый → Зелёный.",
    "Each army has the normal 16 chess pieces.":
      "У каждой армии обычные 16 фигур.",
    "Pawns move toward the opposite side of the cross.":
      "Пешки идут к противоположной стороне креста.",
    "No castling and no en-passant.": "Нет рокировки и взятия на проходе.",
    "A pawn reaching the opposite outer edge automatically becomes a Queen.":
      "Пешка на противоположном краю автоматически становится ферзём.",
    "You may not leave your own King in check.":
      "Нельзя оставлять своего короля под шахом.",
    "A checkmated or stalemated player is eliminated and all of their pieces disappear.":
      "Игрок при мате или пате выбывает, все его фигуры исчезают.",
    "The last active player wins.": "Последний активный игрок побеждает.",
    "14 × 14 cross": "Крест 14 × 14",
    "The four 3×3 corners are outside the board. Sliding pieces cannot move through them. Each army enters from one arm of the cross.":
      "Четыре угла 3×3 находятся вне доски. Дальнобойные фигуры не могут проходить через них. Каждая армия стартует с одного луча креста.",
    "to move": "ходит",
    CHECK: "ШАХ",
    turns: "ходов",
    wins: "побеждает",
    "Red moves first.": "Красный ходит первым.",
    "was checkmated and eliminated.": "получил мат и выбыл.",
    "was stalemated and eliminated.": "получил пат и выбыл.",
    "promoted a pawn to Queen.": "превратил пешку в ферзя.",
    "castled.": "сделал рокировку.",
  },
};

const playerStyles: Record<
  FourPlayerColor,
  {
    text: string;
    soft: string;
    border: string;
  }
> = {
  red: {
    text: "text-red-300",
    soft: "bg-red-400/10",
    border: "border-red-400/20",
  },
  blue: {
    text: "text-sky-300",
    soft: "bg-sky-400/10",
    border: "border-sky-400/20",
  },
  yellow: {
    text: "text-amber-200",
    soft: "bg-amber-300/10",
    border: "border-amber-300/20",
  },
  green: {
    text: "text-emerald-300",
    soft: "bg-emerald-400/10",
    border: "border-emerald-400/20",
  },
};

type HistoryEntry = {
  index: number;
  state: FourPlayerState;
  notation: string;
};

function sameSquare(a: FourPlayerSquare, b: FourPlayerSquare) {
  return a.row === b.row && a.column === b.column;
}

function moveNotation(state: FourPlayerState) {
  const move = state.lastMove;

  if (!move) {
    return "";
  }

  if (move.castle) return move.castle === "king" ? "O-O" : "O-O-O";
  const capture = move.captured ? "×" : "–";
  const promotion = move.promoted ? "=Q" : "";

  return `${fourPlayerSquareName(move.from)}${capture}${fourPlayerSquareName(
    move.to,
  )}${promotion}`;
}

function translateFourPlayerEvent(
  text: string | null,
  t: (key: string) => string,
) {
  if (!text) return text;
  if (text === "Red moves first.") return t(text);

  const color = "(Red|Blue|Yellow|Green)";
  let match = text.match(new RegExp(`^${color} is in check\.$`));
  if (match) return `${t(match[1])} · ${t("CHECK")}`;

  match = text.match(new RegExp(`^${color} was checkmated and eliminated\.$`));
  if (match) return `${t(match[1])} ${t("was checkmated and eliminated.")}`;

  match = text.match(new RegExp(`^${color} was stalemated and eliminated\.$`));
  if (match) return `${t(match[1])} ${t("was stalemated and eliminated.")}`;

  match = text.match(new RegExp(`^${color} wins the game\.$`));
  if (match) return `${t(match[1])} ${t("wins")}.`;

  match = text.match(new RegExp(`^${color} castled\.$`));
  if (match) return `${t(match[1])} ${t("castled.")}`;

  match = text.match(new RegExp(`^${color} promoted a pawn to Queen\.$`));
  if (match) return `${t(match[1])} ${t("promoted a pawn to Queen.")}`;

  return text;
}

type FourPlayerAiProps = {
  aiMode?: boolean;
  humanColor?: FourPlayerColor;
  difficulty?: Difficulty;
  onChangeSettings?: () => void;
};

export default function FourPlayerChess({
  aiMode = false,
  humanColor = "red",
  difficulty = "casual",
}: FourPlayerAiProps) {
  useUiLanguage();
  const { language } = useChessLanguage();
  const t = (key: string) => translateChess(language, key, translations);
  const [state, setState] = useState<FourPlayerState>(
    createInitialFourPlayerState,
  );

  const [undoStack, setUndoStack] = useState<FourPlayerState[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  const aiMovePendingRef = useRef(false);

  useEffect(() => {
    if (
      !aiMode ||
      aiMovePendingRef.current ||
      state.winner ||
      state.turn === humanColor
    ) {
      return;
    }

    aiMovePendingRef.current = true;

    const timer = window.setTimeout(() => {
      try {
        const move = chooseFourPlayerAiMove(state, difficulty);

        if (!move || state.turn === humanColor || state.winner) {
          return;
        }

        commitMove(move.from, move.to);
      } finally {
        aiMovePendingRef.current = false;
      }
    }, 260);

    return () => {
      window.clearTimeout(timer);
      // Needed when the human is not Red: StrictMode cancels the first
      // development timer once, so release the pending guard for the real run.
      aiMovePendingRef.current = false;
    };
  }, [aiMode, humanColor, difficulty, state]);

  const [selectedSquare, setSelectedSquare] = useState<FourPlayerSquare | null>(
    null,
  );

  const legalMoves = useMemo(
    () =>
      selectedSquare ? getFourPlayerLegalMoves(state, selectedSquare) : [],
    [state, selectedSquare],
  );

  const checkedKingSquare = useMemo(() => {
    if (!isFourPlayerKingInCheck(state.board, state.turn)) {
      return null;
    }

    for (let row = 0; row < 14; row += 1) {
      for (let column = 0; column < 14; column += 1) {
        const piece = state.board[row][column];

        if (piece?.color === state.turn && piece.type === "k") {
          return { row, column };
        }
      }
    }

    return null;
  }, [state]);

  function commitMove(from: FourPlayerSquare, to: FourPlayerSquare) {
    const previous = cloneFourPlayerState(state);
    const next = applyFourPlayerMove(state, from, to);

    if (next === state || next.moveCount === state.moveCount) {
      return false;
    }

    setUndoStack((stack) => [...stack, previous]);

    setHistory((items) => [
      ...items,
      {
        index: items.length + 1,
        state: cloneFourPlayerState(next),
        notation: moveNotation(next),
      },
    ]);

    setState(next);
    setSelectedSquare(null);

    return true;
  }

  function selectOrMove(row: number, column: number) {
    if (aiMode && state.turn !== humanColor) return;

    if (state.winner || !isPlayableFourPlayerSquare(row, column)) {
      return;
    }

    const square = { row, column };
    const piece = state.board[row][column];

    if (!selectedSquare) {
      if (piece?.color === state.turn) {
        setSelectedSquare(square);
      }

      return;
    }

    if (piece?.color === state.turn) {
      setSelectedSquare(square);
      return;
    }

    if (!legalMoves.some((target) => sameSquare(target, square))) {
      setSelectedSquare(null);
      return;
    }

    commitMove(selectedSquare, square);
  }

  function undo() {
    const previous = undoStack[undoStack.length - 1];

    if (!previous) {
      return;
    }

    setState(cloneFourPlayerState(previous));
    setUndoStack((stack) => stack.slice(0, -1));
    setHistory((items) => items.slice(0, -1));
    setSelectedSquare(null);
  }

  function restart() {
    setState(createInitialFourPlayerState());
    setUndoStack([]);
    setHistory([]);
    setSelectedSquare(null);
  }

  return (
    <div className="chess-variant-page min-h-[var(--app-height)] bg-transparent px-4 py-6 text-zinc-100 sm:px-6">
      <div className="mx-auto max-w-[1780px]">
        <ChessPageHeader className="mb-6 rounded-3xl border border-white/5 bg-zinc-900/70 px-5 py-4 shadow-xl shadow-black/20">
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-fuchsia-300">
            {t("Chess Variant")}
          </p>

          <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-2xl font-black text-white">
                {t("Four Player Chess")}
              </h1>

              <p className="mt-1 text-sm text-zinc-500">
                {t(
                  "Four armies. One cross-shaped board. Last player standing wins.",
                )}
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              {!state.winner && (
                <div
                  className={`rounded-full border px-3 py-1.5 text-xs font-black ${
                    playerStyles[state.turn].border
                  } ${playerStyles[state.turn].soft} ${
                    playerStyles[state.turn].text
                  }`}
                >
                  {t(fourPlayerLabel(state.turn))} {t("to move")}
                  {gameUi(isFourPlayerKingInCheck(state.board, state.turn) ? ` · ${t("CHECK")}` : "")}
                </div>
              )}
            </div>
          </div>
        </ChessPageHeader>

        <main className="grid gap-5 chess-game-grid four-player-game-grid xl:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="min-w-0">
            <div className="space-y-4 xl:sticky xl:top-6">
              <Panel gameControls
                title={t("Game Controls")}
                subtitle={t("Local four-player game")}
              >
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={undo}
                    disabled={undoStack.length === 0 || aiMode}
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-xs font-black text-zinc-300 hover:bg-white/10 disabled:cursor-not-allowed
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
                    onClick={restart}
                    className="rounded-xl border border-fuchsia-300/20 bg-fuchsia-400/10 px-3 py-2.5 text-xs font-black text-fuchsia-200 hover:bg-fuchsia-400/20"
                  >
                    ↻ {t("Restart")}
                  </button>
                </div>
              </Panel>

              <Panel
                title={t("Move History")}
                subtitle={gameUi(`${history.length} ${t("turns")}`)}
              >
                <ChessMoveHistoryList
                  sides={FOUR_PLAYER_HISTORY_SIDES}
                  newestFirst
                  listClassName="max-h-80 rounded-xl border border-white/5 bg-black/20"
                  emptyLabel={t("No moves yet")}
                  entries={history.map((entry) => ({
                    ply: entry.index,
                    side: entry.state.lastMove?.color ?? null,
                    title: entry.notation,
                    content: <span className="truncate font-mono text-[10px] font-bold text-zinc-300">{gameUi(entry.notation)}</span>,
                  }))}
                />
              </Panel>
            </div>
          </aside>

          <section className="mx-auto w-full min-w-0">
            {state.event && (
              <div className="mb-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-center text-xs font-bold text-zinc-400">
                {gameUi(translateFourPlayerEvent(state.event, t))}
              </div>
            )}

            {state.winner && (
              <VisibleGameResult
                actions={
                  <button
                    type="button"
                    onClick={restart}
                    className="mt-5 rounded-xl bg-white px-4 py-2.5 text-sm font-black text-zinc-950"
                  >
                    {t("Play again")}
                  </button>
                }
              />
            )}

            <div className="relative">
              <FourPlayerBoard
                state={state}
                viewerColor={aiMode ? humanColor : "red"}
                humanColor={aiMode ? humanColor : null}
                aiMode={aiMode}
                selectedSquare={selectedSquare}
                legalMoves={legalMoves}
                checkedKingSquare={checkedKingSquare}
                onSquareClick={selectOrMove}
              />
            </div>
          </section>

        </main>
      </div>
    </div>
  );
}

function FourPlayerBoard({
  state,
  viewerColor,
  humanColor,
  aiMode,
  selectedSquare,
  legalMoves,
  checkedKingSquare,
  onSquareClick,
}: {
  state: FourPlayerState;
  viewerColor: FourPlayerColor;
  humanColor: FourPlayerColor | null;
  aiMode: boolean;
  selectedSquare: FourPlayerSquare | null;
  legalMoves: FourPlayerSquare[];
  checkedKingSquare: FourPlayerSquare | null;
  onSquareClick: (row: number, column: number) => void;
}) {
  useUiLanguage();
  const { boardTheme } = useChessSettings();
  const colors = boardColors[boardTheme];

  function boardSquareForViewer(row: number, column: number): FourPlayerSquare {
    switch (viewerColor) {
      case "yellow":
        return { row: 13 - row, column: 13 - column };
      case "blue":
        return { row: column, column: 13 - row };
      case "green":
        return { row: 13 - column, column: row };
      case "red":
        return { row, column };
    }
  }

  const cornerSlots = [
    { row: 0, column: 0 },
    { row: 0, column: 11 },
    { row: 11, column: 0 },
    { row: 11, column: 11 },
  ].map((slot) => {
    const original = boardSquareForViewer(slot.row, slot.column);
    const color: FourPlayerColor = original.row < 3
      ? (original.column < 3 ? "yellow" : "green")
      : (original.column < 3 ? "blue" : "red");
    return { ...slot, color };
  });

  const frameRef = useChessBoardFit();
  return (
    <div ref={frameRef} className="chess-board-frame w-full rounded-[28px] border p-2 shadow-[0_30px_80px_rgba(0,0,0,0.55)] sm:p-3" style={{ borderColor: colors.frame, backgroundColor: colors.frame }}>
      <div className="rounded-[18px] border border-black/40 p-1 shadow-inner sm:p-1.5" style={{ backgroundColor: colors.frame }}>
        <div
          className="grid aspect-square w-full overflow-hidden rounded-xl bg-zinc-950 shadow-[0_12px_30px_rgba(0,0,0,0.45)]"
          style={{
            gridTemplateColumns: "repeat(14, minmax(0, 1fr))",
            gridTemplateRows: "repeat(14, minmax(0, 1fr))",
          }}
        >
          {cornerSlots.map((slot) => (
            <div
              key={slot.color}
              style={{
                gridColumn: `${slot.column + 1} / span 3`,
                gridRow: `${slot.row + 1} / span 3`,
              }}
              className={`relative z-10 flex min-w-0 flex-col justify-between overflow-hidden border p-1.5 shadow-inner sm:p-2.5 ${playerStyles[slot.color].border} ${playerStyles[slot.color].soft} ${state.activePlayers.includes(slot.color) ? "" : "opacity-40"} ${!state.winner && state.turn === slot.color ? "ring-2 ring-inset ring-white/80" : ""}`}
            >
              <div className="flex items-start justify-between gap-1">
                <span className={`text-[8px] font-black uppercase tracking-[0.14em] sm:text-[10px] ${playerStyles[slot.color].text}`}>
                  {gameUi(fourPlayerLabel(slot.color))}
                </span>
                {!state.winner && state.turn === slot.color && <span className="rounded bg-white/20 px-1 text-[7px] font-black text-white sm:text-[9px]">{ui("Turn")}</span>}
              </div>
              <span className="text-[9px] font-bold text-zinc-100 sm:text-xs">
                {gameUi(!state.activePlayers.includes(slot.color) ? ui("Eliminated") : aiMode ? (humanColor === slot.color ? ui("YOU") : ui("AI bot")) : ui("Player"))}
              </span>
            </div>
          ))}
          {Array.from({ length: 14 }, (_, row) =>
            Array.from({ length: 14 }, (_, column) => {
              const square = boardSquareForViewer(row, column);
              if (!isPlayableFourPlayerSquare(square.row, square.column))
                return null;

              const piece = state.board[square.row][square.column];

              const selected =
                selectedSquare && sameSquare(selectedSquare, square);

              const legal = legalMoves.some((target) =>
                sameSquare(target, square),
              );

              const last =
                state.lastMove &&
                (sameSquare(state.lastMove.from, square) ||
                  sameSquare(state.lastMove.to, square));

              const checked =
                checkedKingSquare && sameSquare(checkedKingSquare, square);

              const light = (square.row + square.column) % 2 === 0;

              return (
                <button
                  key={`${row}-${column}`}
                  type="button"
                  aria-label={gameUi(fourPlayerSquareName(square))}
                  onClick={() => onSquareClick(square.row, square.column)}
                  className={`group relative flex aspect-square items-center justify-center overflow-hidden border-0 p-0 transition ${selected ? "z-10 ring-4 ring-inset ring-fuchsia-300" : ""}`}
                  style={{ backgroundColor: light ? colors.light : colors.dark }}
                >
                  {last && (
                    <span className="pointer-events-none absolute inset-0 z-[2] bg-yellow-300/25" />
                  )}

                  {checked && (
                    <span className="pointer-events-none absolute inset-0 z-[3] bg-[radial-gradient(circle,rgba(239,68,68,0.85)_0%,rgba(185,28,28,0.52)_45%,rgba(127,29,29,0.05)_80%)] shadow-[inset_0_0_20px_rgba(239,68,68,0.85)]" />
                  )}

                  {legal && !piece && (
                    <span className="pointer-events-none absolute z-[6] h-[26%] w-[26%] rounded-full bg-black/35" />
                  )}

                  {legal && piece && (
                    <span className="pointer-events-none absolute inset-[7%] z-[6] rounded-full border-[3px] border-black/30" />
                  )}

                  {piece && <FourPlayerThemedPiece piece={piece} />}
                </button>
              );
            }),
          )}
        </div>
      </div>
    </div>
  );
}

function Panel({
  gameControls = false,
  title,
  subtitle,
  children,
}: {
  gameControls?: boolean;
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  useUiLanguage();
  return (
    <section data-chess-controls={gameControls || undefined} className="rounded-3xl border border-white/5 bg-zinc-900/75 p-4 shadow-xl shadow-black/20 backdrop-blur-md">
      <h2 className="font-black text-zinc-100">{ui(title)}</h2>
      <p className="mt-1 mb-4 text-xs text-zinc-600">{ui(subtitle)}</p>
      {gameUi(children)}
    </section>
  );
}
