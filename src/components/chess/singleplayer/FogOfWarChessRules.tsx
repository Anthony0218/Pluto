import { gameUi } from "../../../i18n/gameUi.ts";
import ChessPageHeader from "@/components/chess/ChessPageHeader";
import { ui, useUiLanguage } from "@/i18n/ui";
import { useAppLanguage } from "@/i18n/languageStore";
import { Link } from "react-router-dom";

type Language = "en" | "de" | "bar" | "ko" | "ru" | "es" | "pt";

type ExampleSquare = {
  piece?: string;
  visible?: boolean;
  highlighted?: boolean;
  enemy?: boolean;
  fog?: boolean;
  label?: string;
};

type ExampleBoard = Record<string, ExampleSquare>;


const translations: Record<"de" | "bar" | "ko" | "ru", Record<string, string>> & Partial<Record<"es" | "pt", Record<string, string>>> = {
  de: {
    "Chess Variant V": "Schachvariante V",
    "Fog of War Chess": "Nebel-des-Krieges-Schach",
    "Rules & Examples": "Regeln & Beispiele",
    "Back to Fog of War": "Zurück zu Fog of War",
    Language: "Sprache",
    "Core idea": "Grundidee",
    "You do not see the whole board. You always see your own army, plus squares your pieces currently attack or can legally move to.":
      "Du siehst nicht das ganze Brett. Deine eigenen Figuren sind immer sichtbar, zusätzlich die Felder, die deine Figuren gerade angreifen oder legal erreichen können.",
    "Normal chess rules still apply underneath the fog.":
      "Unter dem Nebel gelten weiterhin die normalen Schachregeln.",
    "Visible square": "Sichtbares Feld",
    "Fogged square": "Verdecktes Feld",
    "Your piece": "Eigene Figur",
    "Visible enemy": "Sichtbarer Gegner",
    "Hidden enemy": "Verdeckter Gegner",
    "1. Your army is always visible": "1. Deine Armee ist immer sichtbar",
    "All of your own pieces remain visible even when surrounding squares are covered by fog.":
      "Alle eigenen Figuren bleiben sichtbar, auch wenn umliegende Felder vom Nebel verdeckt sind.",
    "2. Attacks reveal squares": "2. Angriffe decken Felder auf",
    "Squares attacked by your pieces become visible. Sliding pieces reveal along their line until the first occupied square.":
      "Felder, die von deinen Figuren angegriffen werden, werden sichtbar. Läufer, Türme und Damen decken ihre Linie bis zur ersten besetzten Stelle auf.",
    "3. Hidden enemy pieces": "3. Verdeckte gegnerische Figuren",
    "An enemy piece outside your current vision is completely hidden. You only see it once one of your pieces can attack or legally reach its square.":
      "Eine gegnerische Figur außerhalb deiner Sicht ist vollständig verborgen. Sie wird erst sichtbar, wenn eine deiner Figuren ihr Feld angreifen oder legal erreichen kann.",
    "4. Choose the starting position": "4. Zufälliger symmetrischer Start",
    "Fog of War can start from normal chess or from Random Start. In Random Start, Queen, Bishops and Knights are shuffled across b/c/d/f/g; King stays on e, Rooks stay on a/h, and Black mirrors White exactly.":
      "Dame, Läufer und Springer werden auf b/c/d/f/g gemischt. Der König bleibt auf e, die Türme auf a/h, und Schwarz spiegelt Weiß exakt.",
    "The start option is chosen before the game. In Random Start, castling still works normally because King and Rooks remain on their standard squares.":
      "Die Rochade funktioniert normal, weil König und Türme auf ihren Standardfeldern bleiben.",
    "5. Hotseat privacy screen": "5. Hotseat-Sichtschutz",
    "After every move the board is covered. Pass the device to the next player, then press Reveal Board to show only that player's fogged view.":
      "Nach jedem Zug wird das Brett verdeckt. Gib das Gerät weiter und drücke anschließend Brett aufdecken, damit nur die Nebelsicht des nächsten Spielers erscheint.",
    "6. Check, checkmate and legality": "6. Schach, Schachmatt und Legalität",
    "The full hidden position is still used for legal move checking, check, checkmate, castling, promotion and draw rules. Fog changes information, not chess legality.":
      "Für legale Züge, Schach, Schachmatt, Rochade, Umwandlung und Remis wird weiterhin die vollständige verborgene Stellung verwendet. Der Nebel verändert die Information, nicht die Schachregeln.",
    "7. Undo and history": "7. Rückgängig und Verlauf",
    "Undo restores the previous full position and hides the board again. History previews remain fogged instead of exposing the full board.":
      "Rückgängig stellt die vorherige vollständige Stellung wieder her und verdeckt das Brett erneut. Verlaufsansichten bleiben vernebelt und zeigen nicht das vollständige Brett.",
    "Example A — White rook vision": "Beispiel A — Sicht des weißen Turms",
    "The rook reveals its file and rank until a piece blocks the line.":
      "Der Turm deckt Linie und Reihe auf, bis eine Figur die Sicht blockiert.",
    "Example B — Hidden enemy": "Beispiel B — Verdeckter Gegner",
    "The black Queen is outside White's vision, so White sees only fog on h6.":
      "Die schwarze Dame liegt außerhalb der weißen Sicht, daher sieht Weiß auf h6 nur Nebel.",
    "Example C — Random Start option": "Beispiel C — Zufallsstart",
    "When Random Start is enabled, both sides receive the exact same shuffled back-rank pattern. With it disabled, the normal chess starting position is used.":
      "Beide Seiten erhalten exakt dieselbe gemischte Grundreihen-Anordnung.",
    "Board legend": "Brett-Legende",
    Visible: "Sichtbar",
    Fog: "Nebel",
  },

  bar: {
    "Chess Variant V": "Schachvariantn V",
    "Fog of War Chess": "Nebel-Schach",
    "Rules & Examples": "Regeln & Beispiele",
    "Back to Fog of War": "Zruck zum Nebel-Schach",
    Language: "Sproch",
    "Core idea": "Grundidee",
    "You do not see the whole board. You always see your own army, plus squares your pieces currently attack or can legally move to.":
      "Du siehst ned s ganze Brett. Deine eigenen Figuren siehst immer, dazu de Felder, de deine Figuren angreifn oder legal erreichen.",
    "Normal chess rules still apply underneath the fog.":
      "Unter'm Nebel gelten trotzdem de normalen Schachregeln.",
    "Visible square": "Sichtbares Feld",
    "Fogged square": "Nebel-Feld",
    "Your piece": "Deine Figur",
    "Visible enemy": "Sichtbarer Gegner",
    "Hidden enemy": "Verdeckter Gegner",
    "1. Your army is always visible": "1. Deine Armee siehst immer",
    "All of your own pieces remain visible even when surrounding squares are covered by fog.":
      "Deine eigenen Figuren bleibn sichtbar, aa wenn rundum Nebel is.",
    "2. Attacks reveal squares": "2. Angriffe deckn Felder auf",
    "Squares attacked by your pieces become visible. Sliding pieces reveal along their line until the first occupied square.":
      "Felder, de deine Figuren angreifn, werdn sichtbar. Läufer, Türm und Dame schaun bis zur ersten Figur.",
    "3. Hidden enemy pieces": "3. Verdeckte Gegner",
    "An enemy piece outside your current vision is completely hidden. You only see it once one of your pieces can attack or legally reach its square.":
      "A Gegner außerhalb deiner Sicht is komplett versteckt. Du siehst ihn erst, wennst sein Feld angreifn oder legal erreichen kannst.",
    "4. Choose the starting position": "4. Zufälliger symmetrischer Start",
    "Fog of War can start from normal chess or from Random Start. In Random Start, Queen, Bishops and Knights are shuffled across b/c/d/f/g; King stays on e, Rooks stay on a/h, and Black mirrors White exactly.":
      "Dame, Läufer und Springer werdn auf b/c/d/f/g g'mischt. Kini bleibt auf e, Türm auf a/h, Schwarz spiegelt Weiß.",
    "The start option is chosen before the game. In Random Start, castling still works normally because King and Rooks remain on their standard squares.":
      "Rochade geht normal, weil Kini und Türm auf de Standardfelder bleibn.",
    "5. Hotseat privacy screen": "5. Hotseat-Sichtschutz",
    "After every move the board is covered. Pass the device to the next player, then press Reveal Board to show only that player's fogged view.":
      "Nach jedem Zug wird s Brett verdeckt. Gerät weitergebn und dann Brett aufdeckn.",
    "6. Check, checkmate and legality": "6. Schach, Schachmatt und Legalität",
    "The full hidden position is still used for legal move checking, check, checkmate, castling, promotion and draw rules. Fog changes information, not chess legality.":
      "Für legale Züg, Schach, Schachmatt, Rochade, Umwandlung und Remis zählt weiterhin de volle Stellung. Nebel ändert nur de Information.",
    "7. Undo and history": "7. Zruck und Verlauf",
    "Undo restores the previous full position and hides the board again. History previews remain fogged instead of exposing the full board.":
      "Zruck stellt de vorige Stellung wieder her und verdeckt s Brett wieder. Verlauf bleibt im Nebel.",
    "Example A — White rook vision": "Beispiel A — Sicht vom weißen Turm",
    "The rook reveals its file and rank until a piece blocks the line.":
      "Da Turm deckt Linie und Reihe auf, bis a Figur blockiert.",
    "Example B — Hidden enemy": "Beispiel B — Verdeckter Gegner",
    "The black Queen is outside White's vision, so White sees only fog on h6.":
      "De schwarze Dame is außerhalb da Sicht, also sieht Weiß auf h6 bloß Nebel.",
    "Example C — Random Start option": "Beispiel C — Zufallsstart",
    "When Random Start is enabled, both sides receive the exact same shuffled back-rank pattern. With it disabled, the normal chess starting position is used.":
      "Beide Seiten kriagn exakt de gleiche gemischte Grundreihe.",
    "Board legend": "Brett-Legende",
    Visible: "Sichtbar",
    Fog: "Nebel",
  },

  ko: {
    "Chess Variant V": "체스 변형 V",
    "Fog of War Chess": "전장의 안개 체스",
    "Rules & Examples": "규칙 및 예시",
    "Back to Fog of War": "전장의 안개 체스로 돌아가기",
    Language: "언어",
    "Core idea": "핵심 규칙",
    "You do not see the whole board. You always see your own army, plus squares your pieces currently attack or can legally move to.":
      "전체 체스판을 볼 수 없습니다. 자신의 기물은 항상 보이며, 자신의 기물이 현재 공격하거나 합법적으로 이동할 수 있는 칸도 보입니다.",
    "Normal chess rules still apply underneath the fog.":
      "안개 아래에서는 일반 체스 규칙이 그대로 적용됩니다.",
    "Visible square": "보이는 칸",
    "Fogged square": "안개 칸",
    "Your piece": "내 기물",
    "Visible enemy": "보이는 상대 기물",
    "Hidden enemy": "숨겨진 상대 기물",
    "1. Your army is always visible": "1. 내 기물은 항상 보입니다",
    "All of your own pieces remain visible even when surrounding squares are covered by fog.":
      "주변 칸이 안개로 가려져 있어도 자신의 모든 기물은 항상 보입니다.",
    "2. Attacks reveal squares": "2. 공격 가능한 칸은 보입니다",
    "Squares attacked by your pieces become visible. Sliding pieces reveal along their line until the first occupied square.":
      "자신의 기물이 공격하는 칸은 보입니다. 비숍, 룩, 퀸은 첫 번째 기물에 막힐 때까지 시야를 확보합니다.",
    "3. Hidden enemy pieces": "3. 보이지 않는 상대 기물",
    "An enemy piece outside your current vision is completely hidden. You only see it once one of your pieces can attack or legally reach its square.":
      "현재 시야 밖에 있는 상대 기물은 완전히 숨겨집니다. 자신의 기물이 그 칸을 공격하거나 합법적으로 도달할 수 있을 때만 보입니다.",
    "4. Choose the starting position": "4. 대칭 랜덤 시작",
    "Fog of War can start from normal chess or from Random Start. In Random Start, Queen, Bishops and Knights are shuffled across b/c/d/f/g; King stays on e, Rooks stay on a/h, and Black mirrors White exactly.":
      "퀸, 비숍 2개, 나이트 2개가 b/c/d/f/g에 무작위 배치됩니다. 킹은 e, 룩은 a/h에 그대로 있으며 흑은 백의 배치를 정확히 대칭으로 사용합니다.",
    "The start option is chosen before the game. In Random Start, castling still works normally because King and Rooks remain on their standard squares.":
      "킹과 룩이 원래 위치에 남아 있으므로 캐슬링은 일반 체스와 동일하게 가능합니다.",
    "5. Hotseat privacy screen": "5. 핫시트 프라이버시 화면",
    "After every move the board is covered. Pass the device to the next player, then press Reveal Board to show only that player's fogged view.":
      "매 수가 끝난 뒤 보드가 가려집니다. 기기를 다음 플레이어에게 넘긴 뒤 보드 공개를 눌러 해당 플레이어의 안개 시야만 표시합니다.",
    "6. Check, checkmate and legality": "6. 체크, 체크메이트 및 합법성",
    "The full hidden position is still used for legal move checking, check, checkmate, castling, promotion and draw rules. Fog changes information, not chess legality.":
      "합법 수, 체크, 체크메이트, 캐슬링, 프로모션, 무승부 판정에는 숨겨진 전체 실제 보드가 사용됩니다. 안개는 정보만 바꾸며 체스의 합법성은 바꾸지 않습니다.",
    "7. Undo and history": "7. 되돌리기 및 기록",
    "Undo restores the previous full position and hides the board again. History previews remain fogged instead of exposing the full board.":
      "되돌리기는 이전 전체 위치를 복원한 뒤 다시 보드를 가립니다. 기록 미리보기 역시 전체 보드를 공개하지 않고 안개 상태로 표시됩니다.",
    "Example A — White rook vision": "예시 A — 백 룩의 시야",
    "The rook reveals its file and rank until a piece blocks the line.":
      "룩은 다른 기물에 막힐 때까지 같은 파일과 랭크의 칸을 볼 수 있습니다.",
    "Example B — Hidden enemy": "예시 B — 숨겨진 상대 기물",
    "The black Queen is outside White's vision, so White sees only fog on h6.":
      "흑 퀸이 백의 시야 밖에 있으므로 백에게 h6은 안개로만 보입니다.",
    "Example C — Random Start option": "예시 C — 랜덤 시작",
    "When Random Start is enabled, both sides receive the exact same shuffled back-rank pattern. With it disabled, the normal chess starting position is used.":
      "양쪽은 정확히 동일하게 섞인 후방 랭크 배치를 사용합니다.",
    "Board legend": "보드 범례",
    Visible: "보임",
    Fog: "안개",
  },

  ru: {
    "Chess Variant V": "Шахматный вариант V",
    "Fog of War Chess": "Шахматы с туманом войны",
    "Rules & Examples": "Правила и примеры",
    "Back to Fog of War": "Назад к Fog of War",
    Language: "Язык",
    "Core idea": "Основная идея",
    "You do not see the whole board. You always see your own army, plus squares your pieces currently attack or can legally move to.":
      "Вы не видите всю доску. Свои фигуры видны всегда, а также поля, которые ваши фигуры атакуют или на которые могут легально пойти.",
    "Normal chess rules still apply underneath the fog.":
      "Под туманом действуют обычные правила шахмат.",
    "Visible square": "Видимое поле",
    "Fogged square": "Поле в тумане",
    "Your piece": "Своя фигура",
    "Visible enemy": "Видимый противник",
    "Hidden enemy": "Скрытый противник",
    "1. Your army is always visible": "1. Свои фигуры видны всегда",
    "All of your own pieces remain visible even when surrounding squares are covered by fog.":
      "Все ваши фигуры остаются видимыми, даже если соседние поля скрыты туманом.",
    "2. Attacks reveal squares": "2. Атаки открывают поля",
    "Squares attacked by your pieces become visible. Sliding pieces reveal along their line until the first occupied square.":
      "Поля, атакуемые вашими фигурами, становятся видимыми. Ладьи, слоны и ферзи открывают линию до первой занятой клетки.",
    "3. Hidden enemy pieces": "3. Скрытые фигуры противника",
    "An enemy piece outside your current vision is completely hidden. You only see it once one of your pieces can attack or legally reach its square.":
      "Фигура противника вне вашего обзора полностью скрыта. Она становится видимой, когда ваша фигура может атаковать её поле или легально попасть на него.",
    "4. Choose the starting position": "4. Случайный симметричный старт",
    "Fog of War can start from normal chess or from Random Start. In Random Start, Queen, Bishops and Knights are shuffled across b/c/d/f/g; King stays on e, Rooks stay on a/h, and Black mirrors White exactly.":
      "Ферзь, слоны и кони случайно размещаются на b/c/d/f/g. Король остаётся на e, ладьи на a/h, а чёрные точно зеркалят белых.",
    "The start option is chosen before the game. In Random Start, castling still works normally because King and Rooks remain on their standard squares.":
      "Рокировка работает нормально, поскольку король и ладьи остаются на стандартных полях.",
    "5. Hotseat privacy screen": "5. Экран приватности Hotseat",
    "After every move the board is covered. Pass the device to the next player, then press Reveal Board to show only that player's fogged view.":
      "После каждого хода доска закрывается. Передайте устройство следующему игроку и нажмите Открыть доску.",
    "6. Check, checkmate and legality": "6. Шах, мат и легальность",
    "The full hidden position is still used for legal move checking, check, checkmate, castling, promotion and draw rules. Fog changes information, not chess legality.":
      "Для проверки легальных ходов, шаха, мата, рокировки, превращения и ничьей используется полная скрытая позиция. Туман меняет информацию, а не шахматные правила.",
    "7. Undo and history": "7. Отмена и история",
    "Undo restores the previous full position and hides the board again. History previews remain fogged instead of exposing the full board.":
      "Отмена восстанавливает предыдущую полную позицию и снова скрывает доску. Просмотр истории также остаётся под туманом.",
    "Example A — White rook vision": "Пример A — обзор белой ладьи",
    "The rook reveals its file and rank until a piece blocks the line.":
      "Ладья открывает вертикаль и горизонталь до первой блокирующей фигуры.",
    "Example B — Hidden enemy": "Пример B — скрытый противник",
    "The black Queen is outside White's vision, so White sees only fog on h6.":
      "Чёрный ферзь находится вне обзора белых, поэтому на h6 белые видят только туман.",
    "Example C — Random Start option": "Пример C — случайный старт",
    "When Random Start is enabled, both sides receive the exact same shuffled back-rank pattern. With it disabled, the normal chess starting position is used.":
      "Обе стороны получают одну и ту же перемешанную расстановку заднего ряда.",
    "Board legend": "Легенда доски",
    Visible: "Видимо",
    Fog: "Туман",
  },
};



