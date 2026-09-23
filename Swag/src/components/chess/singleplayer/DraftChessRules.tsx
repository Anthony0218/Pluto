import { useState } from "react";
import { Link } from "react-router-dom";

type Language = "en" | "de" | "bar" | "ko" | "ru";

type MiniSquare = {
  piece?: string;
  allowed?: boolean;
  kingOnly?: boolean;
  blocked?: boolean;
  highlight?: boolean;
};

type MiniBoardState = Record<string, MiniSquare>;

const languageOptions: Array<{
  value: Language;
  label: string;
}> = [
  { value: "en", label: "English" },
  { value: "de", label: "Deutsch" },
  { value: "bar", label: "Boarisch" },
  { value: "ko", label: "한국어" },
  { value: "ru", label: "Русский" },
];

const translations: Record<Exclude<Language, "en">, Record<string, string>> = {
  de: {
    "Chess Variant VI": "Schachvariante VI",
    "Draft Chess": "Draft-Schach",
    "Rules & Examples": "Regeln & Beispiele",
    "Back to Draft Chess": "Zurück zu Draft-Schach",
    Language: "Sprache",
    "Core idea": "Grundidee",
    "Build your own army before the game starts. Each player has a maximum budget of 39 points.":
      "Stelle vor dem Spiel deine eigene Armee zusammen. Jeder Spieler hat ein maximales Budget von 39 Punkten.",
    "The setup is private. White builds first, then Black, and both armies are revealed only after both players confirm.":
      "Der Aufbau ist geheim. Weiß baut zuerst, danach Schwarz. Beide Armeen werden erst aufgedeckt, wenn beide Spieler bestätigt haben.",
    "Piece costs": "Figurenkosten",
    Pawn: "Bauer",
    Knight: "Springer",
    Bishop: "Läufer",
    Rook: "Turm",
    Queen: "Dame",
    King: "König",
    "1. Setup zones": "1. Aufbauzonen",
    "White may place pieces only on ranks 1–2. Black may place pieces only on ranks 7–8.":
      "Weiß darf Figuren nur auf den Reihen 1–2 platzieren. Schwarz nur auf den Reihen 7–8.",
    "2. King restriction": "2. Königseinschränkung",
    "Each side must have exactly one King. White's King must be on rank 1; Black's King must be on rank 8.":
      "Jede Seite muss genau einen König haben. Der weiße König muss auf Reihe 1 stehen, der schwarze auf Reihe 8.",
    "3. Budget": "3. Budget",
    "You may spend up to 39 points. You do not need to spend all 39.":
      "Du darfst bis zu 39 Punkte ausgeben. Du musst nicht alle 39 Punkte verwenden.",
    "4. Piece quantities": "4. Figurenanzahl",
    "There is no fixed maximum number of Pawns, Knights, Bishops, Rooks or Queens. Your budget and the 16 available setup squares are the limits.":
      "Es gibt keine feste Höchstzahl für Bauern, Springer, Läufer, Türme oder Damen. Budget und 16 verfügbare Aufbaufelder sind die Grenzen.",
    "5. Private Hotseat setup": "5. Geheimer Hotseat-Aufbau",
    "White builds and confirms first. The board is then covered before the device is passed to Black. Black builds without seeing White's army.":
      "Weiß baut und bestätigt zuerst. Danach wird das Brett verdeckt und das Gerät an Schwarz weitergegeben. Schwarz baut, ohne die weiße Armee zu sehen.",
    "6. Reveal and start": "6. Aufdecken und Start",
    "After Black confirms, both armies are revealed and normal chess begins with White to move.":
      "Nach der Bestätigung von Schwarz werden beide Armeen aufgedeckt und normales Schach beginnt mit Weiß am Zug.",
    "7. Castling": "7. Rochade",
    "Castling is available only when the King is on e1/e8 and the corresponding Rook is on a1/h1 or a8/h8 at game start.":
      "Rochade ist nur möglich, wenn der König auf e1/e8 und der entsprechende Turm auf a1/h1 bzw. a8/h8 steht.",
    "8. Normal chess after setup": "8. Normales Schach nach dem Aufbau",
    "Once the game starts, normal chess rules apply: legal moves, check, checkmate, promotion, stalemate and draw rules.":
      "Nach Spielbeginn gelten normale Schachregeln: legale Züge, Schach, Schachmatt, Umwandlung, Patt und Remisregeln.",
    "White setup zone": "Weiße Aufbauzone",
    "Black setup zone": "Schwarze Aufbauzone",
    "King back rank": "König-Grundreihe",
    "Example army": "Beispielarmee",
    "Private setup flow": "Geheimer Aufbauablauf",
    "White builds": "Weiß baut",
    "Pass device": "Gerät weitergeben",
    "Black builds": "Schwarz baut",
    "Reveal armies": "Armeen aufdecken",
    "Budget example": "Budgetbeispiel",
    "This sample army uses 39 points exactly.":
      "Diese Beispielarmee verwendet genau 39 Punkte.",
    "Board legend": "Brett-Legende",
    "Allowed setup square": "Erlaubtes Aufbaufeld",
    "King must be here": "König muss hier stehen",
    "Not available in setup": "Nicht für Aufbau verfügbar",
  },

  bar: {
    "Chess Variant VI": "Schachvariantn VI",
    "Draft Chess": "Draft-Schach",
    "Rules & Examples": "Regeln & Beispiele",
    "Back to Draft Chess": "Zruck zum Draft-Schach",
    Language: "Sproch",
    "Core idea": "Grundidee",
    "Build your own army before the game starts. Each player has a maximum budget of 39 points.":
      "Bau da vor'm Spiel dei eigene Armee. Jeder Spieler hat maximal 39 Punkte.",
    "The setup is private. White builds first, then Black, and both armies are revealed only after both players confirm.":
      "Da Aufbau is geheim. Weiß baut z'erst, dann Schwarz. Aufdeckt wird erst, wenn beide bestätigt ham.",
    "Piece costs": "Figurenkosten",
    Pawn: "Baua",
    Knight: "Springa",
    Bishop: "Läufa",
    Rook: "Turm",
    Queen: "Dame",
    King: "Kini",
    "1. Setup zones": "1. Aufbauzonen",
    "White may place pieces only on ranks 1–2. Black may place pieces only on ranks 7–8.":
      "Weiß darf nur auf Reihe 1–2 aufstelln, Schwarz nur auf 7–8.",
    "2. King restriction": "2. Kini-Regel",
    "Each side must have exactly one King. White's King must be on rank 1; Black's King must be on rank 8.":
      "Jede Seit braucht genau oan Kini. Weiß auf Reihe 1, Schwarz auf Reihe 8.",
    "3. Budget": "3. Budget",
    "You may spend up to 39 points. You do not need to spend all 39.":
      "Du darfst bis zu 39 Punkte ausgebn. Ned alle müssn verwendet werdn.",
    "4. Piece quantities": "4. Figurenanzahl",
    "There is no fixed maximum number of Pawns, Knights, Bishops, Rooks or Queens. Your budget and the 16 available setup squares are the limits.":
      "Es gibt koa feste Maximalzahl. Budget und 16 Aufbau-Felder san de Grenze.",
    "5. Private Hotseat setup": "5. Geheimer Hotseat-Aufbau",
    "White builds and confirms first. The board is then covered before the device is passed to Black. Black builds without seeing White's army.":
      "Weiß baut und bestätigt z'erst. Dann wird s Brett verdeckt und Schwarz baut ohne de weiße Armee z'sehn.",
    "6. Reveal and start": "6. Aufdeckn und Start",
    "After Black confirms, both armies are revealed and normal chess begins with White to move.":
      "Nach Schwarz werdn beide Armeen aufdeckt und Weiß fangt an.",
    "7. Castling": "7. Rochade",
    "Castling is available only when the King is on e1/e8 and the corresponding Rook is on a1/h1 or a8/h8 at game start.":
      "Rochade geht nur mit Kini auf e1/e8 und passendem Turm auf a/h.",
    "8. Normal chess after setup": "8. Normales Schach danach",
    "Once the game starts, normal chess rules apply: legal moves, check, checkmate, promotion, stalemate and draw rules.":
      "Nach'm Start gelten normale Schachregeln.",
    "White setup zone": "Weiße Aufbauzone",
    "Black setup zone": "Schwarze Aufbauzone",
    "King back rank": "Kini-Grundreihe",
    "Example army": "Beispielarmee",
    "Private setup flow": "Geheimer Aufbauablauf",
    "White builds": "Weiß baut",
    "Pass device": "Gerät weitergebn",
    "Black builds": "Schwarz baut",
    "Reveal armies": "Armeen aufdeckn",
    "Budget example": "Budgetbeispiel",
    "This sample army uses 39 points exactly.":
      "De Beispielarmee braucht genau 39 Punkte.",
    "Board legend": "Brett-Legende",
    "Allowed setup square": "Erlaubtes Aufbaufeld",
    "King must be here": "Kini muaß do stehn",
    "Not available in setup": "Ned verfügbar",
  },

  ko: {
    "Chess Variant VI": "체스 변형 VI",
    "Draft Chess": "드래프트 체스",
    "Rules & Examples": "규칙 및 예시",
    "Back to Draft Chess": "드래프트 체스로 돌아가기",
    Language: "언어",
    "Core idea": "핵심 규칙",
    "Build your own army before the game starts. Each player has a maximum budget of 39 points.":
      "게임 시작 전에 직접 군대를 구성합니다. 각 플레이어는 최대 39포인트를 사용할 수 있습니다.",
    "The setup is private. White builds first, then Black, and both armies are revealed only after both players confirm.":
      "배치는 비공개입니다. 백이 먼저 구성한 뒤 흑이 구성하며, 양쪽 모두 확정한 뒤에만 두 군대가 공개됩니다.",
    "Piece costs": "기물 비용",
    Pawn: "폰",
    Knight: "나이트",
    Bishop: "비숍",
    Rook: "룩",
    Queen: "퀸",
    King: "킹",
    "1. Setup zones": "1. 배치 구역",
    "White may place pieces only on ranks 1–2. Black may place pieces only on ranks 7–8.":
      "백은 1–2랭크에만, 흑은 7–8랭크에만 기물을 배치할 수 있습니다.",
    "2. King restriction": "2. 킹 제한",
    "Each side must have exactly one King. White's King must be on rank 1; Black's King must be on rank 8.":
      "각 진영은 정확히 하나의 킹을 가져야 합니다. 백 킹은 1랭크, 흑 킹은 8랭크에 있어야 합니다.",
    "3. Budget": "3. 예산",
    "You may spend up to 39 points. You do not need to spend all 39.":
      "최대 39포인트까지 사용할 수 있으며 반드시 전부 사용할 필요는 없습니다.",
    "4. Piece quantities": "4. 기물 수량",
    "There is no fixed maximum number of Pawns, Knights, Bishops, Rooks or Queens. Your budget and the 16 available setup squares are the limits.":
      "폰, 나이트, 비숍, 룩, 퀸의 개수에는 별도 제한이 없습니다. 39포인트 예산과 16개의 배치 칸이 제한입니다.",
    "5. Private Hotseat setup": "5. 비공개 핫시트 배치",
    "White builds and confirms first. The board is then covered before the device is passed to Black. Black builds without seeing White's army.":
      "백이 먼저 군대를 구성하고 확정합니다. 이후 보드가 가려지고 기기를 흑에게 넘기며, 흑은 백의 배치를 보지 못한 상태에서 구성합니다.",
    "6. Reveal and start": "6. 공개 및 시작",
    "After Black confirms, both armies are revealed and normal chess begins with White to move.":
      "흑까지 확정하면 양쪽 군대가 공개되고 백 차례로 일반 체스가 시작됩니다.",
    "7. Castling": "7. 캐슬링",
    "Castling is available only when the King is on e1/e8 and the corresponding Rook is on a1/h1 or a8/h8 at game start.":
      "게임 시작 시 킹이 e1/e8에 있고 해당 룩이 a1/h1 또는 a8/h8에 있을 때만 캐슬링 권한이 주어집니다.",
    "8. Normal chess after setup": "8. 배치 후 일반 체스",
    "Once the game starts, normal chess rules apply: legal moves, check, checkmate, promotion, stalemate and draw rules.":
      "게임이 시작된 뒤에는 합법 수, 체크, 체크메이트, 프로모션, 스테일메이트, 무승부 등 일반 체스 규칙이 적용됩니다.",
    "White setup zone": "백 배치 구역",
    "Black setup zone": "흑 배치 구역",
    "King back rank": "킹 후방 랭크",
    "Example army": "예시 군대",
    "Private setup flow": "비공개 배치 흐름",
    "White builds": "백 구성",
    "Pass device": "기기 전달",
    "Black builds": "흑 구성",
    "Reveal armies": "군대 공개",
    "Budget example": "예산 예시",
    "This sample army uses 39 points exactly.":
      "이 예시 군대는 정확히 39포인트를 사용합니다.",
    "Board legend": "보드 범례",
    "Allowed setup square": "배치 가능 칸",
    "King must be here": "킹 배치 가능 후방 랭크",
    "Not available in setup": "배치 불가",
  },

  ru: {
    "Chess Variant VI": "Шахматный вариант VI",
    "Draft Chess": "Драфт-шахматы",
    "Rules & Examples": "Правила и примеры",
    "Back to Draft Chess": "Назад к Draft Chess",
    Language: "Язык",
    "Core idea": "Основная идея",
    "Build your own army before the game starts. Each player has a maximum budget of 39 points.":
      "Перед началом игры соберите собственную армию. У каждого игрока максимум 39 очков.",
    "The setup is private. White builds first, then Black, and both armies are revealed only after both players confirm.":
      "Расстановка скрытая. Сначала строят белые, затем чёрные. Армии открываются только после подтверждения обоих игроков.",
    "Piece costs": "Стоимость фигур",
    Pawn: "Пешка",
    Knight: "Конь",
    Bishop: "Слон",
    Rook: "Ладья",
    Queen: "Ферзь",
    King: "Король",
    "1. Setup zones": "1. Зоны расстановки",
    "White may place pieces only on ranks 1–2. Black may place pieces only on ranks 7–8.":
      "Белые размещают фигуры только на рядах 1–2, чёрные — только на 7–8.",
    "2. King restriction": "2. Ограничение короля",
    "Each side must have exactly one King. White's King must be on rank 1; Black's King must be on rank 8.":
      "У каждой стороны должен быть ровно один король. Белый король — на ряду 1, чёрный — на ряду 8.",
    "3. Budget": "3. Бюджет",
    "You may spend up to 39 points. You do not need to spend all 39.":
      "Можно потратить до 39 очков. Необязательно использовать все 39.",
    "4. Piece quantities": "4. Количество фигур",
    "There is no fixed maximum number of Pawns, Knights, Bishops, Rooks or Queens. Your budget and the 16 available setup squares are the limits.":
      "Фиксированного лимита пешек, коней, слонов, ладей и ферзей нет. Ограничения — бюджет и 16 доступных полей.",
    "5. Private Hotseat setup": "5. Скрытая расстановка Hotseat",
    "White builds and confirms first. The board is then covered before the device is passed to Black. Black builds without seeing White's army.":
      "Белые строят и подтверждают первыми. Затем доска закрывается и устройство передаётся чёрным. Чёрные не видят армию белых.",
    "6. Reveal and start": "6. Открытие и старт",
    "After Black confirms, both armies are revealed and normal chess begins with White to move.":
      "После подтверждения чёрных обе армии открываются, и обычная партия начинается ходом белых.",
    "7. Castling": "7. Рокировка",
    "Castling is available only when the King is on e1/e8 and the corresponding Rook is on a1/h1 or a8/h8 at game start.":
      "Рокировка доступна только если король стоит на e1/e8, а соответствующая ладья на a1/h1 или a8/h8.",
    "8. Normal chess after setup": "8. Обычные шахматы после расстановки",
    "Once the game starts, normal chess rules apply: legal moves, check, checkmate, promotion, stalemate and draw rules.":
      "После старта действуют обычные шахматные правила: легальные ходы, шах, мат, превращение, пат и ничьи.",
    "White setup zone": "Зона белых",
    "Black setup zone": "Зона чёрных",
    "King back rank": "Задний ряд короля",
    "Example army": "Пример армии",
    "Private setup flow": "Скрытый порядок расстановки",
    "White builds": "Белые строят",
    "Pass device": "Передать устройство",
    "Black builds": "Чёрные строят",
    "Reveal armies": "Открыть армии",
    "Budget example": "Пример бюджета",
    "This sample army uses 39 points exactly.":
      "Эта примерная армия использует ровно 39 очков.",
    "Board legend": "Легенда доски",
    "Allowed setup square": "Разрешённое поле",
    "King must be here": "Король должен быть здесь",
    "Not available in setup": "Недоступно для расстановки",
  },
};

