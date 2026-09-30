import VisibleGameResult from "@/components/chess/VisibleGameResult";
import ChessPageHeader from "@/components/chess/ChessPageHeader";
import ChessMoveHistoryList from "../ChessMoveHistoryList";
import { ui, useUiLanguage } from "@/i18n/ui";
import { useRef, useEffect, useMemo, useState } from "react";
import {
  translateChess,
  useChessLanguage,
  type TranslationTable,
} from "../../../games/chess/i18n/chessLanguage.tsx";

import { Chess, type Square } from "chess.js";

import Board from "./Board.tsx";
import PromotionBar from "./PromotionBar";

import { getSquareName, type PieceType } from "../../../utils/chessUtils.ts";

import {
  playPieceCaptureSound,
  playPieceMoveSound,
  playPieceSelectSound,
} from "../../../utils/sound.ts";

import { useDelayedBoardOrientation } from "@/hooks/useDelayedBoardOrientation.ts";

import {
  BOSS_MAX_HP,
  BOSS_MAX_RAGE,
  BOSS_STARTING_FEN,
  bossPowerIcon,
  bossPowerLabel,
  bossRepetitionKey,
  canUseBossPower,
  cloneBossBattleState,
  completeOrdinaryPly,
  createInitialBossBattleState,
  damageBoss,
  findKingSquare,
  getBossPowerCooldown,
  getBossRage,
  getDarkStepSquares,
  getSummonSquares,
  isThreefoldBossBattle,
  useDarkStepPower,
  useShockwavePower,
  useSummonPower,
  type BossBattleState,
  type BossPowerId,
  type BossSide,
  type BossTargetMode,
  type BossWinner,
} from "../../../games/chess/variants/bossBattle.ts";
import { useVariantChessAi } from "@/hooks/useVariantChessAi";
import { chooseBossAiPower } from "../../../games/chess/ai/bossBattleAi.ts";
import {
  chessColorFromPlayerColor,
  oppositeChessColor,
  type Difficulty,
  type ChessPlayerColor,
} from "../../../games/chess/ai/variantAi.ts";

