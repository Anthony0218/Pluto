import ChessPageHeader from "@/components/chess/ChessPageHeader";
import { ui, useUiLanguage } from "@/i18n/ui";
import { useAppLanguage } from "@/i18n/languageStore";

type Language = "en" | "de" | "bar" | "ko" | "ru" | "es" | "pt";

const CHESS_LANGUAGE_STORAGE_KEY = "chess-language";

const translations: Record<"de" | "bar" | "ko" | "ru", Record<string, string>> & Partial<Record<"es" | "pt", Record<string, string>>> = {
  de: {
    "Capitalism Chess Rulebook": "Regelbuch für Kapitalismus-Schach",
    "Economy, contracts, shopping and survival rules":
      "Wirtschaft, Aufträge, Einkaufen und Überlebensregeln",
    "Back to Capitalism Chess": "Zurück zu Kapitalismus-Schach",
    "Core Goal": "Grundziel",
    "Capitalism Chess keeps normal chess victory conditions. Checkmate still wins the game.":
      "Kapitalismus-Schach behält die normalen Siegbedingungen. Schachmatt gewinnt weiterhin die Partie.",
    "1. Money": "1. Geld",
    "You earn coins while playing normal chess.":
      "Du verdienst beim normalen Schach Münzen.",
    Action: "Aktion",
    Reward: "Belohnung",
    "Capture Pawn": "Bauer schlagen",
    "Capture Knight / Bishop": "Springer / Läufer schlagen",
    "Capture Rook": "Turm schlagen",
    "Capture Queen": "Dame schlagen",
    "Give check": "Schach geben",
    Castle: "Rochieren",
    "Promote a Pawn": "Bauern umwandeln",
    "2. Bounties": "2. Kopfgelder",
    "Each player hunts one opposing non-King piece. The marked $ square follows that piece when it moves.":
      "Jeder Spieler jagt eine gegnerische Nicht-Königsfigur. Das markierte $-Feld folgt der Figur beim Ziehen.",
    "Bounty rewards are random from 3 to 10 coins. A Pawn can therefore carry a jackpot bounty.":
      "Kopfgelder sind zufällig zwischen 3 und 10 Münzen. Auch ein Bauer kann also ein Jackpot-Kopfgeld tragen.",
    "The bounty bonus is added on top of the normal capture reward.":
      "Das Kopfgeld kommt zusätzlich zur normalen Schlagbelohnung.",
    "3. Missions": "3. Missionen",
    "Each player has one active mission. Every newly assigned mission receives a random reward from 3 to 10 coins.":
      "Jeder Spieler hat eine aktive Mission. Jede neue Mission erhält eine zufällige Belohnung von 3 bis 10 Münzen.",
    "Mission examples": "Beispiele für Missionen",
    "Mission rewards are extra; normal action income still applies.":
      "Missionsbelohnungen sind zusätzlich; normale Aktionsbelohnungen gelten weiterhin.",
    "4. Piece Market": "4. Figurenmarkt",
    "Pieces may only spawn on your original rook home squares.":
      "Figuren dürfen nur auf den ursprünglichen Turmfeldern erscheinen.",
    "White spawn points": "Weiße Spawnpunkte",
    "Black spawn points": "Schwarze Spawnpunkte",
    "Green + means the rook-home square is empty and usable. A dim + means it is currently occupied.":
      "Ein grünes + bedeutet, dass das Turmfeld frei und nutzbar ist. Ein blasses + bedeutet, dass es belegt ist.",
    "You cannot buy a piece while your King is in check.":
      "Im Schach kannst du keine Figur kaufen.",
    Piece: "Figur",
    Cost: "Kosten",
    Pawn: "Bauer",
    Knight: "Springer",
    Bishop: "Läufer",
    Rook: "Turm",
    Queen: "Dame",
    "5. Royal Powers": "5. Königliche Mächte",
    "Royal Investment": "Königliche Investition",
    "Double the normal income of your next capture.":
      "Verdoppelt den normalen Ertrag des nächsten Schlages.",
    "Mission Decree": "Missionsdekret",
    "Reroll your active mission.": "Aktive Mission neu würfeln.",
    "Bounty Decree": "Kopfgelddekret",
    "Reroll your active bounty target and its reward.":
      "Kopfgeldziel und Belohnung neu würfeln.",
    "Each Royal Power can be used only once by each player.":
      "Jede königliche Macht kann pro Spieler nur einmal benutzt werden.",
    "6. King Journey — survival mission": "6. Königsreise — Überlebensmission",
    "This special rule activates only when one side has only its King, or only King + Pawns, with no Queen, Rook, Bishop or Knight left.":
      "Diese Sonderregel wird nur aktiv, wenn eine Seite nur noch den König oder König + Bauern besitzt und keine Dame, keinen Turm, Läufer oder Springer mehr hat.",
    "That player can no longer receive ordinary missions. Their only mission is King Journey.":
      "Dieser Spieler kann keine normalen Missionen mehr erhalten. Seine einzige Mission ist die Königsreise.",
    "Move the King onto the marked target square to complete the mission.":
      "Ziehe den König auf das markierte Zielfeld, um die Mission zu erfüllen.",
    "White King Journey target": "Ziel der weißen Königsreise",
    "Black King Journey target": "Ziel der schwarzen Königsreise",
    "If both targets are the same square, both King symbols appear together.":
      "Wenn beide Ziele dasselbe Feld sind, werden beide Königssymbole zusammen angezeigt.",
    "The target is never the King's current square and starts on an empty square.":
      "Das Ziel ist nie das aktuelle Königsfeld und beginnt auf einem leeren Feld.",
    "If the player buys a Knight, Bishop, Rook or Queen, normal missions return. Buying another Pawn does not end King Journey mode.":
      "Kauft der Spieler Springer, Läufer, Turm oder Dame, kehren normale Missionen zurück. Ein weiterer Bauer beendet den Königsreise-Modus nicht.",
    "7. Undo and history": "7. Rückgängig und Verlauf",
    "Undo restores the board and the whole economy: coins, contracts, powers and targets.":
      "Rückgängig stellt Brett und gesamte Wirtschaft wieder her: Münzen, Aufträge, Mächte und Ziele.",
  },
  bar: {},
  ko: {
    "Capitalism Chess Rulebook": "자본주의 체스 규칙",
    "Economy, contracts, shopping and survival rules":
      "경제, 계약, 구매, 생존 규칙",
    "Back to Capitalism Chess": "자본주의 체스로 돌아가기",
    "Core Goal": "기본 목표",
    "Capitalism Chess keeps normal chess victory conditions. Checkmate still wins the game.":
      "자본주의 체스도 기본 승리 조건은 일반 체스와 같습니다. 체크메이트가 승리입니다.",
    "1. Money": "1. 돈",
    "You earn coins while playing normal chess.":
      "일반 체스를 두면서 코인을 획득합니다.",
    Action: "행동",
    Reward: "보상",
    "Capture Pawn": "폰 잡기",
    "Capture Knight / Bishop": "나이트 / 비숍 잡기",
    "Capture Rook": "룩 잡기",
    "Capture Queen": "퀸 잡기",
    "Give check": "체크",
    Castle: "캐슬링",
    "Promote a Pawn": "폰 프로모션",
    "2. Bounties": "2. 현상금",
    "Each player hunts one opposing non-King piece. The marked $ square follows that piece when it moves.":
      "각 플레이어는 상대의 킹이 아닌 기물 하나를 현상금 목표로 갖습니다. $ 표시는 그 기물이 움직이면 따라갑니다.",
    "Bounty rewards are random from 3 to 10 coins. A Pawn can therefore carry a jackpot bounty.":
      "현상금 보상은 3~10 코인으로 무작위입니다. 따라서 폰에도 대박 현상금이 걸릴 수 있습니다.",
    "The bounty bonus is added on top of the normal capture reward.":
      "현상금 보너스는 일반 포획 보상에 추가됩니다.",
    "3. Missions": "3. 미션",
    "Each player has one active mission. Every newly assigned mission receives a random reward from 3 to 10 coins.":
      "각 플레이어는 하나의 활성 미션을 가지며, 새 미션의 보상은 3~10 코인 사이에서 무작위로 정해집니다.",
    "Mission examples": "미션 예시",
    "Mission rewards are extra; normal action income still applies.":
      "미션 보상은 추가 보상이며 기본 행동 보상도 그대로 받습니다.",
    "4. Piece Market": "4. 기물 시장",
    "Pieces may only spawn on your original rook home squares.":
      "구입한 기물은 자신의 원래 룩 시작 칸에만 배치할 수 있습니다.",
    "White spawn points": "백 배치 칸",
    "Black spawn points": "흑 배치 칸",
    "Green + means the rook-home square is empty and usable. A dim + means it is currently occupied.":
      "초록 +는 비어 있어 사용할 수 있는 칸, 흐린 +는 현재 점유된 칸입니다.",
    "You cannot buy a piece while your King is in check.":
      "킹이 체크 상태일 때는 기물을 구매할 수 없습니다.",
    Piece: "기물",
    Cost: "가격",
    Pawn: "폰",
    Knight: "나이트",
    Bishop: "비숍",
    Rook: "룩",
    Queen: "퀸",
    "5. Royal Powers": "5. 왕실 능력",
    "Royal Investment": "왕실 투자",
    "Double the normal income of your next capture.":
      "다음 포획의 기본 수입을 두 배로 만듭니다.",
    "Mission Decree": "미션 칙령",
    "Reroll your active mission.": "현재 미션을 다시 뽑습니다.",
    "Bounty Decree": "현상금 칙령",
    "Reroll your active bounty target and its reward.":
      "현상금 목표와 보상을 다시 뽑습니다.",
    "Each Royal Power can be used only once by each player.":
      "각 왕실 능력은 플레이어당 한 번만 사용할 수 있습니다.",
    "6. King Journey — survival mission": "6. 킹 여정 — 생존 미션",
    "This special rule activates only when one side has only its King, or only King + Pawns, with no Queen, Rook, Bishop or Knight left.":
      "한쪽이 킹만 남았거나 킹+폰만 남고 퀸, 룩, 비숍, 나이트가 하나도 없을 때만 활성화됩니다.",
    "That player can no longer receive ordinary missions. Their only mission is King Journey.":
      "그 플레이어는 일반 미션을 받을 수 없고 오직 킹 여정 미션만 받습니다.",
    "Move the King onto the marked target square to complete the mission.":
      "킹을 표시된 목표 칸으로 이동하면 미션을 완료합니다.",
    "White King Journey target": "백 킹 여정 목표",
    "Black King Journey target": "흑 킹 여정 목표",
    "If both targets are the same square, both King symbols appear together.":
      "두 목표가 같은 칸이면 백/흑 킹 기호가 함께 표시됩니다.",
    "The target is never the King's current square and starts on an empty square.":
      "목표는 현재 킹의 칸이 아니며 처음에는 비어 있는 칸으로 정해집니다.",
    "If the player buys a Knight, Bishop, Rook or Queen, normal missions return. Buying another Pawn does not end King Journey mode.":
      "나이트, 비숍, 룩, 퀸을 구매하면 일반 미션으로 돌아갑니다. 폰을 추가 구매해도 킹 여정 상태는 유지됩니다.",
    "7. Undo and history": "7. 되돌리기와 기록",
    "Undo restores the board and the whole economy: coins, contracts, powers and targets.":
      "되돌리기는 보드뿐 아니라 코인, 계약, 왕실 능력, 목표까지 경제 상태 전체를 되돌립니다.",
  },
  ru: {},
};