function getInitialLanguage(): Language {
  if (typeof window === "undefined") {
    return "en";
  }

  const stored = window.localStorage.getItem("chess-language");

  return languageOptions.some((option) => option.value === stored)
    ? (stored as Language)
    : "en";
}

function t(language: Language, key: string): string {
  if (language === "en") {
    return key;
  }

  if (language === "bar") {
    return translations.bar[key] ?? translations.de[key] ?? key;
  }

  return translations[language][key] ?? key;
}

const whiteSetupExample: MiniBoardState = {
  a1: { allowed: true },
  b1: { allowed: true },
  c1: { allowed: true },
  d1: { allowed: true },
  e1: {
    allowed: true,
    kingOnly: true,
    piece: "♔",
    highlight: true,
  },
  f1: { allowed: true },
  g1: { allowed: true },
  h1: { allowed: true },

  a2: { allowed: true, piece: "♙" },
  b2: { allowed: true },
  c2: { allowed: true, piece: "♘" },
  d2: { allowed: true },
  e2: { allowed: true, piece: "♕" },
  f2: { allowed: true },
  g2: { allowed: true, piece: "♗" },
  h2: { allowed: true },
};

const blackSetupExample: MiniBoardState = {
  a8: { allowed: true },
  b8: { allowed: true },
  c8: { allowed: true },
  d8: { allowed: true },
  e8: {
    allowed: true,
    kingOnly: true,
    piece: "♚",
    highlight: true,
  },
  f8: { allowed: true },
  g8: { allowed: true },
  h8: { allowed: true },

  a7: { allowed: true, piece: "♟" },
  b7: { allowed: true },
  c7: { allowed: true, piece: "♞" },
  d7: { allowed: true },
  e7: { allowed: true, piece: "♛" },
  f7: { allowed: true },
  g7: { allowed: true, piece: "♝" },
  h7: { allowed: true },
};

