import { useMemo, useState, type ReactNode } from "react";

import { Chess, type Square } from "chess.js";

import { getSquareName, type PieceType } from "../utils/chessUtils";

import Board from "./Board.tsx";
import PromotionBar from "./PromotionBar";

import {
  playPieceCaptureSound,
  playPieceMoveSound,
  playPieceSelectSound,
  playRandomSound,
} from "../utils/sound.ts";

import {
  clonePortalState,
  createInitialPortalState,
  createPortalSeed,
  finalizePortalPromotionEvent,
  getRevealedPortalSquaresByEffect,
  isThreefoldPortal,
  resolvePortalAfterMove,
  type PendingPortalPromotion,
  type PortalEffect,
  type PortalEvent,
  type PortalMoveRecord,
  type PortalPieceType,
  type PortalPromotionCard,
  type PortalSide,
  type PortalState,
} from "../games/chess/variants/portalChess";

import { useDelayedBoardOrientation } from "../hooks/useDelayedBoardOrientation";

type Language = "en" | "de" | "bar" | "ko" | "ru";

type Winner = "white" | "black" | "draw";

const CHESS_LANGUAGE_STORAGE_KEY = "chess-language";

const pieceValues: Record<string, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0,
};

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

const promotionCardNames: Record<PortalPromotionCard, string> = {
  p: "Pawn",
  b: "Bishop",
  n: "Knight",
  r: "Rook",
  q: "Queen",
  k: "King",
};