function t(language: Language, key: string): string {
  if (language === "en") {
    return key;
  }

  if (language === "bar") {
    return translations.bar[key] ?? translations.de[key] ?? ui(key);
  }

  return translations[language]?.[key] ?? ui(key);
}

const rookVisionBoard: ExampleBoard = {
  e4: {
    piece: "♖",
    visible: true,
    highlighted: true,
    label: "White Rook",
  },

  e1: { visible: true },
  e2: { visible: true },
  e3: { visible: true },
  e5: { visible: true },
  e6: {
    piece: "♟",
    visible: true,
    enemy: true,
    label: "Visible enemy",
  },

  a4: { visible: true },
  b4: { visible: true },
  c4: { visible: true },
  d4: { visible: true },
  f4: { visible: true },
  g4: { visible: true },
  h4: { visible: true },

  d2: {
    piece: "♙",
    visible: true,
  },

  h7: {
    piece: "♛",
    fog: true,
    label: "Hidden Queen",
  },
};

const hiddenEnemyBoard: ExampleBoard = {
  c3: {
    piece: "♘",
    visible: true,
    highlighted: true,
  },

  a2: {
    piece: "♙",
    visible: true,
  },

  b1: { visible: true },
  a4: { visible: true },
  b5: { visible: true },
  d5: { visible: true },
  e4: { visible: true },
  e2: { visible: true },
  d1: { visible: true },

  h6: {
    piece: "♛",
    fog: true,
    label: "Hidden Queen",
  },
};