const shopCosts = [
  ["Pawn", "3"],
  ["Knight", "5"],
  ["Bishop", "5"],
  ["Rook", "7"],
  ["Queen", "10"],
];

export default function CapitalismChessRules() {
  useUiLanguage();
  const { language, setLanguage } = useAppLanguage();

  const t = (key: string) => {
    if (language === "en") return key;
    if (language === "bar")
      return translations.bar[key] ?? translations.de[key] ?? ui(key);
    if (language === "ru") return translations.ru[key] ?? ui(key);
    return translations[language]?.[key] ?? ui(key);
  };

  function changeLanguage(nextLanguage: Language) {
    setLanguage(nextLanguage);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(CHESS_LANGUAGE_STORAGE_KEY, nextLanguage);
    }
  }

  return (
    <div className="min-h-screen  bg-transparent px-4 py-6 text-zinc-100 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <ChessPageHeader className="mb-6 rounded-3xl border border-amber-400/15 bg-zinc-900/75 p-6 shadow-xl shadow-black/20" description={<> {t("Economy, contracts, shopping and survival rules")} </>}>
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-amber-400">{ui("Chess Variant III")}</p>
              <h1 className="mt-2 text-3xl font-black text-white">
                {t("Capitalism Chess Rulebook")}
              </h1>
              <p className="mt-2 text-sm text-zinc-500">
                {t("Economy, contracts, shopping and survival rules")}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <a
                href="/games/chess/variants/capitalism/hotseat"
                className="rounded-full border border-amber-400/15 bg-amber-400/[0.07] px-4 py-2 text-xs font-black text-amber-200 transition hover:bg-amber-400/[0.13]"
              >
                ← {t("Back to Capitalism Chess")}
              </a>
              <select
                value={language}
                onChange={(event) =>
                  changeLanguage(event.target.value as Language)
                }
                className="rounded-full border border-white/10 bg-zinc-900 px-3 py-2 text-xs font-bold text-zinc-200 outline-none"
              >
                <option value="en">{ui("English")}</option>
                <option value="de">{ui("Deutsch")}</option>
                <option value="bar">{ui("Boarisch")}</option>
                <option value="ko">한국어</option>
                <option value="ru">Русский</option>
              </select>
            </div>
          </div>
        </ChessPageHeader>

        <RuleSection number="0" title={t("Core Goal")} accent="amber">
          <RuleParagraph>
            {t(
              "Capitalism Chess keeps normal chess victory conditions. Checkmate still wins the game.",
            )}
          </RuleParagraph>
        </RuleSection>

        <RuleSection number="1" title={t("1. Money")} accent="amber">
          <RuleParagraph>
            {t(
              "Each player starts with 2 coins. Coins are earned only from Bounties and Missions.",
            )}
          </RuleParagraph>
          <RuleCallout icon="$">
            {t(
              "Normal moves, ordinary captures, check, castling and promotion give no automatic coin income.",
            )}
          </RuleCallout>
        </RuleSection>

        <RuleSection number="2" title={t("2. Bounties")} accent="amber">
          <RuleParagraph>
            {t(
              "Each player hunts one opposing non-King piece. The marked $ square follows that piece when it moves.",
            )}
          </RuleParagraph>
          <RuleParagraph>
            {t("Every bounty reward is random from 3 to 9 coins.")}
          </RuleParagraph>
          <RuleCallout icon="$">
            {t(
              "You receive coins only if you actually capture your active bounty target. There is no separate normal capture reward.",
            )}
          </RuleCallout>
        </RuleSection>

        <RuleSection number="3" title={t("3. Missions")} accent="emerald">
          <RuleParagraph>
            {t(
              "Each player has one active mission. Every newly assigned mission receives a random reward from 3 to 9 coins.",
            )}
          </RuleParagraph>
          <p className="mt-4 text-xs font-black uppercase tracking-wider text-zinc-600">
            {t("Mission examples")}
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {[
              "Give check",
              "Make a capture",
              "Hunt a minor piece",
              "Pawn business",
              "Knight audit",
              "Expand the market",
              "Secure the treasury",
            ].map((mission) => (
              <div
                key={mission}
                className="rounded-xl border border-white/5 bg-black/20 px-3 py-3 text-xs font-bold text-zinc-300"
              >
                ★ {mission}
              </div>
            ))}
          </div>
          <RuleCallout icon="+">
            {t(
              "Mission rewards and bounty rewards are the only ways to generate new coins.",
            )}
          </RuleCallout>
        </RuleSection>

        <RuleSection number="4" title={t("4. Piece Market")} accent="sky">
          <RuleParagraph>
            {t("Pieces may only spawn on your original rook home squares.")}
          </RuleParagraph>
          <div className="my-4 grid gap-3 sm:grid-cols-2">
            <SpawnCard
              side="white"
              label={t("White spawn points")}
              squares="a1 · h1"
            />
            <SpawnCard
              side="black"
              label={t("Black spawn points")}
              squares="a8 · h8"
            />
          </div>
          <RuleParagraph>
            {t(
              "Green + means the rook-home square is empty and usable. A dim + means it is currently occupied.",
            )}
          </RuleParagraph>
          <RuleParagraph>
            {t("You cannot buy a piece while your King is in check.")}
          </RuleParagraph>
          <TwoColumnTable
            headers={[t("Piece"), t("Cost")]}
            rows={shopCosts.map(([piece, cost]) => [t(piece), `${cost} $`])}
          />
        </RuleSection>

        <RuleSection number="5" title={t("5. Royal Powers")} accent="violet">
          <RuleParagraph>
            {t(
              "Royal Investment is disabled because normal capture income no longer exists.",
            )}
          </RuleParagraph>
          <PowerRule title={t("Mission Decree")} cost="4 $">
            {t("Reroll your active mission.")}
          </PowerRule>
          <PowerRule title={t("Bounty Decree")} cost="4 $">
            {t("Reroll your active bounty target and its reward.")}
          </PowerRule>
          <RuleCallout icon="♛">
            {t(
              "Mission Decree and Bounty Decree can each be used only once by each player.",
            )}
          </RuleCallout>
        </RuleSection>

        <RuleSection
          number="6"
          title={t("6. King Journey — survival mission")}
          accent="sky"
        >
          <RuleParagraph>
            {t(
              "This special rule activates only when one side has only its King, or only King + Pawns, with no Queen, Rook, Bishop or Knight left.",
            )}
          </RuleParagraph>
          <RuleParagraph>
            {t(
              "That player can no longer receive ordinary missions. Their only mission is King Journey.",
            )}
          </RuleParagraph>
          <RuleParagraph>
            {t(
              "Move the King onto the marked target square to complete the mission.",
            )}
          </RuleParagraph>
          <div className="my-5 grid gap-3 sm:grid-cols-2">
            <JourneyMarkerCard
              side="white"
              title={t("White King Journey target")}
              symbol="♔"
            />
            <JourneyMarkerCard
              side="black"
              title={t("Black King Journey target")}
              symbol="♚"
            />
          </div>
          <RuleCallout icon="♔♚">
            {t(
              "If both targets are the same square, both King symbols appear together.",
            )}
          </RuleCallout>
          <RuleParagraph>
            {t(
              "The target is never the King's current square and starts on an empty square.",
            )}
          </RuleParagraph>
          <RuleParagraph>
            {t(
              "If the player buys a Knight, Bishop, Rook or Queen, normal missions return. Buying another Pawn does not end King Journey mode.",
            )}
          </RuleParagraph>
        </RuleSection>

        <RuleSection number="7" title={t("7. Undo and history")} accent="blue">
          <RuleParagraph>
            {t(
              "Undo restores the board and the whole economy: coins, contracts, powers and targets.",
            )}
          </RuleParagraph>
        </RuleSection>
      </div>
    </div>
  );
}