const translations: Record<Exclude<Language, "en">, Record<string, string>> = {
  de: {
    "Chess Variant": "Schachvariante",
    "Portal Chess": "Portal-Schach",
    "Invisible chaos on ranks 4 and 5": "Unsichtbares Chaos auf Reihen 4 und 5",
    Language: "Sprache",
    "White to move": "Weiß am Zug",
    "Black to move": "Schwarz am Zug",
    "Game Controls": "Spielsteuerung",
    Undo: "Rückgängig",
    Restart: "Neustart",
    "Captured Pieces": "Geschlagene Figuren",
    White: "Weiß",
    Black: "Schwarz",
    Equal: "Gleich",
    "Move History": "Zugverlauf",
    "No moves yet": "Noch keine Züge",
    "History Preview": "Verlaufsansicht",
    "Back to Live Board": "Zurück zum Live-Brett",
    "Portal Guide": "Portal-Leitfaden",
    "What can happen?": "Was kann passieren?",
    "Hidden portals spawn only on ranks 4 and 5.":
      "Versteckte Portale entstehen nur auf Reihen 4 und 5.",
    Destroy: "Zerstören",
    "Your piece may vanish.": "Deine Figur kann verschwinden.",
    Teleport: "Teleport",
    "Your piece jumps to a random safe empty square.":
      "Deine Figur springt auf ein zufälliges sicheres freies Feld.",
    Swap: "Tausch",
    "Your piece may swap places with a random enemy piece.":
      "Deine Figur kann mit einer zufälligen gegnerischen Figur tauschen.",
    Promote: "Befördern",
    "Pawn only: choose one mystery card.":
      "Nur Bauern: Wähle eine geheimnisvolle Karte.",
    "Promotion Card Pool": "Beförderungs-Kartenpool",
    "8 Pawn · 2 Bishop · 2 Knight · 2 Rook · 1 Queen · 1 King":
      "8 Bauer · 2 Läufer · 2 Springer · 2 Turm · 1 Dame · 1 König",
    "The King card is suspicious.": "Die Königskarte ist verdächtig.",
    "Revealed Portals": "Aufgedeckte Portale",
    "None discovered yet": "Noch keines entdeckt",
    "Portal Events": "Portal-Ereignisse",
    "No portal has fired yet": "Noch kein Portal ausgelöst",
    "Promotion Portal!": "Beförderungsportal!",
    "Choose one card": "Wähle eine Karte",
    "One card decides your Pawn's fate.":
      "Eine Karte entscheidet das Schicksal deines Bauern.",
    "Better luck next time!": "Mehr Glück beim nächsten Mal!",
    "Still a Pawn.": "Bleibt ein Bauer.",
    "Nice pull!": "Schöner Treffer!",
    "Your Pawn becomes": "Dein Bauer wird zu",
    "JACKPOT!": "JACKPOT!",
    "You pulled the Queen!": "Du hast die Dame gezogen!",
    "KING?!": "KÖNIG?!",
    "No way... you pulled a King!":
      "Unglaublich... du hast einen König gezogen!",
    "PRANK!": "REINGELEGT!",
    "There are no bonus Kings. The Pawn disappears.":
      "Es gibt keine Bonus-Könige. Der Bauer verschwindet.",
    Continue: "Weiter",
    Pawn: "Bauer",
    Bishop: "Läufer",
    Knight: "Springer",
    Rook: "Turm",
    Queen: "Dame",
    King: "König",
    "Game Over": "Spielende",
    "White wins": "Weiß gewinnt",
    "Black wins": "Schwarz gewinnt",
    Draw: "Remis",
    Checkmate: "Schachmatt",
    Stalemate: "Patt",
    "Insufficient material": "Unzureichendes Material",
    "50-move rule": "50-Züge-Regel",
    "Threefold repetition": "Dreifache Stellungswiederholung",
  },

  bar: {
    "Chess Variant": "Schachvariantn",
    "Portal Chess": "Portal-Schach",
    "Invisible chaos on ranks 4 and 5": "Unsichtbars Chaos auf Reihe 4 und 5",
    Language: "Sproch",
    "White to move": "Weiß is dro",
    "Black to move": "Schwarz is dro",
    "Game Controls": "Spielsteuerung",
    Undo: "Zruck",
    Restart: "Neu startn",
    "Captured Pieces": "G'schlagene Figuren",
    White: "Weiß",
    Black: "Schwarz",
    Equal: "Gleich",
    "Move History": "Zugverlauf",
    "No moves yet": "No koa Zug",
    "History Preview": "Verlaufsansicht",
    "Back to Live Board": "Zruck zum Live-Brett",
    "Portal Guide": "Portal-Leitfadn",
    "What can happen?": "Wos kann passiern?",
    "Hidden portals spawn only on ranks 4 and 5.":
      "Versteckte Portale san bloß auf Reihe 4 und 5.",
    Destroy: "Zerstörn",
    "Your piece may vanish.": "Dei Figur kann verschwinden.",
    Teleport: "Teleport",
    "Your piece jumps to a random safe empty square.":
      "Dei Figur springt auf a zufälligs sichers freis Feld.",
    Swap: "Tausch",
    "Your piece may swap places with a random enemy piece.":
      "Dei Figur kann mit ana zufälligen Gegnerfigur tauschn.",
    Promote: "Befördern",
    "Pawn only: choose one mystery card.":
      "Bloß Baua: Such da a Geheimkartn aus.",
    "Promotion Card Pool": "Beförderungs-Kartn",
    "8 Pawn · 2 Bishop · 2 Knight · 2 Rook · 1 Queen · 1 King":
      "8 Baua · 2 Läufa · 2 Springa · 2 Turm · 1 Dame · 1 Kini",
    "The King card is suspicious.": "De Kini-Kartn is verdächtig.",
    "Revealed Portals": "Aufdeckte Portale",
    "None discovered yet": "No koans entdeckt",
    "Portal Events": "Portal-Ereignisse",
    "No portal has fired yet": "No koa Portal ausgelöst",
    "Promotion Portal!": "Beförderungsportal!",
    "Choose one card": "Such da oane Kartn aus",
    "One card decides your Pawn's fate.":
      "Oane Kartn entscheidet übers Schicksal vom Baua.",
    "Better luck next time!": "Beim nächsten Moi mehr Glück!",
    "Still a Pawn.": "Bleibt a Baua.",
    "Nice pull!": "Sauba!",
    "Your Pawn becomes": "Dei Baua wird",
    "JACKPOT!": "JACKPOT!",
    "You pulled the Queen!": "Du host de Dame zogn!",
    "KING?!": "KINI?!",
    "No way... you pulled a King!": "Naa... du host an Kini zogn!",
    "PRANK!": "REINGELEGT!",
    "There are no bonus Kings. The Pawn disappears.":
      "Koa Bonus-Kini. Da Baua verschwindt.",
    Continue: "Weida",
    Pawn: "Baua",
    Bishop: "Läufa",
    Knight: "Springa",
    Rook: "Turm",
    Queen: "Dame",
    King: "Kini",
    "Game Over": "Spiel aus",
    "White wins": "Weiß gwinnt",
    "Black wins": "Schwarz gwinnt",
    Draw: "Remis",
  },

  ko: {
    "Chess Variant": "체스 변형",
    "Portal Chess": "포털 체스",
    "Invisible chaos on ranks 4 and 5": "4·5랭크에 숨겨진 혼돈",
    Language: "언어",
    "White to move": "백 차례",
    "Black to move": "흑 차례",
    "Game Controls": "게임 컨트롤",
    Undo: "되돌리기",
    Restart: "새 게임",
    "Captured Pieces": "잡힌 기물",
    White: "백",
    Black: "흑",
    Equal: "동일",
    "Move History": "수 기록",
    "No moves yet": "아직 수가 없습니다",
    "History Preview": "기록 미리보기",
    "Back to Live Board": "현재 보드로 돌아가기",
    "Portal Guide": "포털 안내",
    "What can happen?": "무슨 일이 생길까?",
    "Hidden portals spawn only on ranks 4 and 5.":
      "숨겨진 포털은 4·5랭크에만 생성됩니다.",
    Destroy: "파괴",
    "Your piece may vanish.": "기물이 사라질 수 있습니다.",
    Teleport: "텔레포트",
    "Your piece jumps to a random safe empty square.":
      "기물이 무작위 안전한 빈 칸으로 이동합니다.",
    Swap: "교환",
    "Your piece may swap places with a random enemy piece.":
      "무작위 상대 기물과 위치를 바꿀 수 있습니다.",
    Promote: "프로모트",
    "Pawn only: choose one mystery card.":
      "폰 전용: 미스터리 카드 한 장을 고릅니다.",
    "Promotion Card Pool": "프로모션 카드 풀",
    "8 Pawn · 2 Bishop · 2 Knight · 2 Rook · 1 Queen · 1 King":
      "폰 8 · 비숍 2 · 나이트 2 · 룩 2 · 퀸 1 · 킹 1",
    "The King card is suspicious.": "킹 카드는 수상합니다.",
    "Revealed Portals": "공개된 포털",
    "None discovered yet": "아직 발견되지 않음",
    "Portal Events": "포털 이벤트",
    "No portal has fired yet": "아직 포털이 발동하지 않았습니다",
    "Promotion Portal!": "프로모션 포털!",
    "Choose one card": "카드 한 장을 고르세요",
    "One card decides your Pawn's fate.":
      "카드 한 장이 폰의 운명을 결정합니다.",
    "Better luck next time!": "다음엔 더 좋은 행운을!",
    "Still a Pawn.": "그대로 폰입니다.",
    "Nice pull!": "좋은 카드!",
    "Your Pawn becomes": "폰이 다음 기물로 변합니다:",
    "JACKPOT!": "잭팟!",
    "You pulled the Queen!": "퀸을 뽑았습니다!",
    "KING?!": "킹?!",
    "No way... you pulled a King!": "설마... 킹을 뽑았습니다!",
    "PRANK!": "낚였습니다!",
    "There are no bonus Kings. The Pawn disappears.":
      "추가 킹은 없습니다. 폰이 사라집니다.",
    Continue: "계속",
    Pawn: "폰",
    Bishop: "비숍",
    Knight: "나이트",
    Rook: "룩",
    Queen: "퀸",
    King: "킹",
    "Game Over": "게임 종료",
    "White wins": "백 승리",
    "Black wins": "흑 승리",
    Draw: "무승부",
    Checkmate: "체크메이트",
    Stalemate: "스테일메이트",
    "Insufficient material": "기물 부족",
    "50-move rule": "50수 규칙",
    "Threefold repetition": "3회 동형 반복",
  },

  ru: {
    "Chess Variant": "Вариант шахмат",
    "Portal Chess": "Портальные шахматы",
    "Invisible chaos on ranks 4 and 5": "Невидимый хаос на 4-м и 5-м рядах",
    Language: "Язык",
    "White to move": "Ход белых",
    "Black to move": "Ход чёрных",
    "Game Controls": "Управление",
    Undo: "Отменить",
    Restart: "Заново",
    "Captured Pieces": "Взятые фигуры",
    White: "Белые",
    Black: "Чёрные",
    Equal: "Равно",
    "Move History": "История ходов",
    "No moves yet": "Ходов пока нет",
    "History Preview": "Просмотр истории",
    "Back to Live Board": "Вернуться к игре",
    "Portal Guide": "Справочник порталов",
    "What can happen?": "Что может случиться?",
    "Hidden portals spawn only on ranks 4 and 5.":
      "Скрытые порталы появляются только на 4-м и 5-м рядах.",
    Destroy: "Уничтожение",
    "Your piece may vanish.": "Ваша фигура может исчезнуть.",
    Teleport: "Телепорт",
    "Your piece jumps to a random safe empty square.":
      "Фигура прыгает на случайное безопасное пустое поле.",
    Swap: "Обмен",
    "Your piece may swap places with a random enemy piece.":
      "Фигура может поменяться местами со случайной фигурой соперника.",
    Promote: "Повышение",
    "Pawn only: choose one mystery card.":
      "Только пешка: выберите одну таинственную карту.",
    "Promotion Card Pool": "Колода повышения",
    "8 Pawn · 2 Bishop · 2 Knight · 2 Rook · 1 Queen · 1 King":
      "8 пешек · 2 слона · 2 коня · 2 ладьи · 1 ферзь · 1 король",
    "The King card is suspicious.": "Карта короля подозрительна.",
    "Revealed Portals": "Открытые порталы",
    "None discovered yet": "Пока ничего",
    "Portal Events": "События порталов",
    "No portal has fired yet": "Порталы ещё не срабатывали",
    "Promotion Portal!": "Портал повышения!",
    "Choose one card": "Выберите одну карту",
    "One card decides your Pawn's fate.": "Одна карта решит судьбу пешки.",
    "Better luck next time!": "В следующий раз повезёт больше!",
    "Still a Pawn.": "Остаётся пешкой.",
    "Nice pull!": "Отличная карта!",
    "Your Pawn becomes": "Ваша пешка становится",
    "JACKPOT!": "ДЖЕКПОТ!",
    "You pulled the Queen!": "Вы вытянули ферзя!",
    "KING?!": "КОРОЛЬ?!",
    "No way... you pulled a King!": "Не может быть... вы вытянули короля!",
    "PRANK!": "РОЗЫГРЫШ!",
    "There are no bonus Kings. The Pawn disappears.":
      "Дополнительных королей не бывает. Пешка исчезает.",
    Continue: "Продолжить",
    Pawn: "Пешка",
    Bishop: "Слон",
    Knight: "Конь",
    Rook: "Ладья",
    Queen: "Ферзь",
    King: "Король",
    "Game Over": "Партия окончена",
    "White wins": "Белые победили",
    "Black wins": "Чёрные победили",
    Draw: "Ничья",
  },
};