const translations: Partial<TranslationTable> = {
  de: {
    "Boss Battle Chess": "Boss-Battle-Schach",
    "One normal army versus a five-life Boss with powers":
      "Eine normale Armee gegen einen Boss mit fünf Leben und Kräften",
    Rage: "Rage",
    "Boss to move": "Boss am Zug",
    Boss: "Boss",
    "Boss player": "Boss-Spieler",
    "Moves and Boss powers": "Züge und Boss-Kräfte",
    "No actions yet": "Noch keine Aktionen",
    "Boss Power Targeting": "Boss-Kraft: Zielwahl",
    "Choose a pawn summon square": "Wähle ein Feld zum Beschwören eines Bauern",
    "Choose a Dark Step destination": "Wähle ein Ziel für Dark Step",
    Cancel: "Abbrechen",
    "Boss checkmated. White wins!": "Boss mattgesetzt. Weiß gewinnt!",
    "White king checkmated. The Boss wins!":
      "Weißer König mattgesetzt. Der Boss gewinnt!",
    "The Boss has lost all 5 HP. White wins!":
      "Der Boss hat alle 5 HP verloren. Weiß gewinnt!",
    "Stalemate. Draw.": "Patt. Remis.",
    "50-move rule. Draw.": "50-Züge-Regel. Remis.",
    "Threefold repetition. Draw.": "Dreifache Wiederholung. Remis.",
    "Check the Boss to remove HP. Checkmate also wins instantly.":
      "Gib dem Boss Schach, um HP zu entfernen. Matt gewinnt ebenfalls sofort.",
    "Checkmate the White king. Powers replace a normal Boss turn.":
      "Setze den weißen König matt. Kräfte ersetzen einen normalen Boss-Zug.",
    Armor: "Rüstung",
    "After losing HP, the Boss ignores HP damage for 2 completed plies.":
      "Nach HP-Verlust ignoriert der Boss 2 Halbzüge lang weiteren HP-Schaden.",
    "Boss Status": "Boss-Status",
    "Health, armor and rage": "Leben, Rüstung und Rage",
    Off: "Aus",
    plies: "Halbzüge",
    Summons: "Beschwörungen",
    "Boss turns": "Boss-Züge",
    "Rage increases every 4 completed Boss turns and reduces future power cooldowns by 1 per level, to a minimum of 2.":
      "Rage steigt alle 4 Boss-Züge und verkürzt künftige Abklingzeiten pro Stufe um 1, mindestens auf 2.",
    "Boss Powers": "Boss-Kräfte",
    "Using a power ends Black’s turn": "Eine Kraft beendet den schwarzen Zug",
    "The Boss is in check — powers are locked until the check is answered normally.":
      "Der Boss steht im Schach — Kräfte sind gesperrt, bis das Schach normal beantwortet wurde.",
    Shockwave: "Shockwave",
    Summon: "Summon",
    "Dark Step": "Dark Step",
    "Push adjacent White pieces outward":
      "Benachbarte weiße Figuren nach außen schieben",
    "Spawn a Black pawn on rank 6 or 7":
      "Schwarzen Bauern auf Reihe 6 oder 7 erzeugen",
    "Relocate the Boss up to two squares": "Boss bis zu zwei Felder versetzen",
    turns: "Züge",
    Choose: "Wählen",
    Ready: "Bereit",
    "Cooldown when used now:": "Abklingzeit bei Nutzung jetzt:",
    "Boss turns suffix": "Boss-Züge",
    "White starts with the normal full chess army.":
      "Weiß startet mit der normalen vollständigen Armee.",
    "Black starts with the Boss, six pawns, one knight and one bishop.":
      "Schwarz startet mit Boss, sechs Bauern, einem Springer und einem Läufer.",
    "A non-mating White check removes 1 Boss HP when armor is inactive.":
      "Ein weißes Schach ohne Matt entfernt 1 Boss-HP, wenn keine Rüstung aktiv ist.",
    "After taking damage, the Boss gains 2 completed plies of HP-damage immunity. Check rules still apply.":
      "Nach Schaden erhält der Boss 2 Halbzüge Immunität gegen HP-Schaden. Schachregeln gelten weiter.",
    "Boss HP 0 or Boss checkmate = White wins. White checkmate = Boss wins.":
      "Boss-HP 0 oder Boss-Matt = Weiß gewinnt. Weiß-Matt = Boss gewinnt.",
    "Shockwave pushes adjacent non-king White pieces one square away when the destination is free.":
      "Shockwave schiebt benachbarte weiße Nicht-Königsfiguren ein Feld weg, wenn das Ziel frei ist.",
    "Summon places a Black pawn on an empty square of rank 6 or 7.":
      "Summon setzt einen schwarzen Bauern auf ein freies Feld der Reihe 6 oder 7.",
    "Dark Step relocates the Boss up to two squares to a safe empty square.":
      "Dark Step versetzt den Boss bis zu zwei Felder auf ein sicheres freies Feld.",
    "Rage rises over time and shortens power cooldowns.":
      "Rage steigt mit der Zeit und verkürzt Abklingzeiten.",
  },
  bar: {
    "Boss Battle Chess": "Boss-Battle-Schach",
    "Boss to move": "Boss is dro",
    "Boss player": "Boss-Spiela",
    "Boss Status": "Boss-Status",
    "Boss Powers": "Boss-Kräfte",
    Cancel: "Abbrechn",
    Choose: "Wähln",
    Ready: "Bereit",
    turns: "Züg",
    plies: "Halbzüg",
  },
  ko: {
    "Boss Battle Chess": "보스 배틀 체스",
    "One normal army versus a five-life Boss with powers":
      "일반 군대 하나 대 다섯 목숨과 능력을 가진 보스",
    Rage: "분노",
    "Boss to move": "보스 차례",
    Boss: "보스",
    "Boss player": "보스 플레이어",
    "Moves and Boss powers": "일반 수와 보스 능력",
    "No actions yet": "아직 행동이 없습니다",
    "Boss Power Targeting": "보스 능력 목표 선택",
    "Choose a pawn summon square": "폰을 소환할 칸을 선택하세요",
    "Choose a Dark Step destination": "다크 스텝 목적지를 선택하세요",
    Cancel: "취소",
    "Boss checkmated. White wins!": "보스 체크메이트. 백 승리!",
    "White king checkmated. The Boss wins!": "백 킹 체크메이트. 보스 승리!",
    "The Boss has lost all 5 HP. White wins!":
      "보스가 5 HP를 모두 잃었습니다. 백 승리!",
    "Stalemate. Draw.": "스테일메이트. 무승부.",
    "50-move rule. Draw.": "50수 규칙. 무승부.",
    "Threefold repetition. Draw.": "3회 동형 반복. 무승부.",
    "Check the Boss to remove HP. Checkmate also wins instantly.":
      "보스에게 체크를 주면 HP가 감소하고 체크메이트는 즉시 승리합니다.",
    "Checkmate the White king. Powers replace a normal Boss turn.":
      "백 킹을 체크메이트하세요. 능력은 일반 보스 턴을 대신합니다.",
    Armor: "방어막",
    "After losing HP, the Boss ignores HP damage for 2 completed plies.":
      "HP를 잃은 뒤 보스는 2하프무브 동안 HP 피해를 무시합니다.",
    "Boss Status": "보스 상태",
    "Health, armor and rage": "체력, 방어막, 분노",
    Off: "꺼짐",
    plies: "하프무브",
    Summons: "소환 횟수",
    "Boss turns": "보스 턴",
    "Rage increases every 4 completed Boss turns and reduces future power cooldowns by 1 per level, to a minimum of 2.":
      "보스턴 4회마다 분노가 상승하고 레벨당 이후 능력 쿨다운이 1 줄며 최소 2입니다.",
    "Boss Powers": "보스 능력",
    "Using a power ends Black’s turn": "능력을 사용하면 흑 턴이 끝납니다",
    "The Boss is in check — powers are locked until the check is answered normally.":
      "보스가 체크 상태입니다 — 일반 수로 체크를 해소할 때까지 능력을 사용할 수 없습니다.",
    Shockwave: "쇼크웨이브",
    Summon: "소환",
    "Dark Step": "다크 스텝",
    "Push adjacent White pieces outward": "인접 백 기물을 바깥으로 밀기",
    "Spawn a Black pawn on rank 6 or 7": "6/7랭크에 흑 폰 생성",
    "Relocate the Boss up to two squares": "보스를 최대 두 칸 이동",
    turns: "턴",
    Choose: "선택",
    Ready: "준비됨",
    "Cooldown when used now:": "지금 사용 시 쿨다운:",
    "Boss turns suffix": "보스 턴",
    "White starts with the normal full chess army.":
      "백은 표준 전체 군대로 시작합니다.",
    "Black starts with the Boss, six pawns, one knight and one bishop.":
      "흑은 보스, 폰 6, 나이트 1, 비숍 1로 시작합니다.",
    "A non-mating White check removes 1 Boss HP when armor is inactive.":
      "방어막이 없을 때 체크메이트가 아닌 백의 체크는 보스 HP 1을 깎습니다.",
    "After taking damage, the Boss gains 2 completed plies of HP-damage immunity. Check rules still apply.":
      "피해 후 보스는 2하프무브 동안 HP 피해 면역을 얻지만 체크 규칙은 그대로 적용됩니다.",
    "Boss HP 0 or Boss checkmate = White wins. White checkmate = Boss wins.":
      "보스 HP 0 또는 보스 체크메이트면 백 승리, 백 체크메이트면 보스 승리입니다.",
    "Shockwave pushes adjacent non-king White pieces one square away when the destination is free.":
      "쇼크웨이브는 인접 백 비킹 기물을 목적지가 비어 있을 때 한 칸 밀어냅니다.",
    "Summon places a Black pawn on an empty square of rank 6 or 7.":
      "소환은 6 또는 7랭크의 빈 칸에 흑 폰을 만듭니다.",
    "Dark Step relocates the Boss up to two squares to a safe empty square.":
      "다크 스텝은 보스를 최대 두 칸 떨어진 안전한 빈 칸으로 이동합니다.",
    "Rage rises over time and shortens power cooldowns.":
      "분노는 시간이 지나며 상승하고 능력 쿨다운을 줄입니다.",
  },
  ru: {
    "Boss Battle Chess": "Шахматы: Битва с боссом",
    "One normal army versus a five-life Boss with powers":
      "Обычная армия против босса с пятью жизнями и силами",
    Rage: "Ярость",
    "Boss to move": "Ход босса",
    Boss: "Босс",
    "Boss player": "Игрок боссом",
    "Moves and Boss powers": "Ходы и силы босса",
    "No actions yet": "Действий пока нет",
    "Boss Power Targeting": "Выбор цели силы босса",
    "Choose a pawn summon square": "Выберите поле для призыва пешки",
    "Choose a Dark Step destination": "Выберите цель Dark Step",
    Cancel: "Отмена",
    "Boss checkmated. White wins!": "Босс получил мат. Белые победили!",
    "White king checkmated. The Boss wins!": "Белому королю мат. Босс победил!",
    "The Boss has lost all 5 HP. White wins!":
      "Босс потерял все 5 HP. Белые победили!",
    "Stalemate. Draw.": "Пат. Ничья.",
    "50-move rule. Draw.": "Правило 50 ходов. Ничья.",
    "Threefold repetition. Draw.": "Троекратное повторение. Ничья.",
    "Check the Boss to remove HP. Checkmate also wins instantly.":
      "Дайте шах боссу, чтобы снять HP. Мат тоже сразу побеждает.",
    "Checkmate the White king. Powers replace a normal Boss turn.":
      "Поставьте мат белому королю. Силы заменяют обычный ход босса.",
    Armor: "Броня",
    "After losing HP, the Boss ignores HP damage for 2 completed plies.":
      "После потери HP босс игнорирует HP-урон 2 полухода.",
    "Boss Status": "Статус босса",
    "Health, armor and rage": "Здоровье, броня и ярость",
    Off: "Выкл.",
    plies: "полуходов",
    Summons: "Призывы",
    "Boss turns": "Ходы босса",
    "Rage increases every 4 completed Boss turns and reduces future power cooldowns by 1 per level, to a minimum of 2.":
      "Ярость растёт каждые 4 хода босса и сокращает будущие перезарядки на 1 за уровень, минимум до 2.",
    "Boss Powers": "Силы босса",
    "Using a power ends Black’s turn":
      "Использование силы завершает ход чёрных",
    "The Boss is in check — powers are locked until the check is answered normally.":
      "Босс под шахом — силы заблокированы до обычного ответа на шах.",
    Shockwave: "Ударная волна",
    Summon: "Призыв",
    "Dark Step": "Тёмный шаг",
    "Push adjacent White pieces outward": "Оттолкнуть соседние белые фигуры",
    "Spawn a Black pawn on rank 6 or 7":
      "Создать чёрную пешку на 6-м или 7-м ряду",
    "Relocate the Boss up to two squares": "Переместить босса до двух клеток",
    turns: "ходов",
    Choose: "Выбрать",
    Ready: "Готово",
    "Cooldown when used now:": "Перезарядка при использовании сейчас:",
    "Boss turns suffix": "ходов босса",
    "White starts with the normal full chess army.":
      "Белые начинают полной стандартной армией.",
    "Black starts with the Boss, six pawns, one knight and one bishop.":
      "Чёрные начинают с босса, шести пешек, одного коня и одного слона.",
    "A non-mating White check removes 1 Boss HP when armor is inactive.":
      "Шах белых без мата снимает 1 HP босса, если броня не активна.",
    "After taking damage, the Boss gains 2 completed plies of HP-damage immunity. Check rules still apply.":
      "После урона босс получает иммунитет к HP-урону на 2 полухода. Шах всё равно действует.",
    "Boss HP 0 or Boss checkmate = White wins. White checkmate = Boss wins.":
      "0 HP босса или мат боссу = победа белых. Мат белым = победа босса.",
    "Shockwave pushes adjacent non-king White pieces one square away when the destination is free.":
      "Ударная волна толкает соседние белые фигуры кроме короля на одну клетку, если поле свободно.",
    "Summon places a Black pawn on an empty square of rank 6 or 7.":
      "Призыв ставит чёрную пешку на свободное поле ряда 6 или 7.",
    "Dark Step relocates the Boss up to two squares to a safe empty square.":
      "Тёмный шаг переносит босса до двух клеток на безопасное пустое поле.",
    "Rage rises over time and shortens power cooldowns.":
      "Ярость растёт со временем и сокращает перезарядки.",
  },
};