function RuleSection({
  title,
  children,
  accent,
}: {
  number: string;
  title: string;
  children: React.ReactNode;
  accent: "amber" | "emerald" | "sky" | "violet" | "blue";
}) {
  useUiLanguage();
  const accentClass = {
    amber: "border-amber-400/15",
    emerald: "border-emerald-400/15",
    sky: "border-sky-400/15",
    violet: "border-violet-400/15",
    blue: "border-blue-400/15",
  }[accent];

  return (
    <section
      className={`mb-4 rounded-3xl border bg-zinc-900/70 p-5 shadow-lg shadow-black/10 ${accentClass}`}
    >
      <h2 className="text-lg font-black text-white">{ui(title)}</h2>

      <div className="mt-4">{children}</div>
    </section>
  );
}

function RuleParagraph({ children }: { children: React.ReactNode }) {
  useUiLanguage();
  return (
    <p className="mt-3 text-sm leading-7 text-zinc-400 first:mt-0">
      {children}
    </p>
  );
}

function RuleCallout({
  icon,
  children,
}: {
  icon: string;
  children: React.ReactNode;
}) {
  useUiLanguage();
  return (
    <div className="mt-4 flex items-center gap-3 rounded-2xl border border-amber-400/10 bg-amber-400/[0.04] px-4 py-3">
      <span className="text-xl font-black text-amber-300">{icon}</span>

      <p className="text-xs font-bold leading-5 text-zinc-300">{children}</p>
    </div>
  );
}