const randomStartBoard: ExampleBoard = {
  a1: { piece: "♖", visible: true },
  b1: { piece: "♘", visible: true },
  c1: { piece: "♗", visible: true },
  d1: { piece: "♕", visible: true },
  e1: {
    piece: "♔",
    visible: true,
    highlighted: true,
  },
  f1: { piece: "♘", visible: true },
  g1: { piece: "♗", visible: true },
  h1: { piece: "♖", visible: true },

  a8: { piece: "♜", visible: true },
  b8: { piece: "♞", visible: true },
  c8: { piece: "♝", visible: true },
  d8: { piece: "♛", visible: true },
  e8: {
    piece: "♚",
    visible: true,
    highlighted: true,
  },
  f8: { piece: "♞", visible: true },
  g8: { piece: "♝", visible: true },
  h8: { piece: "♜", visible: true },

  a2: { piece: "♙", visible: true },
  b2: { piece: "♙", visible: true },
  c2: { piece: "♙", visible: true },
  d2: { piece: "♙", visible: true },
  e2: { piece: "♙", visible: true },
  f2: { piece: "♙", visible: true },
  g2: { piece: "♙", visible: true },
  h2: { piece: "♙", visible: true },

  a7: { piece: "♟", visible: true },
  b7: { piece: "♟", visible: true },
  c7: { piece: "♟", visible: true },
  d7: { piece: "♟", visible: true },
  e7: { piece: "♟", visible: true },
  f7: { piece: "♟", visible: true },
  g7: { piece: "♟", visible: true },
  h7: { piece: "♟", visible: true },
};