type PromotionPiece = "q" | "r" | "b" | "n";

type PendingPromotion = {
  from: Square;
  to: Square;
};

type FinishedGame = {
  winner: Exclude<BossWinner, null>;
  reason: "boss_hp" | "checkmate" | "stalemate" | "fifty" | "repetition";
} | null;

type BossHistoryEntry = {
  ply: number;
  moveNumber: number;
  color: BossSide;
  kind: "move" | "power";
  san: string;
  from: Square | null;
  to: Square | null;
  piece: PieceType | null;
  captured: PieceType | null;
  fenAfter: string;
  stateAfter: BossBattleState;
  bossDamaged: boolean;
  power: BossPowerId | null;
};

type UndoSnapshot = {
  fen: string;
  bossState: BossBattleState;
  lastMove: { from: Square; to: Square } | null;
  history: BossHistoryEntry[];
  capturedWhite: PieceType[];
  capturedBlack: PieceType[];
  finishedGame: FinishedGame;
};

function bossHearts(hp: number): string {
  return `${"♥".repeat(Math.max(0, hp))}${"♡".repeat(
    Math.max(0, BOSS_MAX_HP - hp),
  )}`;
}


function historySymbol(color: BossSide, piece: PieceType | null) {
  if (!piece) return color === "w" ? "♔" : "♚";

  const symbols: Record<BossSide, Record<PieceType, string>> = {
    w: { p: "♙", n: "♘", b: "♗", r: "♖", q: "♕", k: "♔" },
    b: { p: "♟", n: "♞", b: "♝", r: "♜", q: "♛", k: "♚" },
  };

  return symbols[color][piece];
}

function getFinish(
  game: Chess,
  bossState: BossBattleState,
  repetitionKeys: string[],
): FinishedGame {
  if (bossState.hp <= 0) {
    return { winner: "white", reason: "boss_hp" };
  }

  if (game.isCheckmate()) {
    return {
      winner: game.turn() === "w" ? "black" : "white",
      reason: "checkmate",
    };
  }

  if (game.isStalemate()) {
    /*
     * A stalemated Boss may still act if at least one power is available.
     * White has no powers, so White stalemate remains a normal draw.
     */
    if (game.turn() === "b") {
      const bossHasPower = (
        ["shockwave", "summon", "dark_step"] as BossPowerId[]
      ).some((power) => canUseBossPower(game, bossState, power));

      if (!bossHasPower) {
        return { winner: "draw", reason: "stalemate" };
      }
    } else {
      return { winner: "draw", reason: "stalemate" };
    }
  }

  if (game.isDrawByFiftyMoves()) {
    return { winner: "draw", reason: "fifty" };
  }

  if (isThreefoldBossBattle(repetitionKeys)) {
    return { winner: "draw", reason: "repetition" };
  }

  return null;
}