const budgetExample: MiniBoardState = {
  a1: { allowed: true, piece: "♖" },
  b1: { allowed: true, piece: "♘" },
  c1: { allowed: true, piece: "♗" },
  d1: { allowed: true, piece: "♕" },
  e1: {
    allowed: true,
    kingOnly: true,
    piece: "♔",
  },
  f1: { allowed: true, piece: "♗" },
  g1: { allowed: true, piece: "♘" },
  h1: { allowed: true, piece: "♖" },

  a2: { allowed: true, piece: "♙" },
  b2: { allowed: true, piece: "♙" },
  c2: { allowed: true, piece: "♙" },
  d2: { allowed: true, piece: "♙" },
  e2: { allowed: true, piece: "♙" },
  f2: { allowed: true, piece: "♙" },
  g2: { allowed: true, piece: "♙" },
  h2: { allowed: true, piece: "♙" },
};

export default function DraftChessRules() {
  const [language, setLanguage] = useState<Language>(getInitialLanguage);

  function changeLanguage(nextLanguage: Language) {
    setLanguage(nextLanguage);

    if (typeof window !== "undefined") {
      window.localStorage.setItem("chess-language", nextLanguage);
    }
  }

  return (
    <main className="min-h-screen bg-transparent px-4 py-6 text-zinc-100 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6 rounded-3xl border border-emerald-400/15 bg-zinc-900/75 p-6 shadow-xl shadow-black/20">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-emerald-300">
                {t(language, "Chess Variant VI")}
              </p>

              <h1 className="mt-2 text-3xl font-black text-white">
                {t(language, "Draft Chess")}
              </h1>

              <p className="mt-2 text-sm text-zinc-500">
                {t(language, "Rules & Examples")}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <LanguageSelector language={language} onChange={changeLanguage} />

              <Link
                to="/games/chess/variants/draft/hotseat"
                className="inline-flex rounded-full border border-emerald-400/15 bg-emerald-400/[0.07] px-4 py-2 text-xs font-black text-emerald-200 transition hover:bg-emerald-400/[0.13]"
              >
                ← {t(language, "Back to Draft Chess")}
              </Link>
            </div>
          </div>
        </header>

        <section className="mb-6 rounded-3xl border border-emerald-400/10 bg-emerald-400/[0.035] p-5">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-emerald-400/20 bg-emerald-400/10 text-2xl">
              ⚔
            </div>

            <div>
              <h2 className="font-black text-emerald-100">
                {t(language, "Core idea")}
              </h2>

              <p className="mt-2 text-sm leading-7 text-zinc-400">
                {t(
                  language,
                  "Build your own army before the game starts. Each player has a maximum budget of 39 points.",
                )}
              </p>

              <p className="mt-2 text-sm font-bold text-zinc-300">
                {t(
                  language,
                  "The setup is private. White builds first, then Black, and both armies are revealed only after both players confirm.",
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
              sample=""
              label={t(language, "Allowed setup square")}
              className="border-emerald-400/20 bg-emerald-400/15 text-emerald-200"
            />

            <LegendItem
              sample="♔"
              label={t(language, "King must be here")}
              className="border-amber-400/20 bg-amber-400/10 text-amber-200"
            />

            <LegendItem
              sample="×"
              label={t(language, "Not available in setup")}
              className="border-zinc-600/30 bg-zinc-900 text-zinc-600"
            />
          </div>
        </section>

        <section className="mb-5 rounded-3xl border border-white/10 bg-zinc-900/70 p-5">
          <h2 className="font-black text-white">
            {t(language, "Piece costs")}
          </h2>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <CostCard symbol="♙" name={t(language, "Pawn")} cost={1} />

            <CostCard symbol="♘" name={t(language, "Knight")} cost={3} />

            <CostCard symbol="♗" name={t(language, "Bishop")} cost={3} />

            <CostCard symbol="♖" name={t(language, "Rook")} cost={5} />

            <CostCard symbol="♕" name={t(language, "Queen")} cost={9} />

            <CostCard symbol="♔" name={t(language, "King")} cost={0} />
          </div>
        </section>

        <div className="space-y-5">
          <RuleCard number="1" title={t(language, "1. Setup zones")}>
            {t(
              language,
              "White may place pieces only on ranks 1–2. Black may place pieces only on ranks 7–8.",
            )}
          </RuleCard>

          <section className="grid gap-5 md:grid-cols-2">
            <VisualBoardCard title={t(language, "White setup zone")}>
              <MiniBoard board={whiteSetupExample} setupSide="w" />
            </VisualBoardCard>

            <VisualBoardCard title={t(language, "Black setup zone")}>
              <MiniBoard board={blackSetupExample} setupSide="b" />
            </VisualBoardCard>
          </section>

          <RuleCard number="2" title={t(language, "2. King restriction")}>
            {t(
              language,
              "Each side must have exactly one King. White's King must be on rank 1; Black's King must be on rank 8.",
            )}
          </RuleCard>

          <RuleCard number="3" title={t(language, "3. Budget")}>
            {t(
              language,
              "You may spend up to 39 points. You do not need to spend all 39.",
            )}
          </RuleCard>

          <VisualBoardCard
            title={t(language, "Budget example")}
            text={t(language, "This sample army uses 39 points exactly.")}
          >
            <MiniBoard board={budgetExample} setupSide="w" />
          </VisualBoardCard>

          <RuleCard number="4" title={t(language, "4. Piece quantities")}>
            {t(
              language,
              "There is no fixed maximum number of Pawns, Knights, Bishops, Rooks or Queens. Your budget and the 16 available setup squares are the limits.",
            )}
          </RuleCard>

          <RuleCard number="5" title={t(language, "5. Private Hotseat setup")}>
            <p>
              {t(
                language,
                "White builds and confirms first. The board is then covered before the device is passed to Black. Black builds without seeing White's army.",
              )}
            </p>

            <PrivateSetupFlow language={language} />
          </RuleCard>

          <RuleCard number="6" title={t(language, "6. Reveal and start")}>
            {t(
              language,
              "After Black confirms, both armies are revealed and normal chess begins with White to move.",
            )}
          </RuleCard>

          <RuleCard number="7" title={t(language, "7. Castling")}>
            {t(
              language,
              "Castling is available only when the King is on e1/e8 and the corresponding Rook is on a1/h1 or a8/h8 at game start.",
            )}
          </RuleCard>

          <RuleCard
            number="8"
            title={t(language, "8. Normal chess after setup")}
          >
            {t(
              language,
              "Once the game starts, normal chess rules apply: legal moves, check, checkmate, promotion, stalemate and draw rules.",
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
  return (
    <section className="rounded-3xl border border-white/10 bg-zinc-900/70 p-5 shadow-lg shadow-black/10">
      <div className="flex items-start gap-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-400/15 bg-emerald-400/10 text-sm font-black text-emerald-200">
          {number}
        </span>

        <div className="min-w-0">
          <h2 className="font-black text-white">{title}</h2>

          <div className="mt-2 text-sm leading-7 text-zinc-400">{children}</div>
        </div>
      </div>
    </section>
  );
}

function VisualBoardCard({
  title,
  text,
  children,
}: {
  title: string;
  text?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-emerald-400/10 bg-zinc-900/60 p-5">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-300">
        Visual example
      </p>

      <h3 className="mt-2 text-lg font-black text-white">{title}</h3>

      {text && <p className="mt-2 text-sm leading-7 text-zinc-400">{text}</p>}

      <div className="mt-4 flex justify-center">{children}</div>
    </section>
  );
}

function CostCard({
  symbol,
  name,
  cost,
}: {
  symbol: string;
  name: string;
  cost: number;
}) {
  return (
    <div className="rounded-xl border border-white/5 bg-black/20 px-3 py-3 text-center">
      <div className="text-3xl leading-none">{symbol}</div>

      <p className="mt-2 text-xs font-black text-zinc-200">{name}</p>

      <p className="mt-1 text-lg font-black text-emerald-300">{cost}</p>
    </div>
  );
}

function MiniBoard({
  board,
  setupSide,
}: {
  board: MiniBoardState;
  setupSide: "w" | "b";
}) {
  const files = "abcdefgh";
  const squares: React.ReactNode[] = [];

  for (let rank = 8; rank >= 1; rank -= 1) {
    for (let fileIndex = 0; fileIndex < 8; fileIndex += 1) {
      const file = files[fileIndex];

      const square = `${file}${rank}`;

      const info = board[square];

      const isAllowed =
        info?.allowed ??
        (setupSide === "w"
          ? rank === 1 || rank === 2
          : rank === 7 || rank === 8);

      const isBackRank = setupSide === "w" ? rank === 1 : rank === 8;

      const dark = (fileIndex + rank) % 2 === 1;

      squares.push(
        <div
          key={square}
          className={`
            relative
            flex
            aspect-square
            items-center
            justify-center
            overflow-hidden
            ${dark ? "bg-zinc-700" : "bg-zinc-300"}
            ${
              isAllowed
                ? "shadow-[inset_0_0_0_999px_rgba(16,185,129,0.12)]"
                : ""
            }
            ${info?.highlight ? "ring-2 ring-inset ring-amber-300" : ""}
          `}
        >
          {isBackRank && isAllowed && (
            <span className="absolute right-0.5 top-0.5 z-10 text-[7px] font-black text-amber-200/80">
              ♔
            </span>
          )}

          {info?.piece && (
            <span className="relative z-20 text-[clamp(18px,4.3vw,34px)] leading-none">
              {info.piece}
            </span>
          )}

          {!isAllowed && (
            <span className="absolute inset-0 z-10 bg-zinc-950/35" />
          )}

          {fileIndex === 0 && (
            <span
              className={`
                pointer-events-none
                absolute
                left-1
                top-0.5
                z-30
                text-[7px]
                font-black
                ${dark ? "text-zinc-300/60" : "text-zinc-700/60"}
              `}
            >
              {rank}
            </span>
          )}

          {rank === 1 && (
            <span
              className={`
                pointer-events-none
                absolute
                bottom-0.5
                right-1
                z-30
                text-[7px]
                font-black
                ${dark ? "text-zinc-300/60" : "text-zinc-700/60"}
              `}
            >
              {file}
            </span>
          )}
        </div>,
      );
    }
  }

  return (
    <div className="w-full max-w-[340px]">
      <div className="grid grid-cols-8 overflow-hidden rounded-xl border border-white/10 shadow-2xl shadow-black/30">
        {squares}
      </div>
    </div>
  );
}

function PrivateSetupFlow({ language }: { language: Language }) {
  const steps = [
    ["♔", t(language, "White builds")],
    ["🛡", t(language, "Pass device")],
    ["♚", t(language, "Black builds")],
    ["⚔", t(language, "Reveal armies")],
  ];

  return (
    <div className="mt-4 grid gap-2 sm:grid-cols-4">
      {steps.map(([icon, label], index) => (
        <div
          key={label}
          className="relative rounded-xl border border-white/5 bg-black/20 px-3 py-3 text-center"
        >
          <div className="text-2xl">{icon}</div>

          <p className="mt-2 text-[10px] font-black text-zinc-300">{label}</p>

          {index < steps.length - 1 && (
            <span className="absolute -right-2 top-1/2 hidden -translate-y-1/2 text-zinc-700 sm:block">
              →
            </span>
          )}
        </div>
      ))}
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
        {sample}
      </span>

      <span className="text-[10px] font-bold text-zinc-400">{label}</span>
    </div>
  );
}

function LanguageSelector({
  language,
  onChange,
}: {
  language: Language;
  onChange: (language: Language) => void;
}) {
  return (
    <label className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-zinc-400">
      <span>🌐</span>

      <span className="hidden sm:inline">{t(language, "Language")}</span>

      <select
        value={language}
        onChange={(event) => onChange(event.target.value as Language)}
        className="bg-transparent text-xs font-bold text-zinc-200 outline-none [color-scheme:dark]"
        aria-label={t(language, "Language")}
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