export default function FogOfWarChessRules() {
  useUiLanguage();
  const { language } = useAppLanguage();

  return (
    <main className="min-h-screen bg-transparent px-4 py-6 text-zinc-100 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <ChessPageHeader className="mb-6 rounded-3xl border border-sky-400/15 bg-zinc-900/75 p-6 shadow-xl shadow-black/20" description={<> {t(language, "Rules & Examples")} </>}>
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-sky-300">
                {t(language, "Chess Variant V")}
              </p>

              <h1 className="mt-2 text-3xl font-black text-white">
                {t(language, "Fog of War Chess")}
              </h1>

              <p className="mt-2 text-sm text-zinc-500">
                {t(language, "Rules & Examples")}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                to="/games/chess/variants/fog-of-war/hotseat"
                className="inline-flex rounded-full border border-sky-400/15 bg-sky-400/[0.07] px-4 py-2 text-xs font-black text-sky-200 transition hover:bg-sky-400/[0.13]"
              >
                ← {t(language, "Back to Fog of War")}
              </Link>
            </div>
          </div>
        </ChessPageHeader>

        <section className="mb-6 rounded-3xl border border-sky-400/10 bg-sky-400/[0.035] p-5">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-sky-400/20 bg-sky-400/10 text-2xl">
              🌫
            </div>

            <div>
              <h2 className="font-black text-sky-100">
                {t(language, "Core idea")}
              </h2>

              <p className="mt-2 text-sm leading-7 text-zinc-400">
                {t(
                  language,
                  "You do not see the whole board. You always see your own army, plus squares your pieces currently attack or can legally move to.",
                )}
              </p>

              <p className="mt-2 text-sm font-bold text-zinc-300">
                {t(
                  language,
                  "Normal chess rules still apply underneath the fog.",
                )}
              </p>
            </div>
          </div>
        </section>

        <section className="mb-6 rounded-2xl border border-white/5 bg-zinc-900/55 px-4 py-3">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <span className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-600">
              {t(language, "Board legend")}
            </span>

            <LegendItem
              sample="◻"
              label={t(language, "Visible square")}
              className="border-sky-400/20 bg-sky-400/10 text-sky-200"
            />

            <LegendItem
              sample="🌫"
              label={t(language, "Fogged square")}
              className="border-zinc-500/30 bg-zinc-900 text-zinc-500"
            />

            <LegendItem
              sample="♖"
              label={t(language, "Your piece")}
              className="border-white/10 bg-white/[0.05] text-white"
            />

            <LegendItem
              sample="♟"
              label={t(language, "Visible enemy")}
              className="border-rose-400/20 bg-rose-400/[0.08] text-rose-200"
            />
          </div>
        </section>

        <div className="space-y-5">
          <RuleCard
            number="1"
            title={t(language, "1. Your army is always visible")}
          >
            {t(
              language,
              "All of your own pieces remain visible even when surrounding squares are covered by fog.",
            )}
          </RuleCard>

          <VisualRuleCard
            title={t(language, "Example A — White rook vision")}
            text={t(
              language,
              "The rook reveals its file and rank until a piece blocks the line.",
            )}
          >
            <MiniBoard board={rookVisionBoard} fogByDefault />
          </VisualRuleCard>

          <RuleCard number="2" title={t(language, "2. Attacks reveal squares")}>
            {t(
              language,
              "Squares attacked by your pieces become visible. Sliding pieces reveal along their line until the first occupied square.",
            )}
          </RuleCard>

          <VisualRuleCard
            title={t(language, "Example B — Hidden enemy")}
            text={t(
              language,
              "The black Queen is outside White's vision, so White sees only fog on h6.",
            )}
          >
            <MiniBoard board={hiddenEnemyBoard} fogByDefault />
          </VisualRuleCard>

          <RuleCard number="3" title={t(language, "3. Hidden enemy pieces")}>
            {t(
              language,
              "An enemy piece outside your current vision is completely hidden. You only see it once one of your pieces can attack or legally reach its square.",
            )}
          </RuleCard>

          <RuleCard
            number="4"
            title={t(language, "4. Choose the starting position")}
          >
            <p>
              {t(
                language,
                "Fog of War can start from normal chess or from Random Start. In Random Start, Queen, Bishops and Knights are shuffled across b/c/d/f/g; King stays on e, Rooks stay on a/h, and Black mirrors White exactly.",
              )}
            </p>

            <p className="mt-2">
              {t(
                language,
                "The start option is chosen before the game. In Random Start, castling still works normally because King and Rooks remain on their standard squares.",
              )}
            </p>
          </RuleCard>

          <VisualRuleCard
            title={t(language, "Example C — Random Start option")}
            text={t(
              language,
              "When Random Start is enabled, both sides receive the exact same shuffled back-rank pattern. With it disabled, the normal chess starting position is used.",
            )}
          >
            <MiniBoard board={randomStartBoard} fogByDefault={false} />
          </VisualRuleCard>

          <RuleCard number="5" title={t(language, "5. Hotseat privacy screen")}>
            {t(
              language,
              "After every move the board is covered. Pass the device to the next player, then press Reveal Board to show only that player's fogged view.",
            )}

            <PrivacyExample language={language} />
          </RuleCard>

          <RuleCard
            number="6"
            title={t(language, "6. Check, checkmate and legality")}
          >
            {t(
              language,
              "The full hidden position is still used for legal move checking, check, checkmate, castling, promotion and draw rules. Fog changes information, not chess legality.",
            )}
          </RuleCard>

          <RuleCard number="7" title={t(language, "7. Undo and history")}>
            {t(
              language,
              "Undo restores the previous full position and hides the board again. History previews remain fogged instead of exposing the full board.",
            )}
          </RuleCard>
        </div>
      </div>
    </main>
  );
}