function getInitialLanguage(): Language {
  if (typeof window === "undefined") {
    return "en";
  }

  const stored = window.localStorage.getItem(CHESS_LANGUAGE_STORAGE_KEY);

  return ["en", "de", "bar", "ko", "ru"].includes(stored ?? "")
    ? (stored as Language)
    : "en";
}

function Panel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <section
      className="
        rounded-2xl
        border
        border-white/10
        bg-zinc-900/75
        p-4
        shadow-xl
        backdrop-blur
      "
    >
      <div className="mb-3">
        <h2
          className="
            text-sm
            font-black
            text-white
          "
        >
          {title}
        </h2>

        {subtitle && (
          <p
            className="
              mt-1
              text-[11px]
              text-zinc-500
            "
          >
            {subtitle}
          </p>
        )}
      </div>

      {children}
    </section>
  );
}

function effectIcon(effect: PortalEffect): string {
  if (effect === "destroy") {
    return "💥";
  }

  if (effect === "teleport") {
    return "🌀";
  }

  if (effect === "swap") {
    return "🔄";
  }

  return "🎴";
}

function cardSymbol(card: PortalPromotionCard, color: PortalSide): string {
  return color === "w" ? whiteSymbols[card] : blackSymbols[card];
}

function PortalPromotionModal({
  pending,
  color,
  t,
  onResolve,
}: {
  pending: PendingPortalPromotion;
  color: PortalSide;
  t: (key: string) => string;
  onResolve: (card: PortalPromotionCard) => void;
}) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const [stage, setStage] = useState<"choose" | "reveal" | "prank">("choose");

  const selectedCard =
    selectedIndex === null ? null : pending.deck[selectedIndex];

  function chooseCard(index: number) {
    if (stage !== "choose") {
      return;
    }

    setSelectedIndex(index);

    window.setTimeout(() => {
      setStage("reveal");

      if (pending.deck[index] === "k") {
        window.setTimeout(() => {
          setStage("prank");
        }, 1200);
      }
    }, 420);
  }

  const resultTitle =
    selectedCard === "p"
      ? t("Better luck next time!")
      : selectedCard === "q"
        ? t("JACKPOT!")
        : selectedCard === "k"
          ? stage === "prank"
            ? t("PRANK!")
            : t("KING?!")
          : selectedCard
            ? t("Nice pull!")
            : "";

  const resultText =
    selectedCard === "p"
      ? t("Still a Pawn.")
      : selectedCard === "q"
        ? t("You pulled the Queen!")
        : selectedCard === "k"
          ? stage === "prank"
            ? t("There are no bonus Kings. The Pawn disappears.")
            : t("No way... you pulled a King!")
          : selectedCard
            ? `${t("Your Pawn becomes")} ${t(
                promotionCardNames[selectedCard],
              )}.`
            : "";

  const canContinue =
    (selectedCard !== null && stage === "reveal" && selectedCard !== "k") ||
    (selectedCard === "k" && stage === "prank");

  return (
    <div
      className="
        fixed
        inset-0
        z-[120]
        flex
        items-center
        justify-center
        bg-zinc-950/85
        p-4
        backdrop-blur-md
      "
    >
      <div
        className="
          w-full
          max-w-3xl
          overflow-hidden
          rounded-[28px]
          border
          border-violet-300/20
          bg-gradient-to-br
          from-zinc-900
          via-zinc-950
          to-violet-950/70
          p-5
          shadow-[0_30px_100px_rgba(0,0,0,0.7)]
          sm:p-7
        "
      >
        <div
          className="
            text-center
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
              rounded-full
              border
              border-violet-200/25
              bg-violet-400/10
              text-3xl
              shadow-[0_0_30px_rgba(167,139,250,0.3)]
            "
          >
            🎴
          </div>

          <h2
            className="
              mt-3
              text-2xl
              font-black
              text-white
            "
          >
            {t("Promotion Portal!")}
          </h2>

          <p
            className="
              mt-1
              text-sm
              font-bold
              text-violet-200
            "
          >
            {stage === "choose" ? t("Choose one card") : resultTitle}
          </p>

          <p
            className="
              mt-1
              text-xs
              text-zinc-400
            "
          >
            {stage === "choose"
              ? t("One card decides your Pawn's fate.")
              : resultText}
          </p>
        </div>

        <div
          className="
            mt-5
            grid
            grid-cols-3
            gap-2
            sm:grid-cols-6
          "
        >
          {[
            ["♙", "8", "Pawn"],
            ["♗", "2", "Bishop"],
            ["♘", "2", "Knight"],
            ["♖", "2", "Rook"],
            ["♕", "1", "Queen"],
            ["♔", "1", "King"],
          ].map(([symbol, count, name]) => (
            <div
              key={name}
              className="
                  animate-pulse
                  rounded-xl
                  border
                  border-white/10
                  bg-white/[0.04]
                  px-2
                  py-2
                  text-center
                "
            >
              <div
                className="
                    text-xl
                    leading-none
                    text-amber-100
                  "
              >
                {symbol}
              </div>

              <div
                className="
                    mt-1
                    text-[10px]
                    font-black
                    text-white
                  "
              >
                {count}× {t(name)}
              </div>
            </div>
          ))}
        </div>

        <p
          className="
            mt-3
            text-center
            text-[10px]
            font-bold
            text-zinc-500
          "
        >
          {t("8 Pawn · 2 Bishop · 2 Knight · 2 Rook · 1 Queen · 1 King")}
        </p>

        <div
          className="
            mt-5
            grid
            grid-cols-4
            gap-2
            sm:grid-cols-8
          "
        >
          {pending.deck.map((card, index) => {
            const selected = selectedIndex === index;

            const revealed = selected && stage !== "choose";

            return (
              <button
                key={index}
                type="button"
                onClick={() => chooseCard(index)}
                disabled={stage !== "choose"}
                className={`
                    relative
                    aspect-[3/4]
                    overflow-hidden
                    rounded-xl
                    border
                    font-black
                    transition-all
                    duration-500
                    ${
                      selected
                        ? "z-10 scale-110 border-amber-200 bg-amber-300 text-zinc-950 shadow-[0_0_35px_rgba(251,191,36,0.55)]"
                        : "border-violet-300/20 bg-gradient-to-br from-violet-500/30 to-zinc-950 text-violet-100 hover:-translate-y-1 hover:border-violet-200/50"
                    }
                  `}
                style={{
                  transform: selected
                    ? revealed
                      ? "rotateY(180deg) scale(1.1)"
                      : "translateY(-8px) scale(1.08)"
                    : undefined,

                  transformStyle: "preserve-3d",
                }}
              >
                <span
                  className="
                      absolute
                      inset-0
                      flex
                      items-center
                      justify-center
                    "
                  style={{
                    transform: revealed ? "rotateY(180deg)" : undefined,
                  }}
                >
                  {revealed ? (
                    <span
                      className={`
                            font-serif
                            text-4xl
                            ${
                              card === "q"
                                ? "animate-pulse"
                                : card === "b" || card === "n" || card === "r"
                                  ? "animate-bounce"
                                  : ""
                            }
                          `}
                    >
                      {cardSymbol(card, color)}
                    </span>
                  ) : (
                    <span
                      className="
                            text-2xl
                            drop-shadow
                          "
                    >
                      ✦
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>

        {selectedCard && stage !== "choose" && (
          <div
            className={`
                mt-6
                rounded-2xl
                border
                p-5
                text-center
                transition-all
                duration-500
                ${
                  selectedCard === "q"
                    ? "border-amber-200/40 bg-amber-300/10 shadow-[0_0_40px_rgba(251,191,36,0.18)]"
                    : selectedCard === "k" && stage === "prank"
                      ? "animate-pulse border-red-300/35 bg-red-500/10"
                      : "border-violet-300/20 bg-violet-400/[0.06]"
                }
              `}
          >
            <div
              className={`
                  font-serif
                  text-7xl
                  leading-none
                  ${
                    selectedCard === "q"
                      ? "animate-bounce text-amber-200"
                      : selectedCard === "k" && stage === "prank"
                        ? "animate-pulse text-red-300"
                        : "text-white"
                  }
                `}
            >
              {selectedCard === "k" && stage === "prank"
                ? "💀"
                : cardSymbol(selectedCard, color)}
            </div>

            <h3
              className="
                  mt-3
                  text-xl
                  font-black
                  text-white
                "
            >
              {resultTitle}
            </h3>

            <p
              className="
                  mt-1
                  text-sm
                  text-zinc-300
                "
            >
              {resultText}
            </p>
          </div>
        )}

        {canContinue && (
          <button
            type="button"
            onClick={() => onResolve(selectedCard!)}
            className="
              mt-5
              w-full
              rounded-xl
              bg-violet-300
              px-4
              py-3
              text-sm
              font-black
              text-zinc-950
              transition
              hover:bg-violet-200
            "
          >
            {t("Continue")} →
          </button>
        )}
      </div>
    </div>
  );
}

export default function PortalChessBoard() {
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

  function changeLanguage(next: Language) {
    setLanguage(next);

    if (typeof window !== "undefined") {
      window.localStorage.setItem(CHESS_LANGUAGE_STORAGE_KEY, next);
    }
  }

  const [game] = useState(() => new Chess());

  const [seed, setSeed] = useState(() => createPortalSeed());

  const [portalState, setPortalState] = useState<PortalState>(() =>
    createInitialPortalState(seed),
  );

  const initialFen = new Chess().fen();

  const [position, setPosition] = useState(game.fen());

  const [records, setRecords] = useState<PortalMoveRecord[]>([]);

  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);

  const [legalMoves, setLegalMoves] = useState<Square[]>([]);

  const [lastMove, setLastMove] = useState<{
    from: Square;
    to: Square;
  } | null>(null);

  const [promotionFrom, setPromotionFrom] = useState<Square | null>(null);

  const [promotionSquare, setPromotionSquare] = useState<Square | null>(null);

  const [historyPreviewPly, setHistoryPreviewPly] = useState<number | null>(
    null,
  );

  const [pendingPortalPromotion, setPendingPortalPromotion] = useState<{
    pending: PendingPortalPromotion;
    move: {
      color: PortalSide;
      piece: PortalPieceType;
      from: Square;
      to: Square;
      san: string;
      captured?: PortalPieceType;
    };
    beforeFen: string;
    portalBefore: PortalState;
    portalAfterReveal: PortalState;
  } | null>(null);

  const [activePortalSquare, setActivePortalSquare] = useState<Square | null>(
    null,
  );

  const [gameOver, setGameOver] = useState(false);

  const [gameOverReason, setGameOverReason] = useState("");

  const [winner, setWinner] = useState<Winner>("white");

  const historyPreview =
    historyPreviewPly === null
      ? null
      : (records[historyPreviewPly - 1] ?? null);

  const historyPreviewChess = useMemo(
    () => (historyPreview ? new Chess(historyPreview.fenAfter) : null),
    [historyPreview?.fenAfter],
  );

  const displayedChess = historyPreviewChess ?? game;

  const displayedBoard = displayedChess.board();

  const {
    orientation: liveBoardOrientation,
    flipPending,
    snapToSide,
  } = useDelayedBoardOrientation(game.turn(), 1500);

  const boardOrientation: "white" | "black" = historyPreviewChess
    ? historyPreviewChess.turn() === "w"
      ? "white"
      : "black"
    : liveBoardOrientation;

  const checkedKingSquare: Square | null = displayedChess.isCheck()
    ? (() => {
        const board = displayedChess.board();

        const side = displayedChess.turn();

        for (let row = 0; row < 8; row += 1) {
          for (let column = 0; column < 8; column += 1) {
            const piece = board[row][column];

            if (piece?.type === "k" && piece.color === side) {
              return getSquareName(row, column);
            }
          }
        }

        return null;
      })()
    : null;

  const destroyPortalSquares = historyPreview
    ? getRevealedPortalSquaresByEffect(historyPreview.portalAfter, "destroy")
    : getRevealedPortalSquaresByEffect(portalState, "destroy");

  const teleportPortalSquares = historyPreview
    ? getRevealedPortalSquaresByEffect(historyPreview.portalAfter, "teleport")
    : getRevealedPortalSquaresByEffect(portalState, "teleport");

  const swapPortalSquares = historyPreview
    ? getRevealedPortalSquaresByEffect(historyPreview.portalAfter, "swap")
    : getRevealedPortalSquaresByEffect(portalState, "swap");

  const promotePortalSquares = historyPreview
    ? getRevealedPortalSquaresByEffect(historyPreview.portalAfter, "promote")
    : getRevealedPortalSquaresByEffect(portalState, "promote");

  const regularCaptures = records.filter((record) => record.captured);

  const capturedWhite = regularCaptures
    .filter((record) => record.color === "b")
    .map((record) => record.captured!);

  const capturedBlack = regularCaptures
    .filter((record) => record.color === "w")
    .map((record) => record.captured!);

  const whiteMaterial = capturedBlack.reduce(
    (total, piece) => total + pieceValues[piece],
    0,
  );

  const blackMaterial = capturedWhite.reduce(
    (total, piece) => total + pieceValues[piece],
    0,
  );

  const materialDifference = whiteMaterial - blackMaterial;

  function playSound(sound: string) {
    const audio = new Audio(`/sounds/${sound}.mp3`);

    audio.play().catch(() => {});
  }

  function checkGameOver(
    nextRecords: PortalMoveRecord[],
    playResultSound: boolean,
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

    if (isThreefoldPortal(nextRecords, initialFen, game.fen())) {
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

  function appendFinalRecord(
    move: {
      color: PortalSide;
      piece: PortalPieceType;
      from: Square;
      to: Square;
      san: string;
      captured?: PortalPieceType;
    },
    beforeFen: string,
    portalBefore: PortalState,
    portalAfter: PortalState,
    portalEvent: PortalEvent | null,
  ) {
    const record: PortalMoveRecord = {
      ply: records.length + 1,

      san: move.san,

      color: move.color,

      from: move.from,

      to: move.to,

      captured: move.captured,

      fenBefore: beforeFen,

      fenAfter: game.fen(),

      portalBefore: clonePortalState(portalBefore),

      portalAfter: clonePortalState(portalAfter),

      portalEvent: portalEvent
        ? {
            ...portalEvent,
          }
        : null,
    };

    const nextRecords = [...records, record];

    setRecords(nextRecords);

    setPortalState(portalAfter);

    setPosition(game.fen());

    setActivePortalSquare(portalEvent ? portalEvent.square : null);

    if (portalEvent) {
      window.setTimeout(() => {
        setActivePortalSquare(null);
      }, 900);
    }

    if (!game.isCheckmate() && game.isCheck()) {
      playSound("check");
    }

    checkGameOver(nextRecords, true);
  }

  function finishStandardMove(
    move: {
      color: PortalSide;
      piece: PortalPieceType;
      from: Square;
      to: Square;
      san: string;
      captured?: PortalPieceType;
    },
    beforeFen: string,
    portalBefore: PortalState,
  ) {
    const resolution = resolvePortalAfterMove(
      game,
      portalBefore,
      move.to,
      {
        color: move.color,

        piece: move.piece,
      },
      records.length + 1,
    );

    setLastMove({
      from: move.from,
      to: move.to,
    });

    if (move.captured) {
      playPieceCaptureSound(move.piece);
    } else {
      playPieceMoveSound(move.piece);
    }

    if (resolution.pendingPromotion) {
      setPortalState(resolution.state);

      setPosition(game.fen());

      setActivePortalSquare(move.to);

      setPendingPortalPromotion({
        pending: resolution.pendingPromotion,

        move,

        beforeFen,

        portalBefore: clonePortalState(portalBefore),

        portalAfterReveal: clonePortalState(resolution.state),
      });

      playRandomSound(["castle-1", "castle-2"]);

      return;
    }

    appendFinalRecord(
      move,
      beforeFen,
      portalBefore,
      resolution.state,
      resolution.event,
    );
  }

  function resolvePromotionCard(card: PortalPromotionCard) {
    if (!pendingPortalPromotion) {
      return;
    }

    const { move, beforeFen, portalBefore, portalAfterReveal, pending } =
      pendingPortalPromotion;

    const square = pending.portalSquare;

    if (card === "k") {
      /*
       * The fake King prize is the prank:
       * the Pawn is erased instead.
       */
      game.remove(square);
    } else if (card !== "p") {
      game.remove(square);

      game.put(
        {
          type: card,
          color: move.color,
        },
        square,
      );
    }

    const event: PortalEvent = {
      ply: records.length + 1,

      square,

      effect: "promote",

      result: "promotion-card",

      color: move.color,

      piece: move.piece,

      promotionCard: card,
    };

    const finalState = finalizePortalPromotionEvent(portalAfterReveal, event);

    setPendingPortalPromotion(null);

    appendFinalRecord(move, beforeFen, portalBefore, finalState, event);
  }

  function handleSquareClick(row: number, column: number) {
    if (gameOver || historyPreview || flipPending || pendingPortalPromotion) {
      return;
    }

    if (promotionFrom && promotionSquare) {
      return;
    }

    const square = getSquareName(row, column);

    const clickedPiece = game.get(square);

    if (selectedSquare === null) {
      if (!clickedPiece || clickedPiece.color !== game.turn()) {
        return;
      }

      setSelectedSquare(square);

      playPieceSelectSound(clickedPiece.type);

      setLegalMoves(
        game
          .moves({
            square,
            verbose: true,
          })
          .map((move) => move.to),
      );

      return;
    }

    if (clickedPiece && clickedPiece.color === game.turn()) {
      setSelectedSquare(square);

      playPieceSelectSound(clickedPiece.type);

      setLegalMoves(
        game
          .moves({
            square,
            verbose: true,
          })
          .map((move) => move.to),
      );

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

    try {
      const beforeFen = game.fen();

      const portalBefore = clonePortalState(portalState);

      const move = game.move({
        from: selectedSquare,
        to: square,
      });

      const moveInfo = {
        color: move.color as PortalSide,

        piece: move.piece as PortalPieceType,

        from: move.from,

        to: move.to,

        san: move.san,

        captured: move.captured as PortalPieceType | undefined,
      };

      setSelectedSquare(null);

      setLegalMoves([]);

      setHistoryPreviewPly(null);

      finishStandardMove(moveInfo, beforeFen, portalBefore);
    } catch {
      playSound("illegal");

      setSelectedSquare(null);

      setLegalMoves([]);
    }
  }

  function promotePawn(piece: "q" | "r" | "b" | "n") {
    if (!promotionFrom || !promotionSquare || pendingPortalPromotion) {
      return;
    }

    try {
      const beforeFen = game.fen();

      const portalBefore = clonePortalState(portalState);

      const move = game.move({
        from: promotionFrom,

        to: promotionSquare,

        promotion: piece,
      });

      const moveInfo = {
        color: move.color as PortalSide,

        piece: move.piece as PortalPieceType,

        from: move.from,

        to: move.to,

        san: move.san,

        captured: move.captured as PortalPieceType | undefined,
      };

      setPromotionFrom(null);

      setPromotionSquare(null);

      setSelectedSquare(null);

      setLegalMoves([]);

      finishStandardMove(moveInfo, beforeFen, portalBefore);
    } catch {
      setPromotionFrom(null);

      setPromotionSquare(null);

      playSound("illegal");
    }
  }

  function undoMove() {
    if (records.length === 0 || pendingPortalPromotion) {
      return;
    }

    const nextRecords = records.slice(0, -1);

    const targetFen =
      nextRecords[nextRecords.length - 1]?.fenAfter ?? initialFen;

    const targetPortalState =
      nextRecords[nextRecords.length - 1]?.portalAfter ??
      createInitialPortalState(seed);

    game.load(targetFen);

    snapToSide(game.turn());

    setRecords(nextRecords);

    setPortalState(clonePortalState(targetPortalState));

    setPosition(game.fen());

    setLastMove(
      nextRecords[nextRecords.length - 1]
        ? {
            from: nextRecords[nextRecords.length - 1].from,

            to: nextRecords[nextRecords.length - 1].to,
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

    checkGameOver(nextRecords, false);
  }

  function restartGame() {
    const nextSeed = createPortalSeed();

    setSeed(nextSeed);

    game.reset();

    snapToSide("w");

    setPortalState(createInitialPortalState(nextSeed));

    setRecords([]);
    setPosition(game.fen());
    setSelectedSquare(null);
    setLegalMoves([]);
    setLastMove(null);
    setPromotionFrom(null);
    setPromotionSquare(null);
    setHistoryPreviewPly(null);
    setPendingPortalPromotion(null);
    setActivePortalSquare(null);
    setGameOver(false);
    setGameOverReason("");
    setWinner("white");
  }

  const portalEvents = portalState.events;

  const revealedPortals = portalState.portals.filter(
    (portal) => portal.revealed,
  );

  return (
    <div
      className="
        min-h-screen
        bg-zinc-950
        px-4
        py-6
        text-zinc-100
      "
    >
      <div
        className="
          mx-auto
          max-w-[1600px]
        "
      >
        <header
          className="
            mb-5
            flex
            flex-wrap
            items-center
            justify-between
            gap-3
          "
        >
          <div>
            <p
              className="
                text-xs
                font-black
                uppercase
                tracking-[0.25em]
                text-violet-300
              "
            >
              {t("Chess Variant")}
            </p>

            <h1
              className="
                mt-1
                text-2xl
                font-black
                text-white
              "
            >
              🌀 {t("Portal Chess")}
            </h1>

            <p
              className="
                mt-1
                text-sm
                text-zinc-500
              "
            >
              {t("Invisible chaos on ranks 4 and 5")}
            </p>
          </div>

          <div
            className="
              flex
              items-center
              gap-2
            "
          >
            <span
              className="
                rounded-full
                border
                border-violet-300/15
                bg-violet-400/[0.06]
                px-3
                py-1.5
                text-xs
                font-black
                text-violet-200
              "
            >
              {game.turn() === "w" ? t("White to move") : t("Black to move")}
            </span>

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
              🌐
              <select
                value={language}
                onChange={(event) =>
                  changeLanguage(event.target.value as Language)
                }
                className="
                  bg-transparent
                  font-bold
                  text-zinc-200
                  outline-none
                  [color-scheme:dark]
                "
              >
                <option value="en">English</option>

                <option value="de">Deutsch</option>

                <option value="bar">Boarisch</option>

                <option value="ko">한국어</option>

                <option value="ru">Русский</option>
              </select>
            </label>
          </div>
        </header>

        <div
          className="
            grid
            gap-5
            xl:grid-cols-[290px_minmax(0,1fr)_320px]
          "
        >
          {/* LEFT */}

          <aside
            className="
              space-y-4
            "
          >
            <Panel title={t("Game Controls")}>
              <div
                className="
                  grid
                  grid-cols-2
                  gap-2
                "
              >
                <button
                  type="button"
                  onClick={undoMove}
                  disabled={
                    records.length === 0 || Boolean(pendingPortalPromotion)
                  }
                  className="
                    rounded-xl
                    border
                    border-white/10
                    bg-white/5
                    px-3
                    py-2.5
                    text-xs
                    font-black
                    text-zinc-200
                    transition
                    hover:bg-white/10
                    disabled:cursor-not-allowed
                    disabled:opacity-35
                  "
                >
                  ↶ {t("Undo")}
                </button>

                <button
                  type="button"
                  onClick={restartGame}
                  className="
                    rounded-xl
                    bg-violet-300
                    px-3
                    py-2.5
                    text-xs
                    font-black
                    text-zinc-950
                    transition
                    hover:bg-violet-200
                  "
                >
                  ↺ {t("Restart")}
                </button>
              </div>
            </Panel>

            <Panel title={t("Captured Pieces")}>
              <div
                className="
                  space-y-3
                "
              >
                <div>
                  <p
                    className="
                      mb-1
                      text-[10px]
                      font-black
                      uppercase
                      tracking-wider
                      text-zinc-500
                    "
                  >
                    {t("White")}
                  </p>

                  <div
                    className="
                      min-h-7
                      text-2xl
                    "
                  >
                    {capturedWhite.length
                      ? capturedWhite
                          .map((piece) => whiteSymbols[piece])
                          .join(" ")
                      : "—"}
                  </div>
                </div>

                <div>
                  <p
                    className="
                      mb-1
                      text-[10px]
                      font-black
                      uppercase
                      tracking-wider
                      text-zinc-500
                    "
                  >
                    {t("Black")}
                  </p>

                  <div
                    className="
                      min-h-7
                      text-2xl
                    "
                  >
                    {capturedBlack.length
                      ? capturedBlack
                          .map((piece) => blackSymbols[piece])
                          .join(" ")
                      : "—"}
                  </div>
                </div>

                <div
                  className="
                    rounded-lg
                    bg-white/[0.04]
                    px-3
                    py-2
                    text-center
                    text-xs
                    font-black
                    text-zinc-300
                  "
                >
                  {materialDifference === 0
                    ? t("Equal")
                    : materialDifference > 0
                      ? `White +${materialDifference}`
                      : `Black +${Math.abs(materialDifference)}`}
                </div>
              </div>
            </Panel>

            <Panel title={t("Move History")}>
              <div
                className="
                  max-h-[360px]
                  space-y-1
                  overflow-y-auto
                  pr-1
                "
              >
                {records.length === 0 ? (
                  <p
                    className="
                      text-xs
                      text-zinc-500
                    "
                  >
                    {t("No moves yet")}
                  </p>
                ) : (
                  records.map((record, index) => (
                    <button
                      key={record.ply}
                      type="button"
                      onClick={() => setHistoryPreviewPly(record.ply)}
                      className={`
                          flex
                          w-full
                          items-center
                          justify-between
                          rounded-lg
                          px-2.5
                          py-2
                          text-left
                          text-xs
                          transition
                          ${
                            historyPreviewPly === record.ply
                              ? "bg-violet-400/15 text-violet-100"
                              : "bg-white/[0.03] text-zinc-300 hover:bg-white/[0.07]"
                          }
                        `}
                    >
                      <span>
                        {Math.floor(index / 2) + 1}
                        {record.color === "w" ? "." : "..."} {record.san}
                      </span>

                      {record.portalEvent && (
                        <span>{effectIcon(record.portalEvent.effect)}</span>
                      )}
                    </button>
                  ))
                )}
              </div>
            </Panel>
          </aside>

          {/* CENTER */}

          <main>
            {historyPreview && (
              <div
                className="
                  mb-3
                  flex
                  items-center
                  justify-between
                  gap-3
                  rounded-xl
                  border
                  border-violet-300/15
                  bg-violet-400/[0.06]
                  px-4
                  py-3
                "
              >
                <div>
                  <p
                    className="
                      text-xs
                      font-black
                      text-violet-200
                    "
                  >
                    {t("History Preview")}
                  </p>

                  <p
                    className="
                      text-[11px]
                      text-zinc-500
                    "
                  >
                    {historyPreview.san}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setHistoryPreviewPly(null)}
                  className="
                    rounded-lg
                    bg-white/10
                    px-3
                    py-2
                    text-xs
                    font-black
                    text-zinc-200
                    transition
                    hover:bg-white/20
                  "
                >
                  {t("Back to Live Board")}
                </button>
              </div>
            )}

            {promotionFrom && promotionSquare && !historyPreview && (
              <div
                className="
                    mb-3
                  "
              >
                <PromotionBar onPromote={promotePawn} />
              </div>
            )}

            <div
              className="
                relative
              "
            >
              <Board
                board={displayedBoard}
                selectedSquare={historyPreview ? null : selectedSquare}
                legalMoves={historyPreview ? [] : legalMoves}
                lastMove={
                  historyPreview
                    ? {
                        from: historyPreview.from,
                        to: historyPreview.to,
                      }
                    : lastMove
                }
                checkedKingSquare={checkedKingSquare}
                onSquareClick={
                  historyPreview ||
                  flipPending ||
                  Boolean(pendingPortalPromotion)
                    ? () => {}
                    : handleSquareClick
                }
                orientation={boardOrientation}
                destroyPortalSquares={destroyPortalSquares}
                teleportPortalSquares={teleportPortalSquares}
                swapPortalSquares={swapPortalSquares}
                promotePortalSquares={promotePortalSquares}
                activePortalSquares={
                  activePortalSquare ? [activePortalSquare] : []
                }
              />

              {gameOver && !historyPreview && (
                <div
                  className="
                      absolute
                      inset-0
                      z-40
                      flex
                      items-center
                      justify-center
                      rounded-[28px]
                      bg-zinc-950/75
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
                      "
                  >
                    <p
                      className="
                          text-xs
                          font-black
                          uppercase
                          tracking-[0.2em]
                          text-violet-300
                        "
                    >
                      {t("Game Over")}
                    </p>

                    <h2
                      className="
                          mt-2
                          text-2xl
                          font-black
                          text-white
                        "
                    >
                      {winner === "white"
                        ? t("White wins")
                        : winner === "black"
                          ? t("Black wins")
                          : t("Draw")}
                    </h2>

                    <p
                      className="
                          mt-2
                          text-sm
                          text-zinc-400
                        "
                    >
                      {t(gameOverReason)}
                    </p>

                    <button
                      type="button"
                      onClick={restartGame}
                      className="
                          mt-5
                          w-full
                          rounded-xl
                          bg-violet-300
                          px-4
                          py-3
                          text-sm
                          font-black
                          text-zinc-950
                          hover:bg-violet-200
                        "
                    >
                      ↺ {t("Restart")}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </main>

          {/* RIGHT */}

          <aside
            className="
              space-y-4
            "
          >
            <Panel title={t("Portal Guide")} subtitle={t("What can happen?")}>
              <p
                className="
                  mb-3
                  rounded-xl
                  border
                  border-violet-300/10
                  bg-violet-400/[0.05]
                  px-3
                  py-2
                  text-[11px]
                  font-bold
                  text-violet-100
                "
              >
                {t("Hidden portals spawn only on ranks 4 and 5.")}
              </p>

              <div
                className="
                  space-y-2
                "
              >
                {[
                  ["💥", "Destroy", "Your piece may vanish."],
                  [
                    "🌀",
                    "Teleport",
                    "Your piece jumps to a random safe empty square.",
                  ],
                  [
                    "🔄",
                    "Swap",
                    "Your piece may swap places with a random enemy piece.",
                  ],
                  ["🎴", "Promote", "Pawn only: choose one mystery card."],
                ].map(([icon, title, description]) => (
                  <div
                    key={title}
                    className="
                        flex
                        gap-3
                        rounded-xl
                        border
                        border-white/5
                        bg-white/[0.03]
                        p-3
                      "
                  >
                    <div
                      className="
                          text-2xl
                        "
                    >
                      {icon}
                    </div>

                    <div>
                      <p
                        className="
                            text-xs
                            font-black
                            text-white
                          "
                      >
                        {t(title)}
                      </p>

                      <p
                        className="
                            mt-0.5
                            text-[10px]
                            leading-relaxed
                            text-zinc-500
                          "
                      >
                        {t(description)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel title={t("Promotion Card Pool")}>
              <div
                className="
                  grid
                  grid-cols-3
                  gap-2
                "
              >
                {[
                  ["♙", "8", "Pawn"],
                  ["♗", "2", "Bishop"],
                  ["♘", "2", "Knight"],
                  ["♖", "2", "Rook"],
                  ["♕", "1", "Queen"],
                  ["♔", "1", "King"],
                ].map(([symbol, count, name]) => (
                  <div
                    key={name}
                    className="
                        rounded-xl
                        border
                        border-white/5
                        bg-white/[0.03]
                        p-2
                        text-center
                      "
                  >
                    <div
                      className="
                          text-2xl
                          text-amber-100
                        "
                    >
                      {symbol}
                    </div>

                    <p
                      className="
                          mt-1
                          text-[10px]
                          font-black
                          text-zinc-300
                        "
                    >
                      {count}× {t(name)}
                    </p>
                  </div>
                ))}
              </div>

              <p
                className="
                  mt-3
                  text-[10px]
                  font-bold
                  text-red-300/80
                "
              >
                ⚠ {t("The King card is suspicious.")}
              </p>
            </Panel>

            <Panel title={t("Revealed Portals")}>
              {revealedPortals.length === 0 ? (
                <p
                  className="
                    text-xs
                    text-zinc-500
                  "
                >
                  {t("None discovered yet")}
                </p>
              ) : (
                <div
                  className="
                    grid
                    grid-cols-2
                    gap-2
                  "
                >
                  {revealedPortals.map((portal) => (
                    <div
                      key={portal.id}
                      className="
                          rounded-xl
                          border
                          border-white/5
                          bg-white/[0.03]
                          px-3
                          py-2
                        "
                    >
                      <p
                        className="
                            text-sm
                            font-black
                            text-white
                          "
                      >
                        {effectIcon(portal.effect)} {portal.square}
                      </p>

                      <p
                        className="
                            mt-0.5
                            text-[10px]
                            text-zinc-500
                          "
                      >
                        {t(
                          portal.effect === "destroy"
                            ? "Destroy"
                            : portal.effect === "teleport"
                              ? "Teleport"
                              : portal.effect === "swap"
                                ? "Swap"
                                : "Promote",
                        )}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </Panel>

            <Panel title={t("Portal Events")}>
              {portalEvents.length === 0 ? (
                <p
                  className="
                    text-xs
                    text-zinc-500
                  "
                >
                  {t("No portal has fired yet")}
                </p>
              ) : (
                <div
                  className="
                    max-h-[260px]
                    space-y-2
                    overflow-y-auto
                    pr-1
                  "
                >
                  {[...portalEvents].reverse().map((event, index) => (
                    <div
                      key={`${event.ply}-${index}`}
                      className="
                            rounded-xl
                            border
                            border-white/5
                            bg-white/[0.03]
                            px-3
                            py-2
                          "
                    >
                      <div
                        className="
                              flex
                              items-center
                              justify-between
                              gap-2
                            "
                      >
                        <span
                          className="
                                text-xs
                                font-black
                                text-white
                              "
                        >
                          {effectIcon(event.effect)} {event.square}
                        </span>

                        <span
                          className="
                                text-[9px]
                                font-bold
                                text-zinc-600
                              "
                        >
                          #{event.ply}
                        </span>
                      </div>

                      <p
                        className="
                              mt-1
                              text-[10px]
                              text-zinc-500
                            "
                      >
                        {event.result}
                        {event.destination ? ` → ${event.destination}` : ""}
                        {event.swapSquare ? ` ↔ ${event.swapSquare}` : ""}
                        {event.promotionCard
                          ? ` · ${t(promotionCardNames[event.promotionCard])}`
                          : ""}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </aside>
        </div>
      </div>

      {pendingPortalPromotion && (
        <PortalPromotionModal
          pending={pendingPortalPromotion.pending}
          color={pendingPortalPromotion.move.color}
          t={t}
          onResolve={resolvePromotionCard}
        />
      )}
    </div>
  );
}