function TwoColumnTable({
  headers,
  rows,
}: {
  headers: [string, string];
  rows: Array<[string, string]>;
}) {
  useUiLanguage();
  return (
    <div className="overflow-hidden rounded-2xl border border-white/5">
      <table className="w-full border-collapse">
        <thead className="bg-black/30">
          <tr className="text-left text-[10px] font-black uppercase tracking-wider text-zinc-600">
            <th className="px-4 py-3">{headers[0]}</th>

            <th className="px-4 py-3">{headers[1]}</th>
          </tr>
        </thead>

        <tbody>
          {rows.map(([left, right]) => (
            <tr key={`${left}-${right}`} className="border-t border-white/5">
              <td className="px-4 py-3 text-sm text-zinc-300">{left}</td>

              <td className="px-4 py-3 text-sm font-black text-amber-300">
                {right}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SpawnCard({
  side,
  label,
  squares,
}: {
  side: "white" | "black";
  label: string;
  squares: string;
}) {
  useUiLanguage();
  return (
    <div className="rounded-2xl border border-emerald-400/10 bg-emerald-400/[0.04] p-4">
      <p className="text-xs font-black text-zinc-300">
        {side === "white" ? "♔" : "♚"} {ui(label)}
      </p>

      <p className="mt-2 font-mono text-xl font-black text-emerald-300">
        + {squares}
      </p>
    </div>
  );
}

function JourneyMarkerCard({
  side,
  title,
  symbol,
}: {
  side: "white" | "black";
  title: string;
  symbol: string;
}) {
  useUiLanguage();
  return (
    <div
      className={`
        rounded-2xl
        border
        p-4

        ${
          side === "white"
            ? "border-sky-300/20 bg-sky-200/[0.06]"
            : "border-violet-300/20 bg-violet-300/[0.06]"
        }
      `}
    >
      <p className="text-xs font-black text-zinc-300">{ui(title)}</p>

      <div className="mt-3 flex items-center gap-3">
        <span
          className={`
            flex
            h-12
            w-12
            items-center
            justify-center
            rounded-full
            border
            text-3xl
            font-black

            ${
              side === "white"
                ? "border-sky-50/70 bg-sky-100 text-sky-950"
                : "border-violet-100/70 bg-violet-300 text-violet-950"
            }
          `}
        >
          {symbol}
        </span>

        <span className="text-2xl text-zinc-500">★</span>
      </div>
    </div>
  );
}

function PowerRule({
  title,
  cost,
  children,
}: {
  title: string;
  cost: string;
  children: React.ReactNode;
}) {
  useUiLanguage();
  return (
    <div className="mb-2 rounded-2xl border border-white/5 bg-black/20 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-black text-zinc-200">{ui(title)}</p>

        <span className="rounded-lg bg-amber-400/10 px-2 py-1 text-xs font-black text-amber-300">
          {cost}
        </span>
      </div>

      <p className="mt-2 text-xs leading-5 text-zinc-500">{children}</p>
    </div>
  );
}