function RuleCard({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: React.ReactNode;
}) {
  useUiLanguage();
  return (
    <section className="rounded-3xl border border-white/10 bg-zinc-900/70 p-5 shadow-lg shadow-black/10">
      <div className="flex items-start gap-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-sky-400/15 bg-sky-400/10 text-sm font-black text-sky-200">
          {gameUi(number)}
        </span>

        <div className="min-w-0">
          <h2 className="font-black text-white">{ui(title)}</h2>

          <div className="mt-2 text-sm leading-7 text-zinc-400">{gameUi(children)}</div>
        </div>
      </div>
    </section>
  );
}

function VisualRuleCard({
  title,
  text,
  children,
}: {
  title: string;
  text: string;
  children: React.ReactNode;
}) {
  useUiLanguage();
  return (
    <section className="grid gap-5 rounded-3xl border border-sky-400/10 bg-zinc-900/60 p-5 md:grid-cols-[minmax(0,1fr)_360px] md:items-center">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-300">{ui("Visual example")}</p>

        <h3 className="mt-2 text-lg font-black text-white">{ui(title)}</h3>

        <p className="mt-2 text-sm leading-7 text-zinc-400">{ui(text)}</p>
      </div>

      <div className="flex justify-center">{gameUi(children)}</div>
    </section>
  );
}