type VariantAiBoardProps = {
  aiMode?: boolean;
  playerColor?: ChessPlayerColor;
  difficulty?: Difficulty;
  onChangeSettings?: () => void;
};

export default function BossBattleBoard({
  aiMode = false,
  playerColor = "white",
  difficulty = "casual",
}: VariantAiBoardProps) {
  useUiLanguage();
  const { language } = useChessLanguage();
  const t = (key: string) => translateChess(language, key, translations);
  const [game, setGame] = useState(() => new Chess(BOSS_STARTING_FEN));

  const [bossState, setBossState] = useState<BossBattleState>(() =>
    createInitialBossBattleState(),
  );

  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [legalMoves, setLegalMoves] = useState<Square[]>([]);

  const [lastMove, setLastMove] = useState<{
    from: Square;
    to: Square;
  } | null>(null);

  const [pendingPromotion, setPendingPromotion] =
    useState<PendingPromotion | null>(null);

  const [bossTargetMode, setBossTargetMode] = useState<BossTargetMode>(null);

  const [finishedGame, setFinishedGame] = useState<FinishedGame>(null);

  const [history, setHistory] = useState<BossHistoryEntry[]>([]);
  const [historyPreviewPly, setHistoryPreviewPly] = useState<number | null>(
    null,
  );
  const [undoStack, setUndoStack] = useState<UndoSnapshot[]>([]);

  const [capturedWhite, setCapturedWhite] = useState<PieceType[]>([]);
  const [capturedBlack, setCapturedBlack] = useState<PieceType[]>([]);

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
      aiMovePendingRef.current ||
      finishedGame ||
      historyPreviewPly !== null ||
      pendingPromotion ||
      bossTargetMode ||
      game.turn() !== computerColor ||
      !aiReady
    ) {
      return;
    }

    const expectedFen = game.fen();
    let cancelled = false;
    aiMovePendingRef.current = true;

    const timer = window.setTimeout(async () => {
      try {
        /*
         * Only Black owns Boss powers. If Black is controlled by AI, let
         * the variant layer decide whether to spend the turn on a power.
         */
        if (computerColor === "b") {
          const powerAction = chooseBossAiPower(game, bossState, difficulty);

          if (powerAction) {
            if (
              !cancelled &&
              game.fen() === expectedFen &&
              game.turn() === "b"
            ) {
              commitPower(powerAction.power, powerAction.target);
            }

            return;
          }
        }

        if (!aiReady) {
          return;
        }

        const move = await chooseAiMove(game);

        if (
          cancelled ||
          !move ||
          game.fen() !== expectedFen ||
          game.turn() !== computerColor
        ) {
          return;
        }

        makeMove(move.from, move.to, move.promotion);
      } finally {
        aiMovePendingRef.current = false;
      }
    }, 240);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      // React StrictMode runs an extra setup/cleanup cycle in development.
      // Reset the guard so an AI-controlled White side can make the opening move.
      aiMovePendingRef.current = false;
    };
  }, [
    aiMode,
    aiReady,
    computerColor,
    difficulty,
    game,
    bossState,
    history.length,
    finishedGame,
    historyPreviewPly,
    pendingPromotion,
    bossTargetMode,
    chooseAiMove,
  ]);

  const {
    orientation: liveBoardOrientation,
    flipPending,
    snapToSide,
  } = useDelayedBoardOrientation(aiMode ? humanColor : game.turn(), 1500);

  const historyPreview =
    historyPreviewPly !== null
      ? (history[historyPreviewPly - 1] ?? null)
      : null;

  const historyPreviewChess = useMemo(
    () => (historyPreview ? new Chess(historyPreview.fenAfter) : null),
    [historyPreview?.fenAfter],
  );

  const displayedGame = historyPreviewChess ?? game;
  const displayedBossState = historyPreview?.stateAfter ?? bossState;
  const displayedBoard = displayedGame.board();

  const boardOrientation: "white" | "black" = historyPreviewChess
    ? historyPreviewChess.turn() === "w"
      ? "white"
      : "black"
    : liveBoardOrientation;

  const displayedLastMove = historyPreview
    ? historyPreview.from && historyPreview.to
      ? { from: historyPreview.from, to: historyPreview.to }
      : null
    : lastMove;

  const bossSquare = findKingSquare(displayedGame, "b");

  const checkedKingSquare = displayedGame.isCheck()
    ? findKingSquare(displayedGame, displayedGame.turn())
    : null;

  const rage = getBossRage(displayedBossState);

  const livePowerTargetSquares = useMemo(() => {
    if (historyPreview || finishedGame || flipPending) return [] as Square[];

    if (bossTargetMode === "summon") return getSummonSquares(game);
    if (bossTargetMode === "dark_step") return getDarkStepSquares(game);

    return [] as Square[];
  }, [bossTargetMode, finishedGame, flipPending, game, historyPreview]);

  const displayedPowerTargetMode = historyPreview ? null : bossTargetMode;

  const displayedPowerTargets = historyPreview ? [] : livePowerTargetSquares;

  const displayedShockwaveSquares =
    displayedBossState.lastPower === "shockwave"
      ? displayedBossState.lastPowerSquares
      : [];

  const repetitionKeys = useMemo(
    () => [
      bossRepetitionKey(
        new Chess(BOSS_STARTING_FEN),
        createInitialBossBattleState(),
      ),
      ...history.map((entry) =>
        bossRepetitionKey(new Chess(entry.fenAfter), entry.stateAfter),
      ),
    ],
    [history],
  );

  function clearSelection() {
    setSelectedSquare(null);
    setLegalMoves([]);
  }

  function clearPowerTarget() {
    setBossTargetMode(null);
  }

  function snapshotCurrentState(): UndoSnapshot {
    return {
      fen: game.fen(),
      bossState: cloneBossBattleState(bossState),
      lastMove,
      history: [...history],
      capturedWhite: [...capturedWhite],
      capturedBlack: [...capturedBlack],
      finishedGame,
    };
  }

  function selectPiece(square: Square) {
    if (
      finishedGame ||
      historyPreview ||
      pendingPromotion ||
      flipPending ||
      bossTargetMode
    ) {
      return;
    }

    const piece = game.get(square);

    if (!piece || piece.color !== game.turn()) {
      clearSelection();
      return;
    }

    const moves = game.moves({ square, verbose: true });

    setSelectedSquare(square);
    setLegalMoves(moves.map((move) => move.to as Square));
    playPieceSelectSound(piece.type);
  }

  function finalizeHistory(
    nextGame: Chess,
    nextBossState: BossBattleState,
    entry: Omit<
      BossHistoryEntry,
      "ply" | "moveNumber" | "fenAfter" | "stateAfter"
    >,
    nextCapturedWhite: PieceType[],
    nextCapturedBlack: PieceType[],
    snapshot: UndoSnapshot,
  ) {
    const ply = history.length + 1;

    const historyEntry: BossHistoryEntry = {
      ...entry,
      ply,
      moveNumber: Math.floor((ply - 1) / 2) + 1,
      fenAfter: nextGame.fen(),
      stateAfter: cloneBossBattleState(nextBossState),
    };

    const nextHistory = [...history, historyEntry];
    const nextKeys = [
      ...repetitionKeys,
      bossRepetitionKey(nextGame, nextBossState),
    ];

    const finish = getFinish(nextGame, nextBossState, nextKeys);

    setUndoStack((stack) => [...stack, snapshot]);
    setGame(nextGame);
    setBossState(nextBossState);
    setHistory(nextHistory);
    setCapturedWhite(nextCapturedWhite);
    setCapturedBlack(nextCapturedBlack);
    setHistoryPreviewPly(null);
    setPendingPromotion(null);
    clearSelection();
    clearPowerTarget();

    if (finish) setFinishedGame(finish);
  }

  function makeMove(
    from: Square,
    to: Square,
    promotion?: PromotionPiece,
  ): boolean {
    if (finishedGame || historyPreview || bossTargetMode) return false;

    const nextGame = new Chess(game.fen());

    let move;

    try {
      move = nextGame.move({
        from,
        to,
        ...(promotion ? { promotion } : {}),
      });
    } catch {
      return false;
    }

    if (!move) return false;

    const snapshot = snapshotCurrentState();
    let nextBossState = cloneBossBattleState(bossState);
    let bossDamaged = false;

    /*
     * Checkmate is immediate. A checkmated Boss cannot spend HP to survive.
     */
    if (!nextGame.isCheckmate()) {
      if (move.color === "w" && nextGame.isCheck()) {
        const damageResult = damageBoss(nextBossState);
        nextBossState = damageResult.state;
        bossDamaged = damageResult.damaged;
      } else {
        nextBossState = completeOrdinaryPly(
          nextBossState,
          move.color as BossSide,
        );
      }
    } else {
      nextBossState = completeOrdinaryPly(
        nextBossState,
        move.color as BossSide,
      );
    }

    let nextCapturedWhite = [...capturedWhite];
    let nextCapturedBlack = [...capturedBlack];

    if (move.captured) {
      playPieceCaptureSound(move.piece);

      if (move.color === "w") {
        nextCapturedBlack = [...nextCapturedBlack, move.captured as PieceType];
      } else {
        nextCapturedWhite = [...nextCapturedWhite, move.captured as PieceType];
      }
    } else {
      playPieceMoveSound(move.piece);
    }

    setLastMove({ from: move.from as Square, to: move.to as Square });

    finalizeHistory(
      nextGame,
      nextBossState,
      {
        color: move.color as BossSide,
        kind: "move",
        san: move.san,
        from: move.from as Square,
        to: move.to as Square,
        piece: move.piece as PieceType,
        captured: move.captured ? (move.captured as PieceType) : null,
        bossDamaged,
        power: null,
      },
      nextCapturedWhite,
      nextCapturedBlack,
      snapshot,
    );

    return true;
  }

  function commitPower(power: BossPowerId, target?: Square) {
    if (
      finishedGame ||
      historyPreview ||
      flipPending ||
      game.turn() !== "b" ||
      game.isCheck()
    ) {
      return;
    }

    const snapshot = snapshotCurrentState();

    const result =
      power === "shockwave"
        ? useShockwavePower(game, bossState)
        : power === "summon" && target
          ? useSummonPower(game, bossState, target)
          : power === "dark_step" && target
            ? useDarkStepPower(game, bossState, target)
            : null;

    if (!result) return;

    if (power === "dark_step" && result.affectedSquares.length >= 2) {
      setLastMove({
        from: result.affectedSquares[0],
        to: result.affectedSquares[1],
      });
    } else {
      setLastMove(null);
    }

    playPieceMoveSound("k");

    finalizeHistory(
      result.game,
      result.state,
      {
        color: "b",
        kind: "power",
        san: `${bossPowerIcon(power)} ${t(bossPowerLabel(power))}`,
        from:
          power === "dark_step" && result.affectedSquares.length >= 2
            ? result.affectedSquares[0]
            : null,
        to:
          power === "dark_step" && result.affectedSquares.length >= 2
            ? result.affectedSquares[1]
            : (target ?? null),
        piece: "k",
        captured: null,
        bossDamaged: false,
        power,
      },
      capturedWhite,
      capturedBlack,
      snapshot,
    );
  }

  function choosePower(power: BossPowerId) {
    if (aiMode && game.turn() !== humanColor) return;

    if (!canUseBossPower(game, bossState, power)) return;

    clearSelection();

    if (power === "shockwave") {
      commitPower("shockwave");
      return;
    }

    setBossTargetMode((current) =>
      current === power ? null : (power as BossTargetMode),
    );
  }

  function handleSquareClick(row: number, column: number) {
    if (aiMode && game.turn() !== humanColor) return;

    if (finishedGame || historyPreview || pendingPromotion || flipPending)
      return;

    const square = getSquareName(row, column);

    if (bossTargetMode) {
      if (!livePowerTargetSquares.includes(square)) {
        clearPowerTarget();
        return;
      }

      commitPower(bossTargetMode, square);
      return;
    }

    const clickedPiece = game.get(square);

    if (!selectedSquare) {
      selectPiece(square);
      return;
    }

    if (square === selectedSquare) {
      clearSelection();
      return;
    }

    if (clickedPiece?.color === game.turn()) {
      selectPiece(square);
      return;
    }

    if (!legalMoves.includes(square)) {
      clearSelection();
      return;
    }

    const selectedPiece = game.get(selectedSquare);

    const reachesPromotionRank =
      selectedPiece?.type === "p" &&
      ((selectedPiece.color === "w" && square[1] === "8") ||
        (selectedPiece.color === "b" && square[1] === "1"));

    if (reachesPromotionRank) {
      setPendingPromotion({ from: selectedSquare, to: square });
      clearSelection();
      return;
    }

    makeMove(selectedSquare, square);
  }

  function undoMove() {
    const snapshot = undoStack[undoStack.length - 1];
    if (!snapshot) return;
    if (aiMode) {
      return;
    }
    const restoredGame = new Chess(snapshot.fen);

    setGame(restoredGame);
    snapToSide(restoredGame.turn());
    setBossState(cloneBossBattleState(snapshot.bossState));
    setLastMove(snapshot.lastMove);
    setHistory([...snapshot.history]);
    setCapturedWhite([...snapshot.capturedWhite]);
    setCapturedBlack([...snapshot.capturedBlack]);
    setFinishedGame(snapshot.finishedGame);
    setUndoStack((stack) => stack.slice(0, -1));
    setHistoryPreviewPly(null);
    setPendingPromotion(null);
    clearSelection();
    clearPowerTarget();
  }

  function restartGame() {
    const fresh = new Chess(BOSS_STARTING_FEN);

    setGame(fresh);
    snapToSide(fresh.turn());
    setBossState(createInitialBossBattleState());
    setSelectedSquare(null);
    setLegalMoves([]);
    setLastMove(null);
    setPendingPromotion(null);
    setBossTargetMode(null);
    setFinishedGame(null);
    setCapturedWhite([]);
    setCapturedBlack([]);
    setHistory([]);
    setHistoryPreviewPly(null);
    setUndoStack([]);
  }

  return (
    <div className="chess-variant-page min-h-[var(--app-height)] bg-transparent px-4 py-6 text-zinc-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1500px]">
        <ChessPageHeader className="mb-7 flex flex-col gap-4 rounded-3xl border border-red-400/10 bg-zinc-900/55 px-5 py-4 shadow-xl shadow-black/20 backdrop-blur-md sm:flex-row sm:items-center sm:justify-between" description={<> {t("One normal army versus a five-life Boss with powers")} </>}>


          <div className="flex flex-wrap items-center justify-end gap-2">
            <div className="rounded-full border border-red-400/20 bg-red-400/[0.07] px-3 py-1.5 text-xs font-black text-red-200">
              ♚ {bossHearts(displayedBossState.hp)}
            </div>

            {displayedBossState.armorPliesRemaining > 0 && (
              <div className="rounded-full border border-cyan-300/20 bg-cyan-300/[0.07] px-3 py-1.5 text-xs font-black text-cyan-200">
                🛡 {displayedBossState.armorPliesRemaining}
              </div>
            )}

            <div className="rounded-full border border-orange-300/15 bg-orange-300/[0.06] px-3 py-1.5 text-xs font-black text-orange-200">
              🔥 {t("Rage")} {rage}/{BOSS_MAX_RAGE}
            </div>

            {!finishedGame && !historyPreview && (
              <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-zinc-300">
                <span
                  className={`h-2 w-2 animate-pulse rounded-full ${game.turn() === "w" ? "bg-amber-300" : "bg-red-400"}`}
                />
                {game.turn() === "w" ? t("White to move") : t("Boss to move")}
              </div>
            )}
          </div>
        </ChessPageHeader>

        <main className="grid gap-6 chess-game-grid xl:grid-cols-[300px_minmax(0,1fr)_300px]">
          <aside className="min-w-0">
            <div className="space-y-4 xl:sticky xl:top-6">
              <section className="rounded-3xl border border-white/10 bg-zinc-900/75 p-4 shadow-xl shadow-black/20 backdrop-blur-md">
                <PanelTitle
                  title={t("Game Controls")}
                  subtitle={t("Players, game and actions")}
                />

                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={undoMove}
                      disabled={undoStack.length === 0 || aiMode}
                      className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-xs font-black text-zinc-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-35"
                    >
                      ↶ {t("Undo")}
                    </button>
                    <button
                      type="button"
                      onClick={restartGame}
                      className="rounded-xl border border-red-400/15 bg-red-400/[0.07] px-3 py-2.5 text-xs font-black text-red-200 transition hover:bg-red-400/[0.12]"
                    >
                      ↻ {t("Restart")}
                    </button>
                  </div>
                </div>
              </section>

              <section className="rounded-3xl border border-white/10 bg-zinc-900/75 p-4 shadow-xl shadow-black/20 backdrop-blur-md">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <PanelTitle
                    title={t("Captured Pieces")}
                    subtitle={t("Normal captures only")}
                    compact
                  />
                  <span className="text-xl">⚔</span>
                </div>
                <CapturedPiecesGrid
                  capturedWhite={capturedWhite}
                  capturedBlack={capturedBlack}
                  t={t}
                />
              </section>

              <section className="rounded-3xl border border-white/10 bg-zinc-900/75 p-4 shadow-xl shadow-black/20 backdrop-blur-md">
                <div className="mb-4 flex items-center justify-between">
                  <PanelTitle
                    title={t("Move History")}
                    subtitle={t("Moves and Boss powers")}
                    compact
                  />
                  <span className="rounded-xl bg-white/5 px-2.5 py-1 text-xs font-semibold text-zinc-400">
                    {history.length}
                  </span>
                </div>

                <ChessMoveHistoryList
                  listClassName="max-h-96 rounded-2xl border border-white/5 bg-black/20"
                  selectedPly={historyPreviewPly}
                  emptyLabel={t("No actions yet")}
                  entries={history.map((entry) => ({
                    ply: entry.ply,
                    side: entry.color,
                    moveNumber: entry.moveNumber,
                    content: (
                      <>
                        <span className="text-base leading-none">{historySymbol(entry.color, entry.piece)}</span>
                        <span className="truncate text-xs font-bold text-zinc-300">{entry.san}</span>
                      </>
                    ),
                    trailing: entry.bossDamaged ? <span className="text-red-300">♥−1</span> : null,
                  }))}
                  onSelect={(ply) => {
                    setHistoryPreviewPly(ply);
                    clearSelection();
                    clearPowerTarget();
                  }}
                />
              </section>
            </div>
          </aside>

          <section className="min-w-0">
            <div className="mx-auto max-w-[820px]">
              {historyPreview && (
                <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-blue-400/20 bg-blue-400/[0.07] px-4 py-3">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-blue-300">
                      {t("History Preview")}
                    </p>
                    <p className="mt-1 text-sm font-bold text-white">
                      {historyPreview.moveNumber}
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

              {pendingPromotion && !historyPreview && (
                <div className="mb-3">
                  <PromotionBar
                    onPromote={(piece) => {
                      makeMove(
                        pendingPromotion.from,
                        pendingPromotion.to,
                        piece,
                      );
                    }}
                  />
                </div>
              )}

              {bossTargetMode && !historyPreview && (
                <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-violet-400/20 bg-violet-400/[0.07] px-4 py-3">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-violet-300">
                      {t("Boss Power Targeting")}
                    </p>
                    <p className="mt-1 text-sm font-bold text-white">
                      {bossTargetMode === "summon" ? t("Choose a pawn summon square") : t("Choose a Dark Step destination")}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={clearPowerTarget}
                    className="rounded-lg bg-white/10 px-3 py-2 text-xs font-bold text-zinc-300 hover:bg-white/20"
                  >
                    {t("Cancel")}
                  </button>
                </div>
              )}

              {finishedGame && !historyPreview && (
                <VisibleGameResult />
              )}

              <Board
                board={displayedBoard}
                selectedSquare={historyPreview ? null : selectedSquare}
                legalMoves={historyPreview ? [] : legalMoves}
                lastMove={displayedLastMove}
                checkedKingSquare={checkedKingSquare}
                onSquareClick={
                  historyPreview || finishedGame || flipPending
                    ? () => {}
                    : handleSquareClick
                }
                orientation={boardOrientation}
                bossSquare={bossSquare}
                bossPowerTargetSquares={displayedPowerTargets}
                bossPowerTargetMode={displayedPowerTargetMode}
                bossShockwaveSquares={displayedShockwaveSquares}
                bossArmorActive={displayedBossState.armorPliesRemaining > 0}
                bossRage={rage}
              />

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <MiniRule
                  icon="♔"
                  title={t("White")}
                  text={t(
                    "Check the Boss to remove HP. Checkmate also wins instantly.",
                  )}
                />
                <MiniRule
                  icon="♚"
                  title={t("Boss")}
                  text={t(
                    "Checkmate the White king. Powers replace a normal Boss turn.",
                  )}
                />
                <MiniRule
                  icon="🛡"
                  title={t("Armor")}
                  text={t(
                    "After losing HP, the Boss ignores HP damage for 2 completed plies.",
                  )}
                />
              </div>
            </div>
          </section>

          <aside className="min-w-0">
            <div className="space-y-4 xl:sticky xl:top-6">
              <section className="rounded-3xl border border-red-400/15 bg-zinc-900/80 p-4 shadow-xl shadow-black/20 backdrop-blur-md">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-black text-zinc-100">
                      {t("Boss Status")}
                    </h2>
                    <p className="mt-1 text-xs text-zinc-500">
                      {t("Health, armor and rage")}
                    </p>
                  </div>
                  <span className="text-3xl">♚</span>
                </div>

                <div className="rounded-2xl border border-red-400/15 bg-red-400/[0.05] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-black uppercase tracking-wider text-zinc-500">{ui("HP")}</span>
                    <span className="text-sm font-black text-red-300">
                      {displayedBossState.hp}/{BOSS_MAX_HP}
                    </span>
                  </div>
                  <div className="mt-2 text-2xl font-black tracking-wider text-red-300">
                    {bossHearts(displayedBossState.hp)}
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <StatusCard
                    icon="🛡"
                    label={t("Armor")}
                    value={
                      displayedBossState.armorPliesRemaining > 0
                        ? `${displayedBossState.armorPliesRemaining} ${t("plies")}`
                        : t("Off")
                    }
                  />
                  <StatusCard
                    icon="🔥"
                    label={t("Rage")}
                    value={`${rage}/${BOSS_MAX_RAGE}`}
                  />
                  <StatusCard
                    icon="👹"
                    label={t("Summons")}
                    value={String(displayedBossState.summons)}
                  />
                  <StatusCard
                    icon="♚"
                    label={t("Boss turns")}
                    value={String(displayedBossState.bossTurnsCompleted)}
                  />
                </div>

                <p className="mt-3 text-[10px] leading-4 text-zinc-600">
                  {t(
                    "Rage increases every 4 completed Boss turns and reduces future power cooldowns by 1 per level, to a minimum of 2.",
                  )}
                </p>
              </section>

              <section className="rounded-3xl border border-violet-400/15 bg-zinc-900/80 p-4 shadow-xl shadow-black/20 backdrop-blur-md">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-black text-zinc-100">
                      {t("Boss Powers")}
                    </h2>
                    <p className="mt-1 text-xs text-zinc-500">
                      {t("Using a power ends Black’s turn")}
                    </p>
                  </div>
                  <span className="text-2xl">⚡</span>
                </div>

                {game.turn() === "b" && game.isCheck() && !historyPreview && (
                  <div className="mb-3 rounded-xl border border-red-400/15 bg-red-400/[0.06] px-3 py-2.5 text-[10px] font-bold text-red-300">
                    {t(
                      "The Boss is in check — powers are locked until the check is answered normally.",
                    )}
                  </div>
                )}

                <div className="space-y-2">
                  {(["shockwave", "summon", "dark_step"] as BossPowerId[]).map(
                    (power) => (
                      <PowerButton
                        key={power}
                        power={power}
                        state={displayedBossState}
                        liveState={bossState}
                        enabled={
                          !historyPreview &&
                          !finishedGame &&
                          !flipPending &&
                          canUseBossPower(game, bossState, power)
                        }
                        selected={bossTargetMode === power}
                        onClick={() => choosePower(power)}
                        t={t}
                      />
                    ),
                  )}
                </div>
              </section>

              <section className="rounded-3xl border border-white/10 bg-zinc-900/75 p-4 shadow-xl shadow-black/20 backdrop-blur-md">
                <PanelTitle
                  title={t("Rules")}
                  subtitle={t("Boss Battle Chess")}
                />

                <div className="space-y-2 text-xs leading-5 text-zinc-400">
                  <RuleLine
                    icon="♔"
                    text={t("White starts with the normal full chess army.")}
                  />
                  <RuleLine
                    icon="♚"
                    text={t(
                      "Black starts with the Boss, six pawns, one knight and one bishop.",
                    )}
                  />
                  <RuleLine
                    icon="♥"
                    text={t(
                      "A non-mating White check removes 1 Boss HP when armor is inactive.",
                    )}
                  />
                  <RuleLine
                    icon="🛡"
                    text={t(
                      "After taking damage, the Boss gains 2 completed plies of HP-damage immunity. Check rules still apply.",
                    )}
                  />
                  <RuleLine
                    icon="☠"
                    text={t(
                      "Boss HP 0 or Boss checkmate = White wins. White checkmate = Boss wins.",
                    )}
                  />
                  <RuleLine
                    icon="💥"
                    text={t(
                      "Shockwave pushes adjacent non-king White pieces one square away when the destination is free.",
                    )}
                  />
                  <RuleLine
                    icon="👹"
                    text={t(
                      "Summon places a Black pawn on an empty square of rank 6 or 7.",
                    )}
                  />
                  <RuleLine
                    icon="🌑"
                    text={t(
                      "Dark Step relocates the Boss up to two squares to a safe empty square.",
                    )}
                  />
                  <RuleLine
                    icon="🔥"
                    text={t(
                      "Rage rises over time and shortens power cooldowns.",
                    )}
                  />
                </div>
              </section>
            </div>
          </aside>
        </main>
      </div>
    </div>
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
  useUiLanguage();
  return (
    <div className={compact ? "" : "mb-4"}>
      <h2 className="text-sm font-black text-zinc-100">{ui(title)}</h2>
      <p className="mt-1 text-xs text-zinc-500">{ui(subtitle)}</p>
    </div>
  );
}

function PowerButton({
  power,
  state,
  liveState,
  enabled,
  selected,
  onClick,
  t,
}: {
  power: BossPowerId;
  state: BossBattleState;
  liveState: BossBattleState;
  enabled: boolean;
  selected: boolean;
  onClick: () => void;
  t: (key: string) => string;
}) {
  useUiLanguage();
  const cooldown = state.cooldowns[power];
  const nextCooldown = getBossPowerCooldown(power, liveState);

  const detail =
    power === "shockwave"
      ? t("Push adjacent White pieces outward")
      : power === "summon"
        ? t("Spawn a Black pawn on rank 6 or 7")
        : t("Relocate the Boss up to two squares");

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!enabled}
      className={`w-full rounded-2xl border p-3 text-left transition ${
        selected
          ? "border-violet-300/45 bg-violet-400/[0.12] shadow-[0_0_22px_rgba(167,139,250,0.12)]"
          : enabled
            ? "border-violet-300/15 bg-violet-400/[0.05] hover:bg-violet-400/[0.1]"
            : "cursor-not-allowed border-white/5 bg-black/15 opacity-45"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex gap-2.5">
          <span className="text-xl">{bossPowerIcon(power)}</span>
          <div>
            <p className="text-xs font-black text-white">
              {t(bossPowerLabel(power))}
            </p>
            <p className="mt-1 text-[10px] leading-4 text-zinc-500">{detail}</p>
          </div>
        </div>

        <span
          className={`shrink-0 rounded-lg px-2 py-1 text-[9px] font-black uppercase ${cooldown > 0 ? "bg-zinc-800 text-zinc-500" : "bg-emerald-400/10 text-emerald-300"}`}
        >
          {cooldown > 0 ? `${cooldown} ${t("turns")}` : selected ? t("Choose") : t("Ready")}
        </span>
      </div>

      <p className="mt-2 text-[9px] text-zinc-600">
        {t("Cooldown when used now:")} {nextCooldown} {t("Boss turns suffix")}
      </p>
    </button>
  );
}

function StatusCard({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
}) {
  useUiLanguage();
  return (
    <div className="rounded-xl border border-white/5 bg-black/20 p-3">
      <div className="flex items-start justify-between gap-2">
        <span className="text-lg">{icon}</span>
        <span className="text-sm font-black text-white">{value}</span>
      </div>
      <p className="mt-2 text-[9px] font-black uppercase tracking-wider text-zinc-600">
        {ui(label)}
      </p>
    </div>
  );
}

function RuleLine({ icon, text }: { icon: string; text: string }) {
  useUiLanguage();
  return (
    <div className="flex gap-2 rounded-xl border border-white/[0.04] bg-black/15 px-3 py-2">
      <span className="w-7 shrink-0 text-center font-black text-red-300">
        {icon}
      </span>
      <span>{ui(text)}</span>
    </div>
  );
}

function MiniRule({
  icon,
  title,
  text,
}: {
  icon: string;
  title: string;
  text: string;
}) {
  useUiLanguage();
  return (
    <div className="rounded-2xl border border-white/5 bg-zinc-900/55 p-3">
      <div className="flex items-center gap-2">
        <span className="text-lg">{icon}</span>
        <span className="text-xs font-black text-zinc-200">{ui(title)}</span>
      </div>
      <p className="mt-2 text-[10px] leading-4 text-zinc-600">{ui(text)}</p>
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
  const whiteSymbols: Record<PieceType, string> = {
    p: "♙",
    n: "♘",
    b: "♗",
    r: "♖",
    q: "♕",
    k: "♔",
  };

  const blackSymbols: Record<PieceType, string> = {
    p: "♟",
    n: "♞",
    b: "♝",
    r: "♜",
    q: "♛",
    k: "♚",
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-[52px_minmax(0,1fr)] items-start gap-2">
        <span className="text-[10px] font-black uppercase tracking-wider text-zinc-600">
          {t("White")}
        </span>
        <div className="flex min-h-7 flex-wrap gap-1 text-xl leading-none text-[#fff3d5]">
          {capturedWhite.length === 0 ? (
            <span className="text-xs text-zinc-700">—</span>
          ) : (
            capturedWhite.map((piece, index) => (
              <span key={`${piece}-${index}`}>{whiteSymbols[piece]}</span>
            ))
          )}
        </div>
      </div>

      <div className="grid grid-cols-[52px_minmax(0,1fr)] items-start gap-2">
        <span className="text-[10px] font-black uppercase tracking-wider text-zinc-600">
          {t("Black")}
        </span>
        <div className="flex min-h-7 flex-wrap gap-1 text-xl leading-none text-zinc-300">
          {capturedBlack.length === 0 ? (
            <span className="text-xs text-zinc-700">—</span>
          ) : (
            capturedBlack.map((piece, index) => (
              <span key={`${piece}-${index}`}>{blackSymbols[piece]}</span>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