function MiniBoard({
  board,
  fogByDefault,
}: {
  board: ExampleBoard;
  fogByDefault: boolean;
}) {
  useUiLanguage();
  const files = "abcdefgh";

  const squares: React.ReactNode[] = [];

  for (let rank = 8; rank >= 1; rank -= 1) {
    for (let fileIndex = 0; fileIndex < 8; fileIndex += 1) {
      const file = files[fileIndex];

      const square = `${file}${rank}`;

      const info = board[square];

      const dark = (fileIndex + rank) % 2 === 1;

      const fog = info?.fog ?? (fogByDefault && !info?.visible);

      const visible = !fog;

      squares.push(
        <div
          key={square}
          title={gameUi(info?.label ?? square)}
          className={`
            relative
            flex
            aspect-square
            items-center
            justify-center
            overflow-hidden
            ${dark ? "bg-zinc-700" : "bg-zinc-300"}
            ${info?.highlighted ? "ring-2 ring-inset ring-sky-300" : ""}
          `}
        >
          {gameUi(visible && (
            <span
              className={`
                relative
                z-10
                text-[clamp(18px,4.3vw,34px)]
                leading-none
                ${
                  info?.enemy
                    ? "drop-shadow-[0_0_6px_rgba(251,113,133,0.7)]"
                    : ""
                }
              `}
            >
              {gameUi(info?.piece ?? "")}
            </span>
          ))}

          {gameUi(fog && (
            <>
              <span className="absolute inset-0 z-20 bg-zinc-950/90" />

              <span className="absolute left-1/2 top-1/2 z-30 -translate-x-1/2 -translate-y-1/2 text-xs text-zinc-600">
                🌫
              </span>
            </>
          ))}

          {gameUi(fileIndex === 0 && (
            <span
              className={`
                pointer-events-none
                absolute
                left-1
                top-0.5
                z-40
                text-[7px]
                font-black
                ${
                  fog
                    ? "text-zinc-700"
                    : dark
                      ? "text-zinc-300/60"
                      : "text-zinc-700/60"
                }
              `}
            >
              {gameUi(rank)}
            </span>
          ))}

          {gameUi(rank === 1 && (
            <span
              className={`
                pointer-events-none
                absolute
                bottom-0.5
                right-1
                z-40
                text-[7px]
                font-black
                ${
                  fog
                    ? "text-zinc-700"
                    : dark
                      ? "text-zinc-300/60"
                      : "text-zinc-700/60"
                }
              `}
            >
              {gameUi(file)}
            </span>
          ))}
        </div>,
      );
    }
  }

  return (
    <div className="w-full max-w-[340px]">
      <div className="grid grid-cols-8 overflow-hidden rounded-xl border border-white/10 shadow-2xl shadow-black/30">
        {gameUi(squares)}
      </div>
    </div>
  );
}

function PrivacyExample({ language }: { language: Language }) {
  useUiLanguage();
  return (
    <div className="mt-4 max-w-sm rounded-2xl border border-sky-400/15 bg-zinc-950/70 p-5 text-center">
      <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-sky-400/10 text-2xl">
        🌫
      </div>

      <p className="mt-3 text-[10px] font-black uppercase tracking-[0.18em] text-sky-300">
        {t(language, "Pass the device")}
      </p>

      <p className="mt-2 text-sm font-black text-white">
        {t(language, "Do not look at the board")}
      </p>

      <button
        type="button"
        className="mt-4 w-full rounded-xl bg-sky-300 px-4 py-2.5 text-xs font-black text-zinc-950"
      >
        {t(language, "Reveal Board")}
      </button>
    </div>
  );
}

function LegendItem({
  sample,
  label,
  className,
}: {
  sample: string;
  label: string;
  className: string;
}) {
  useUiLanguage();
  return (
    <div className="flex items-center gap-2">
      <span
        className={`
          flex
          h-7
          w-7
          items-center
          justify-center
          rounded-lg
          border
          text-sm
          font-black
          ${className}
        `}
      >
        {gameUi(sample)}
      </span>

      <span className="text-[10px] font-bold text-zinc-400">{ui(label)}</span>
    </div>
  );
}

