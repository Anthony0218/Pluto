import { gameUi, useGameLanguage } from "../../../i18n/gameUi.ts";
import { useAppLanguage } from "@/i18n/languageStore";
import "./wattenMenus.css";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import {
  BookOpen,
  ChevronRight,
  CircleEqual,
  Crown,
  Hand,
  Layers3,
  ShieldAlert,
  Sparkles,
  Swords,
  Target,
} from "lucide-react";

import { useCardTheme } from "@/context/CardThemeContext";
import { useTableTheme } from "@/context/TableThemeContext";

import {
  createDeck,
  getCriticalValue,
  isCritical,
  isHauptschlag,
  normalRankValue,
  type WattenCard,
} from "@/utils/watten";

import { getWattenCardImage } from "@/utils/WattenCardImages";
import CardThemeSelector from "@/components/Watten/WattenCardGameSelector";
import TableThemeSelector from "@/components/App/TableThemeSelector";
import { wattenTableStyle } from "@/games/watten/presentation";
import "@/components/Watten/wattenGameScreen.css";
import { HeaderTools } from "@/components/App/PublicHeader";

import {
  translateWatten,
  translateWattenPair,
  type WattenLanguage,
} from "@/games/watten/i18n/wattenLanguage";

type Tab = "overview" | "rules" | "situations" | "cards";

type Suit = "Herz" | "Schellen" | "Eichel" | "Gras";

type Rank = "7" | "8" | "9" | "10" | "Unter" | "Ober" | "König" | "Ass";

type DisplayCard = Pick<WattenCard, "suit" | "rank">;



const suitIcons: Record<Suit, string> = {
  Herz: "/images/icons/herz.webp",
  Schellen: "/images/icons/schellen.webp",
  Eichel: "/images/icons/eichel.webp",
  Gras: "/images/icons/gras.webp",
};

const suits: Suit[] = ["Herz", "Schellen", "Eichel", "Gras"];

const ranks: Rank[] = ["7", "8", "9", "10", "Unter", "Ober", "König", "Ass"];

type SituationMode = "three" | "four";

type SituationCard = DisplayCard;

type LegalHandExample = {
  playerIndex: number;
  hand: SituationCard[];
  legalIndexes: number[];
  explanationKey: string;
};

type WattenSituation = {
  id: string;
  titleKey: string;
  shortKey: string;
  farbe: Suit;
  schlag: Rank;
  firstTrick?: boolean;
  cards3: SituationCard[];
  cards4: SituationCard[];
  whyKey: string;
  edgeKey?: string;
  legalExamples3?: LegalHandExample[];
  legalExamples4?: LegalHandExample[];
};

const c = (suit: Suit, rank: Rank): SituationCard => ({ suit, rank });

const wattenSituations: WattenSituation[] = [
  {
    id: "max-over-everything",
    titleKey: "Max beats everything",
    shortKey: "Critical vs Main Schlag",
    farbe: "Gras",
    schlag: "Ober",
    cards3: [c("Gras", "Ober"), c("Herz", "König"), c("Gras", "Ass")],
    cards4: [
      c("Gras", "Ober"),
      c("Herz", "König"),
      c("Gras", "Ass"),
      c("Eichel", "Ober"),
    ],
    whyKey:
      "Max is the highest critical card. Critical cards are above Main Schlag, Schlag, trump and normal cards.",
  },
  {
    id: "critical-order",
    titleKey: "Critical cards have their own order",
    shortKey: "Max > Belli > Spitz",
    farbe: "Gras",
    schlag: "Ober",
    cards3: [c("Eichel", "7"), c("Schellen", "7"), c("Herz", "König")],
    cards4: [
      c("Eichel", "7"),
      c("Schellen", "7"),
      c("Herz", "König"),
      c("Gras", "Ober"),
    ],
    whyKey:
      "Among the three critical cards, Max is highest, then Belli, then Spitz.",
  },
  {
    id: "hauptschlag-over-schlag",
    titleKey: "Main Schlag beats ordinary Schlag",
    shortKey: "Suit + Schlag",
    farbe: "Gras",
    schlag: "Ober",
    cards3: [c("Eichel", "Ober"), c("Gras", "Ober"), c("Gras", "Ass")],
    cards4: [
      c("Eichel", "Ober"),
      c("Gras", "Ober"),
      c("Gras", "Ass"),
      c("Schellen", "Ober"),
    ],
    whyKey:
      "Gras Ober is both the selected suit and the selected Schlag, so it is the Main Schlag and outranks every ordinary Schlag and trump card.",
  },
  {
    id: "schlag-over-trump",
    titleKey: "Schlag beats trump even in another suit",
    shortKey: "Schlag vs trump",
    farbe: "Gras",
    schlag: "Ober",
    cards3: [c("Gras", "Ass"), c("Eichel", "Ober"), c("Herz", "Ass")],
    cards4: [
      c("Gras", "Ass"),
      c("Eichel", "Ober"),
      c("Herz", "Ass"),
      c("Schellen", "Ober"),
    ],
    whyKey:
      "Every ordinary Schlag is above normal trump cards. The Schlag does not need to be in the trump suit.",
    edgeKey:
      "In the four-player example two ordinary Schlag cards appear. They are equal, so the first Schlag played wins between them.",
  },
  {
    id: "equal-schlag",
    titleKey: "Equal Schlag: the first one wins",
    shortKey: "Play order decides",
    farbe: "Gras",
    schlag: "Ober",
    cards3: [c("Eichel", "Ober"), c("Schellen", "Ober"), c("Gras", "Ass")],
    cards4: [
      c("Eichel", "Ober"),
      c("Schellen", "Ober"),
      c("Gras", "Ass"),
      c("Herz", "Ober"),
    ],
    whyKey:
      "All ordinary Schlag cards have equal strength. Because equal strength does not replace the current winner, the first Schlag played keeps the trick.",
  },
  {
    id: "trump-over-led-suit",
    titleKey: "Even a low trump beats a normal led-suit card",
    shortKey: "Trump vs normal",
    farbe: "Gras",
    schlag: "Ober",
    cards3: [c("Herz", "Ass"), c("Gras", "7"), c("Herz", "Unter")],
    cards4: [
      c("Herz", "Ass"),
      c("Gras", "7"),
      c("Herz", "Unter"),
      c("Eichel", "Ass"),
    ],
    whyKey:
      "A normal trump card is a higher category than every ordinary card, so Gras 7 beats the Ace of the led suit.",
  },
  {
    id: "higher-trump",
    titleKey: "Higher trump wins between trump cards",
    shortKey: "Ace > King > Ober ...",
    farbe: "Gras",
    schlag: "Ober",
    cards3: [c("Gras", "8"), c("Gras", "Ass"), c("Eichel", "Ass")],
    cards4: [
      c("Gras", "8"),
      c("Gras", "Ass"),
      c("Eichel", "Ass"),
      c("Gras", "König"),
    ],
    whyKey:
      "When several normal trump cards are played, their normal rank decides: Ace, King, Ober, Unter, 10, 9, 8, 7.",
  },
  {
    id: "led-suit",
    titleKey: "Without a special card, the led suit decides",
    shortKey: "Led suit matters",
    farbe: "Gras",
    schlag: "Ober",
    cards3: [c("Herz", "8"), c("Eichel", "Ass"), c("Herz", "Unter")],
    cards4: [
      c("Herz", "8"),
      c("Eichel", "Ass"),
      c("Herz", "Unter"),
      c("Schellen", "Ass"),
    ],
    whyKey:
      "No critical, Main Schlag, Schlag or trump is present. Only cards of the first played suit can win, and Herz Unter is higher than Herz 8.",
  },
  {
    id: "off-suit-ace",
    titleKey: "An off-suit Ace can still lose",
    shortKey: "Off-suit edge case",
    farbe: "Gras",
    schlag: "Ober",
    cards3: [c("Schellen", "8"), c("Herz", "Ass"), c("Schellen", "9")],
    cards4: [
      c("Schellen", "8"),
      c("Herz", "Ass"),
      c("Schellen", "9"),
      c("Eichel", "König"),
    ],
    whyKey:
      "The Ace is not in the led suit and is not a special card, so it cannot beat a lower card that follows the led suit.",
  },
  {
    id: "critical-overlap",
    titleKey: "When Main Schlag would also be a critical card",
    shortKey: "Critical classification wins",
    farbe: "Herz",
    schlag: "König",
    cards3: [c("Herz", "König"), c("Schellen", "König"), c("Herz", "Ass")],
    cards4: [
      c("Herz", "König"),
      c("Schellen", "König"),
      c("Herz", "Ass"),
      c("Eichel", "König"),
    ],
    whyKey:
      "Herz König is Max. Even though it matches both suit and Schlag, it stays a critical card and therefore uses the higher critical priority.",
    edgeKey:
      "In this combination the mathematical Main Schlag is already Max, so it is not treated as a separate lower Main-Schlag card.",
  },
  {
    id: "trumpf-kritisch",
    titleKey: "Trumpf oder Kritisch forces a response",
    shortKey: "First-trick obligation",
    farbe: "Gras",
    schlag: "Ober",
    firstTrick: true,
    cards3: [c("Gras", "Ober"), c("Gras", "10"), c("Schellen", "7")],
    cards4: [
      c("Gras", "Ober"),
      c("Gras", "10"),
      c("Schellen", "7"),
      c("Eichel", "Ass"),
    ],
    whyKey:
      "The Main Schlag was led in the first trick, so Trumpf oder Kritisch is active. A player who holds a trump or critical card must play one. Belli then wins because it is critical.",
    edgeKey:
      "A player with no trump and no critical card is free to play another card.",
    legalExamples3: [
      {
        playerIndex: 1,
        hand: [c("Gras", "10"), c("Eichel", "Ass")],
        legalIndexes: [0],
        explanationKey:
          "This player has a trump card, so the off-suit Ace is not legal while Trumpf oder Kritisch is active.",
      },
      {
        playerIndex: 2,
        hand: [c("Schellen", "7"), c("Herz", "10")],
        legalIndexes: [0],
        explanationKey:
          "Belli is critical, so it satisfies Trumpf oder Kritisch and must be chosen over the normal card.",
      },
    ],
    legalExamples4: [
      {
        playerIndex: 1,
        hand: [c("Gras", "10"), c("Eichel", "Ass")],
        legalIndexes: [0],
        explanationKey:
          "This player has a trump card, so the off-suit Ace is not legal while Trumpf oder Kritisch is active.",
      },
      {
        playerIndex: 2,
        hand: [c("Schellen", "7"), c("Herz", "10")],
        legalIndexes: [0],
        explanationKey:
          "Belli is critical, so it satisfies Trumpf oder Kritisch and must be chosen over the normal card.",
      },
      {
        playerIndex: 3,
        hand: [c("Eichel", "Ass"), c("Herz", "10")],
        legalIndexes: [0, 1],
        explanationKey:
          "This player has neither trump nor a critical card, so either normal card is legal.",
      },
    ],
  },
  {
    id: "trumpf-kritisch-no-match",
    titleKey: "Trumpf oder Kritisch when a player has no matching card",
    shortKey: "No trump or critical in hand",
    farbe: "Gras",
    schlag: "Ober",
    firstTrick: true,
    cards3: [c("Gras", "Ober"), c("Eichel", "Ass"), c("Herz", "10")],
    cards4: [
      c("Gras", "Ober"),
      c("Eichel", "Ass"),
      c("Herz", "10"),
      c("Schellen", "Ass"),
    ],
    whyKey:
      "Trumpf oder Kritisch does not invent a card a player does not have. If the hand contains neither trump nor a critical card, a normal card may be played freely; here the Main Schlag remains the winner.",
    edgeKey:
      "The obligation is conditional: it applies only when the player actually holds at least one trump or critical card.",
    legalExamples3: [
      {
        playerIndex: 1,
        hand: [c("Eichel", "Ass"), c("Herz", "10")],
        legalIndexes: [0, 1],
        explanationKey:
          "Neither card is trump or critical, so both normal cards are legal.",
      },
      {
        playerIndex: 2,
        hand: [c("Schellen", "Ass"), c("Eichel", "10")],
        legalIndexes: [0, 1],
        explanationKey:
          "This hand also contains no trump and no critical card, so the player may discard freely.",
      },
    ],
    legalExamples4: [
      {
        playerIndex: 1,
        hand: [c("Eichel", "Ass"), c("Herz", "10")],
        legalIndexes: [0, 1],
        explanationKey:
          "Neither card is trump or critical, so both normal cards are legal.",
      },
      {
        playerIndex: 2,
        hand: [c("Schellen", "Ass"), c("Eichel", "10")],
        legalIndexes: [0, 1],
        explanationKey:
          "This hand also contains no trump and no critical card, so the player may discard freely.",
      },
    ],
  },
  {
    id: "hauptschlag-later-trick",
    titleKey: "Main Schlag in a later trick",
    shortKey: "No Trumpf-oder-Kritisch trigger",
    farbe: "Gras",
    schlag: "Ober",
    firstTrick: false,
    cards3: [c("Gras", "Ober"), c("Gras", "Ass"), c("Schellen", "7")],
    cards4: [
      c("Gras", "Ober"),
      c("Gras", "Ass"),
      c("Schellen", "7"),
      c("Eichel", "Ober"),
    ],
    whyKey:
      "The Main Schlag is still a very strong card, but Trumpf oder Kritisch is only activated when it is led in the first trick. Here Belli still wins simply because it is critical.",
    edgeKey:
      "Playing the Main Schlag later does not create the special forced-response rule.",
  },
];

function getSituationStrength(
  card: SituationCard,
  leadSuit: Suit,
  farbe: Suit,
  schlag: Rank,
) {
  const criticalValue = getCriticalValue(card as WattenCard);

  if (criticalValue > 0) return { category: 5, value: criticalValue };
  if (isHauptschlag(card as WattenCard, farbe, schlag)) {
    return { category: 4, value: 1 };
  }
  if (card.rank === schlag) return { category: 3, value: 1 };
  if (card.suit === farbe) {
    return { category: 2, value: normalRankValue[card.rank] ?? 0 };
  }
  if (card.suit === leadSuit) {
    return { category: 1, value: normalRankValue[card.rank] ?? 0 };
  }
  return { category: 0, value: 0 };
}

function determineSituationWinner(
  cards: SituationCard[],
  farbe: Suit,
  schlag: Rank,
) {
  const leadSuit = cards[0].suit;
  let winnerIndex = 0;
  let winnerStrength = getSituationStrength(cards[0], leadSuit, farbe, schlag);

  for (let index = 1; index < cards.length; index += 1) {
    const strength = getSituationStrength(
      cards[index],
      leadSuit,
      farbe,
      schlag,
    );
    if (
      strength.category > winnerStrength.category ||
      (strength.category === winnerStrength.category &&
        strength.value > winnerStrength.value)
    ) {
      winnerIndex = index;
      winnerStrength = strength;
    }
  }

  return winnerIndex;
}

function getSituationRoleKey(
  card: SituationCard,
  leadSuit: Suit,
  farbe: Suit,
  schlag: Rank,
) {
  const criticalValue = getCriticalValue(card as WattenCard);
  if (criticalValue === 3) return "Max · highest critical";
  if (criticalValue === 2) return "Belli · second critical";
  if (criticalValue === 1) return "Spitz · third critical";
  if (isHauptschlag(card as WattenCard, farbe, schlag)) return "Main Schlag";
  if (card.rank === schlag) return "Schlag";
  if (card.suit === farbe) return "Trump";
  if (card.suit === leadSuit) return "Led suit";
  return "Off-suit normal card";
}

function RuleCard({
  card,
  small = false,
}: {
  card: DisplayCard;
  small?: boolean;
}) {
  useGameLanguage();
  const { cardTheme } = useCardTheme();

  return (
    <div
      className={`
        relative
        shrink-0
        overflow-hidden
        rounded-[10px]
        ${small ? "h-[105px] w-[73px]" : "h-[140px] w-[97px]"}
      `}
    >
      <img
        src={getWattenCardImage(card, cardTheme)}
        alt={gameUi(`${card.suit} ${card.rank}`)}
        draggable={false}
        className="
          absolute
          left-1/2
          top-1/2
          block
          h-full
          w-full
          -translate-x-1/2
          -translate-y-1/2
          object-fill
          [clip-path:inset(1px_2px_1px_2px_round_6px)]
        "
      />
    </div>
  );
}

function RulePanel({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  useGameLanguage();
  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.045] p-6 shadow-xl">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-400/10 text-emerald-300">
          {gameUi(icon)}
        </div>

        <h2 className="text-xl font-black text-white">{gameUi(title)}</h2>
      </div>

      <div className="mt-4 space-y-3 text-sm leading-7 text-zinc-300">
        {gameUi(children)}
      </div>
    </section>
  );
}

function CategoryArrow({ language }: { language: WattenLanguage }) {
  return (
    <div className="flex justify-center py-1">
      <div className="flex flex-col items-center text-zinc-600">
        <span className="text-2xl leading-none">↓</span>

        <span className="mt-1 text-[8px] font-bold uppercase tracking-[0.2em]">
          {translateWatten(language, "lower")}
        </span>
      </div>
    </div>
  );
}

function PriorityRelation({
  type,
  language,
}: {
  type: "higher" | "equal";
  language: WattenLanguage;
}) {
  useGameLanguage();
  return (
    <div className="flex min-w-9 flex-col items-center justify-center">
      {gameUi(type === "higher" ? (
        <>
          <ChevronRight size={27} className="text-amber-300" />

          <span className="mt-1 text-[8px] font-bold uppercase tracking-wider text-zinc-500">
            {translateWatten(language, "stronger")}
          </span>
        </>
      ) : (
        <>
          <CircleEqual size={25} className="text-sky-300" />

          <span className="mt-1 text-[8px] font-bold uppercase tracking-wider text-zinc-500">
            {translateWatten(language, "equal")}
          </span>
        </>
      ))}
    </div>
  );
}

function PriorityRow({
  cards,
  relation = "higher",
  language,
}: {
  cards: WattenCard[];
  relation?: "higher" | "equal";
  language: WattenLanguage;
}) {
  useGameLanguage();
  return (
    <div className="flex flex-wrap items-center gap-3">
      {cards.map((card, index) => (
        <div key={card.id} className="flex items-center gap-3">
          <div className="flex flex-col items-center gap-1.5">
            <RuleCard card={card} small />

            <span className="max-w-[74px] text-center text-[9px] font-semibold leading-4 text-zinc-400">
              {translateWatten(language, card.suit)}{gameUi(" ")}
              {translateWatten(language, card.rank)}
            </span>
          </div>

          {gameUi(index < cards.length - 1 && (
            <PriorityRelation type={relation} language={language} />
          ))}
        </div>
      ))}
    </div>
  );
}

export default function WattenRule() {
  const { language } = useAppLanguage();
  const t = useCallback(
    (key: string) => translateWatten(language, key),
    [language],
  );
  const l = useCallback(
    (deText: string, enText: string) =>
      translateWattenPair(language, deText, enText),
    [language],
  );


  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [situationMode, setSituationMode] = useState<SituationMode>("three");
  const [activeSituationId, setActiveSituationId] = useState(
    wattenSituations[0].id,
  );

  /*
    Default example:

    Farbe / Trumpf = Gras
    Schlag = Ober
  */
  const [exampleFarbe, setExampleFarbe] = useState<Suit>("Gras");

  const [exampleSchlag, setExampleSchlag] = useState<Rank>("Ober");

  const { tableTheme } = useTableTheme();

  const priority = useMemo(() => {
    const deck = createDeck();

    const kritische = deck
      .filter((card) => isCritical(card))
      .sort((a, b) => getCriticalValue(b) - getCriticalValue(a));

    /*
      If a Kritische also mathematically matches
      Farbe + Schlag, it remains a Kritische.
    */
    const hauptschlag = deck.filter(
      (card) =>
        !isCritical(card) && isHauptschlag(card, exampleFarbe, exampleSchlag),
    );

    const schlaege = deck.filter(
      (card) =>
        card.rank === exampleSchlag &&
        !isCritical(card) &&
        !isHauptschlag(card, exampleFarbe, exampleSchlag),
    );

    const trumpf = deck
      .filter(
        (card) =>
          card.suit === exampleFarbe &&
          card.rank !== exampleSchlag &&
          !isCritical(card),
      )
      .sort(
        (a, b) =>
          (normalRankValue[b.rank] ?? 0) - (normalRankValue[a.rank] ?? 0),
      );
    const normalExampleSuit: Suit = exampleFarbe !== "Gras" ? "Gras" : "Herz";

    const normaleKarten = deck
      .filter(
        (card) =>
          card.suit === normalExampleSuit &&
          card.suit !== exampleFarbe &&
          card.rank !== exampleSchlag &&
          !isCritical(card) &&
          !isHauptschlag(card, exampleFarbe, exampleSchlag),
      )
      .sort(
        (a, b) =>
          (normalRankValue[b.rank] ?? 0) - (normalRankValue[a.rank] ?? 0),
      );
    return {
      kritische,
      hauptschlag,
      schlaege,
      trumpf,
      normaleKarten,
      normalExampleSuit,
    };
  }, [exampleFarbe, exampleSchlag]);

  const tabs: {
    id: Tab;
    label: string;
  }[] = [
    {
      id: "overview",
      label: t("Overview"),
    },
    {
      id: "rules",
      label: t("Rules"),
    },
    {
      id: "situations",
      label: t("Situations"),
    },
    {
      id: "cards",
      label: t("Cards"),
    },
  ];

  const activeSituation =
    wattenSituations.find((item) => item.id === activeSituationId) ??
    wattenSituations[0];

  const activeSituationCards =
    situationMode === "three" ? activeSituation.cards3 : activeSituation.cards4;

  const activeSituationWinnerIndex = determineSituationWinner(
    activeSituationCards,
    activeSituation.farbe,
    activeSituation.schlag,
  );

  const activeLeadSuit = activeSituationCards[0].suit;

  function situationPlayerLabel(index: number) {
    if (situationMode === "three") {
      return index === 0
        ? t("Solo")
        : `${t("Team")} · ${t("Player")} ${index + 1}`;
    }

    return `${t(index % 2 === 0 ? "Team A" : "Team B")} · ${t("Player")} ${index + 1}`;
  }

  return (
    <main className="watten-menu watten-menu--rules min-h-screen px-4 py-7 text-white md:px-8">
      <div className="mx-auto max-w-[1500px]">
        <div className="ml-10 relative z-[200] mb-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-zinc-900/80 px-5 py-3 shadow-xl backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-400/10">
              🎨
            </div>

            <div>
              <p className="text-sm font-bold text-white">{t("Design")}</p>

              <p className="text-[11px] text-zinc-500">
                {t("Customize how the rules are displayed")}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <HeaderTools><CardThemeSelector /><TableThemeSelector /></HeaderTools>
          </div>
        </div>
        {/* HERO */}
        <section
          className="watten-table
    relative
    mx-auto
    h-[340px]
    w-full
    max-w-[1100px]
    overflow-hidden
    rounded-[36px]
    shadow-2xl
    md:h-[400px]
  "
          style={wattenTableStyle(tableTheme)}
        >
          <div className="absolute inset-0 bg-black/50" />

          <div className="relative z-10 flex h-full items-center px-8 py-10 md:px-12">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/30 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-emerald-300 backdrop-blur">
                <BookOpen size={15} />
                {t("Bavarian Watten")}
              </div>

              <h1 className="mt-5 text-4xl font-black md:text-5xl">
                {t("Game rules")}
              </h1>

              <p className="mt-4 max-w-2xl leading-7 text-zinc-200">
                {t(
                  "Rules, card ranking and an interactive example for suit, Schlag and card priority.",
                )}
              </p>
            </div>
          </div>
        </section>

        {/* TABS */}
        <div className="mt-7 flex w-fit gap-1 rounded-2xl border border-white/10 bg-zinc-900 p-1.5 shadow-xl">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`
                rounded-xl
                px-5 py-2.5
                text-sm font-bold
                transition
                ${
                  activeTab === tab.id
                    ? "bg-emerald-500 text-emerald-950 shadow-lg"
                    : "text-zinc-400 hover:bg-white/5 hover:text-white"
                }
              `}
            >
              {gameUi(tab.label)}
            </button>
          ))}
        </div>

        {/* CONTENT + SIDEBAR */}
        <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_440px]">
          {/* LEFT CONTENT */}
          <div>
            {/* =====================
                ÜBERSICHT
            ====================== */}
            {gameUi(activeTab === "overview" && (
              <div className="grid gap-5 md:grid-cols-2">
                <RulePanel
                  icon={<Target size={22} />}
                  title={t("Goal of the game")}
                >
                  <p>
                    {gameUi(l(
                      "Ziel ist es, eine Runde durch Stiche zu gewinnen und dadurch\n                    Punkte für die Gesamtwertung zu erhalten.",
                      "The goal is to win a round through tricks and earn points for the overall score.",
                    ))}
                  </p>

                  <p>
                    {gameUi(l(
                      "Eine Runde wird normalerweise über fünf mögliche Stiche\n                    entschieden. Wer zuerst die notwendige Mehrheit der Stiche\n                    erreicht, gewinnt die Runde.",
                      "A round normally has up to five tricks. The first side to reach the required majority wins the round.",
                    ))}
                  </p>

                  <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4">
                    <strong className="text-emerald-300">
                      {gameUi(l("Grundidee:", "Basic idea:"))}
                    </strong>

                    <p className="mt-1">
                      {gameUi(l(
                        "Gute Karten helfen – aber Farbe, Schlag, Kritische und\n                      taktische Ansagen bestimmen oft, welche Karte tatsächlich\n                      gewinnt.",
                        "Strong cards help, but suit, Schlag, critical cards and tactical calls often determine which card actually wins.",
                      ))}
                    </p>
                  </div>
                </RulePanel>

                <RulePanel icon={<Swords size={22} />} title={t("Tricks")}>
                  <p>
                    {gameUi(l(
                      "Jeder Spieler legt pro Stich eine Karte. Anschließend wird\n                    bestimmt, welche Karte den Stich gewinnt.",
                      "Each player plays one card per trick. The winning card is then determined.",
                    ))}
                  </p>

                  <p>
                    {gameUi(l(
                      "Entscheidend ist dabei die Kartenpriorität:",
                      "Card priority is decisive:",
                    ))}
                  </p>

                  <div className="rounded-2xl bg-black/20 p-4 font-semibold">
                    <div>{t("Critical cards")}</div>
                    <div className="pl-3 text-zinc-500">↓</div>

                    <div>{t("Main Schlag")}</div>
                    <div className="pl-3 text-zinc-500">↓</div>

                    <div>{t("Other Schlag cards")}</div>
                    <div className="pl-3 text-zinc-500">↓</div>

                    <div>{t("Trump / suit")}</div>
                    <div className="pl-3 text-zinc-500">↓</div>

                    <div>{t("Normal cards")}</div>
                  </div>

                  <p>
                    {gameUi(l(
                      "Der Gewinner eines Stichs spielt den nächsten Stich aus.\n                    Keine feste Reihenfolge zwischen verschiedenen Farben. Es\n                    zählt die angespielte (zuerst gespielte) Farbe; innerhalb\n                    dieser Farbe: Ass → König → Ober → Unter → 10 → 9 → 8 → 7.",
                      "The winner of a trick leads the next trick. There is no fixed order between different suits; the led suit matters, and within that suit: Ace → King → Ober → Unter → 10 → 9 → 8 → 7.",
                    ))}
                  </p>
                </RulePanel>
              </div>
            ))}

            {/* =====================
                REGELN
            ====================== */}
            {gameUi(activeTab === "rules" && (
              <div className="space-y-5">
                <RulePanel icon={<ShieldAlert size={22} />} title={t("Gehen")}>
                  <p>
                    {t("A round starts at a value of")}{gameUi(" ")}
                    <strong className="text-amber-300">{t("2 points")}</strong>.
                  </p>

                  <p>
                    {gameUi(l(
                      "Durch „Gehen“ kann eine Seite versuchen, den Rundenwert zu\n                    erhöhen.",
                      "With “Gehen”, one side can try to raise the value of the round.",
                    ))}
                  </p>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-center">
                      <div className="text-2xl font-black text-white">2</div>

                      <div className="mt-1 text-xs text-zinc-500">
                        {t("Start value")}
                      </div>
                    </div>

                    <div className="rounded-xl border border-amber-400/20 bg-amber-400/10 p-4 text-center">
                      <div className="text-2xl font-black text-amber-300">
                        3
                      </div>

                      <div className="mt-1 text-xs text-zinc-500">
                        {t("first raise")}
                      </div>
                    </div>

                    <div className="rounded-xl border border-amber-400/20 bg-amber-400/10 p-4 text-center">
                      <div className="text-2xl font-black text-amber-300">
                        4
                      </div>

                      <div className="mt-1 text-xs text-zinc-500">
                        {t("maximum")}
                      </div>
                    </div>
                  </div>

                  <p>
                    {gameUi(l(
                      "Die Gegenseite kann den höheren Wert",
                      "The opposing side can",
                    ))}
                    <strong className="text-emerald-300">
                      {gameUi(l(" halten", " hold"))}
                    </strong>
                    {gameUi(l(
                      ". Dann wird um den neuen Wert weitergespielt.",
                      ". The round then continues at the new value.",
                    ))}
                  </p>

                  <p>
                    {gameUi(l(
                      "Wird nicht gehalten, gewinnt die Seite, die erhöht hat, die\n                    Runde zum bisher gültigen Rundenwert.",
                      "If the raise is declined, the raising side wins the round at the previously accepted round value.",
                    ))}
                  </p>
                </RulePanel>

                <RulePanel icon={<Hand size={22} />} title={t("Abheben")}>
                  <p>
                    {gameUi(l(
                      "Vor dem eigentlichen Austeilen wird abgehoben.",
                      "The deck is cut before the cards are dealt.",
                    ))}
                  </p>

                  <p>
                    {gameUi(l(
                      "Der Abheber befindet sich rechts vom Geber.",
                      "The cutter sits to the right of the dealer.",
                    ))}
                  </p>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <p className="font-bold text-white">{t("3 Players")}</p>

                      <p className="mt-2 text-sm text-zinc-400">
                        {gameUi(l(
                          "Eine Karte wird beim Abheben aufgedeckt. Ist sie\n                        kritisch, erhält der Abheber die Karte. Bei einer\n                        normalen Karte wird das Abheben beendet.",
                          "A card is revealed when cutting. If it is critical, the cutter receives it. A normal card ends the cutting sequence.",
                        ))}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <p className="font-bold text-white">{t("4 Players")}</p>

                      <p className="mt-2 text-sm text-zinc-400">
                        {gameUi(l(
                          "Der Stapel wird an einer gewählten Stelle getrennt.\n                        Kritische Karten können beim Aufdecken bereits verteilt\n                        werden, bevor die restlichen Karten ausgegeben werden.",
                          "The deck is split at the chosen position. Critical cards can already be distributed while revealing before the remaining cards are dealt.",
                        ))}
                      </p>
                    </div>
                  </div>

                  <p>
                    {gameUi(l(
                      "Danach wird so ausgeteilt, dass jeder Spieler insgesamt fünf\n                    Karten besitzt.",
                      "Cards are then dealt until every player has five cards in total.",
                    ))}
                  </p>
                </RulePanel>

                <RulePanel
                  icon={<Sparkles size={22} />}
                  title={t("Trumpf oder Kritisch")}
                >
                  <p>
                    {gameUi(l(
                      "Diese Sonderregel kann im ersten Stich durch den",
                      "This special rule can be activated in the first trick by the",
                    ))}
                    <strong className="text-amber-300">
                      {gameUi(l("Hauptschlag", "Main Schlag"))}
                    </strong>
                    {gameUi(l("aktiviert werden.", "being played."))}
                  </p>

                  <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-5">
                    <p className="font-black text-amber-200">
                      {gameUi(l(
                        "Wird der Hauptschlag ausgespielt:",
                        "When the Main Schlag is played:",
                      ))}
                    </p>

                    <p className="mt-2 text-amber-100/80">
                      {gameUi(l(
                        "Spieler, die einen Trumpf oder eine Kritische besitzen, müssen eine solche Karte spielen.",
                        "Players who hold a trump or critical card must play one of those cards.",
                      ))}
                    </p>
                  </div>

                  <p>
                    {gameUi(l(
                      "Besitzt ein Spieler weder Trumpf noch Kritische, darf er frei eine andere Karte wählen.",
                      "If a player has neither trump nor a critical card, they may freely choose another card.",
                    ))}
                  </p>
                </RulePanel>
              </div>
            ))}

            {/* =====================
                KARTEN
            ====================== */}
            {gameUi(activeTab === "cards" && (
              <div className="space-y-5">
                {/* KRITISCHE */}
                <RulePanel
                  icon={<Crown size={22} />}
                  title={t("Critical cards")}
                >
                  <p>
                    {gameUi(l(
                      "Die drei Kritischen stehen an der Spitze der Kartenrangfolge.",
                      "The three critical cards are at the top of the card ranking.",
                    ))}
                  </p>

                  <div className="mt-5 flex flex-wrap items-center justify-center gap-4">
                    {[
                      {
                        name: "Max",
                        card: {
                          suit: "Herz",
                          rank: "König",
                        } as DisplayCard,
                      },
                      {
                        name: "Belli",
                        card: {
                          suit: "Schellen",
                          rank: "7",
                        } as DisplayCard,
                      },
                      {
                        name: "Spitz",
                        card: {
                          suit: "Eichel",
                          rank: "7",
                        } as DisplayCard,
                      },
                    ].map((item, index, array) => (
                      <div key={item.name} className="flex items-center gap-4">
                        <div className="flex flex-col items-center">
                          <RuleCard card={item.card} />

                          <span className="mt-2 font-black text-amber-300">
                            {gameUi(item.name)}
                          </span>

                          <span className="text-[10px] text-zinc-500">
                            {t(item.card.suit)} {t(item.card.rank)}
                          </span>
                        </div>

                        {gameUi(index < array.length - 1 && (
                          <PriorityRelation type="higher" language={language} />
                        ))}
                      </div>
                    ))}
                  </div>

                  <p>
                    {gameUi(l("Damit gilt:", "Therefore:"))}
                    <strong className="text-white">{gameUi(" Max → Belli → Spitz")}</strong>
                    .
                  </p>
                </RulePanel>

                {/* HAUPTSCHLAG */}
                <RulePanel icon={<Crown size={22} />} title={t("Main Schlag")}>
                  <p>
                    {gameUi(l(
                      "Der Hauptschlag entsteht aus der Kombination von",
                      "The Main Schlag is created by combining",
                    ))}
                    <strong className="text-emerald-300">
                      {gameUi(l("Trumpf", "Trump"))}
                    </strong>
                    {gameUi(l("und", "and"))}
                    <strong className="text-amber-300">{gameUi(" Schlag")}</strong>.
                  </p>

                  <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                    <p className="text-sm text-zinc-400">
                      {gameUi(l("Beispiel", "Example"))}
                    </p>

                    <p className="mt-1 font-bold">
                      {t("Trump")} = {t("Gras")}
                      <br />
                      {t("Schlag")} = {t("Ober")}
                    </p>

                    <p className="mt-3">
                      →{gameUi(" ")}
                      <strong className="text-amber-300">
                        {t("Gras")} {t("Ober")}
                      </strong>{gameUi(" ")}
                      {t("is the Main Schlag.")}
                    </p>
                  </div>

                  <p>
                    {gameUi(l(
                      "Der Hauptschlag steht unmittelbar unter den Kritischen und über allen gewöhnlichen Schlägen und Trumpfkarten.",
                      "The Main Schlag ranks directly below the critical cards and above all ordinary Schlag and trump cards.",
                    ))}
                  </p>

                  <p>
                    {gameUi(l(
                      "Im ersten Stich kann der Hauptschlag außerdem die Regel „Trumpf oder Kritisch“ aktivieren.",
                      "In the first trick, the Main Schlag can also activate the “Trump or Critical” rule.",
                    ))}
                  </p>
                </RulePanel>

                {/* SCHLAG */}
                <RulePanel icon={<Layers3 size={22} />} title={t("Schlag")}>
                  <p>
                    {gameUi(l(
                      "Der Schlag ist ein bestimmter Kartenrang, zum Beispiel Ober, König oder 9.",
                      "Schlag is a selected card rank, for example Ober, King or 9.",
                    ))}
                  </p>

                  <p>
                    {gameUi(l(
                      "Alle Karten dieses Rangs werden zu Schlägen.",
                      "All cards of this rank become Schlag cards.",
                    ))}
                  </p>

                  <div className="rounded-2xl border border-sky-400/20 bg-sky-400/10 p-4">
                    <p className="font-bold text-sky-200">
                      {gameUi(l("Wichtig:", "Important:"))}
                    </p>

                    <p className="mt-1">
                      {gameUi(l(
                        "Die normalen Schläge besitzen untereinander dieselbe Stärke. Werden zwei gleichwertige Schläge gespielt, gewinnt der zuerst gespielte.",
                        "The normal Schlag cards are equal in strength. If two equal Schlag cards are played, the one played first wins.",
                      ))}
                    </p>
                  </div>
                </RulePanel>

                {/* FARBE */}
                <RulePanel
                  icon={<Sparkles size={22} />}
                  title={t("Trump / suit")}
                >
                  <p>
                    {gameUi(l(
                      "Die gewählte Farbe ist die Trumpffarbe der Runde.",
                      "The selected suit is the trump suit for the round.",
                    ))}
                  </p>

                  <div className="grid grid-cols-4 gap-3">
                    {suits.map((suit) => (
                      <div
                        key={suit}
                        className="flex flex-col items-center rounded-2xl border border-white/10 bg-white/5 p-3"
                      >
                        <img
                          src={suitIcons[suit]}
                          alt={t(suit)}
                          className="h-12 w-12 object-contain"
                        />

                        <span className="mt-2 text-xs font-bold">
                          {t(suit)}
                        </span>
                      </div>
                    ))}
                  </div>

                  <p>
                    {gameUi(l(
                      "Trumpfkarten stehen unterhalb der Schläge, sind aber stärker als gewöhnliche Karten.",
                      "Trump cards rank below Schlag cards but above ordinary cards.",
                    ))}
                  </p>
                </RulePanel>

                {/* NORMAL */}
                <RulePanel
                  icon={<Layers3 size={22} />}
                  title={t("Normal cards")}
                >
                  <p>
                    {gameUi(l(
                      "Normale Karten sind weder Kritische noch Hauptschlag, Schlag oder Trumpf.",
                      "Normal cards are neither critical cards, Main Schlag, Schlag nor trump.",
                    ))}
                  </p>

                  <div className="rounded-2xl bg-black/20 p-4 text-center font-black tracking-wide text-white">
                    {gameUi(l(
                      "Keine feste Reihenfolge zwischen verschiedenen Farben. Es\n                    zählt die angespielte (zuerst gespielte) Farbe; innerhalb\n                    dieser Farbe: Ass → König → Ober → Unter → 10 → 9 → 8 → 7.",
                      "There is no fixed order between different suits. The led suit matters; within that suit: Ace → King → Ober → Unter → 10 → 9 → 8 → 7.",
                    ))}
                  </div>

                  <p>
                    {gameUi(l(
                      "Zwischen verschiedenen normalen Farben besteht keine allgemeine Trumpf-Priorität.",
                      "There is no general priority between different normal suits.",
                    ))}
                  </p>
                </RulePanel>
              </div>
            ))}
            {/* =====================
                SITUATIONS
            ====================== */}
            {gameUi(activeTab === "situations" && (
              <div className="space-y-5">
                <section className="rounded-3xl border border-white/10 bg-white/[0.045] p-5 shadow-xl sm:p-6">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-300">
                        {t("Interactive situations")}
                      </p>
                      <h2 className="mt-1 text-2xl font-black">
                        {t("Why did this card win?")}
                      </h2>
                      <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
                        {t(
                          "Choose a situation and inspect the cards in play order. The winner and the relevant edge rule are explained below.",
                        )}
                      </p>
                    </div>

                    <div className="grid shrink-0 grid-cols-2 rounded-2xl border border-white/10 bg-black/20 p-1.5">
                      <button
                        type="button"
                        onClick={() => setSituationMode("three")}
                        className={`rounded-xl px-4 py-2.5 text-sm font-black transition ${
                          situationMode === "three"
                            ? "bg-amber-400 text-amber-950"
                            : "text-zinc-400 hover:bg-white/5 hover:text-white"
                        }`}
                      >
                        {t("3 Players")}
                      </button>
                      <button
                        type="button"
                        onClick={() => setSituationMode("four")}
                        className={`rounded-xl px-4 py-2.5 text-sm font-black transition ${
                          situationMode === "four"
                            ? "bg-emerald-400 text-emerald-950"
                            : "text-zinc-400 hover:bg-white/5 hover:text-white"
                        }`}
                      >
                        {t("4 Players")}
                      </button>
                    </div>
                  </div>

                  <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-xs leading-5 text-zinc-400">
                    {gameUi(situationMode === "three"
                      ? t(
                          "Three-player mode: one Solo player faces a two-player team. Card priority itself is the same as in four-player mode.",
                        )
                      : t(
                          "Four-player mode: Team A and Team B alternate seats. Card priority itself is the same as in three-player mode.",
                        ))}
                  </div>
                </section>

                <div className="grid gap-5 lg:grid-cols-[250px_minmax(0,1fr)]">
                  <section className="rounded-3xl border border-white/10 bg-zinc-900/80 p-3 shadow-xl">
                    <p className="px-2 pb-2 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
                      {t("Choose a case")}
                    </p>
                    <div className="space-y-2">
                      {wattenSituations.map((situation, index) => {
                        const selected = situation.id === activeSituation.id;
                        return (
                          <button
                            key={situation.id}
                            type="button"
                            onClick={() => setActiveSituationId(situation.id)}
                            className={`w-full rounded-2xl border p-3 text-left transition ${
                              selected
                                ? "border-amber-400/40 bg-amber-400/10"
                                : "border-white/5 bg-white/[0.025] hover:border-white/15 hover:bg-white/5"
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <span
                                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-black ${
                                  selected
                                    ? "bg-amber-400 text-amber-950"
                                    : "bg-white/5 text-zinc-500"
                                }`}
                              >
                                {gameUi(index + 1)}
                              </span>
                              <div className="min-w-0">
                                <p className="text-xs font-black text-white">
                                  {t(situation.titleKey)}
                                </p>
                                <p className="mt-1 text-[10px] leading-4 text-zinc-500">
                                  {t(situation.shortKey)}
                                </p>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </section>

                  <section className="min-w-0 rounded-3xl border border-white/10 bg-zinc-900/80 p-5 shadow-xl sm:p-6">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-300">
                          {t(activeSituation.shortKey)}
                        </p>
                        <h3 className="mt-1 text-2xl font-black">
                          {t(activeSituation.titleKey)}
                        </h3>
                      </div>

                      <div className="flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-wider">
                        <span className="flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-emerald-300">
                          <img
                            src={suitIcons[activeSituation.farbe]}
                            alt={gameUi(activeSituation.farbe)}
                            className="h-4 w-4 object-contain"
                          />
                          {t("Trump")}: {t(activeSituation.farbe)}
                        </span>
                        <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1.5 text-amber-300">
                          {t("Schlag")}: {t(activeSituation.schlag)}
                        </span>
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-zinc-400">
                          {gameUi(activeSituation.firstTrick
                            ? t("First trick")
                            : t("Any / later trick"))}
                        </span>
                      </div>
                    </div>

                    <div
                      className={`mt-6 grid gap-3 ${
                        situationMode === "three"
                          ? "sm:grid-cols-3"
                          : "sm:grid-cols-2 xl:grid-cols-4"
                      }`}
                    >
                      {activeSituationCards.map((card, index) => {
                        const won = index === activeSituationWinnerIndex;
                        const roleKey = getSituationRoleKey(
                          card,
                          activeLeadSuit,
                          activeSituation.farbe,
                          activeSituation.schlag,
                        );

                        return (
                          <div
                            key={`${activeSituation.id}-${index}-${card.suit}-${card.rank}`}
                            className={`relative rounded-2xl border p-4 text-center transition ${
                              won
                                ? "border-amber-300/60 bg-amber-400/10 ring-2 ring-amber-300/60"
                                : "border-white/10 bg-black/20"
                            }`}
                          >
                            <div className="mb-3 flex items-center justify-between gap-2">
                              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/5 text-[10px] font-black text-zinc-400">
                                {gameUi(index + 1)}
                              </span>
                              {gameUi(index === 0 && (
                                <span className="rounded-full bg-sky-400/10 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-sky-300">
                                  {t("Led")}
                                </span>
                              ))}
                              {gameUi(won && (
                                <span className="rounded-full bg-amber-400 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-amber-950">
                                  {t("Winner")}
                                </span>
                              ))}
                            </div>

                            <div className="flex justify-center">
                              <RuleCard card={card} />
                            </div>

                            <p className="mt-3 text-xs font-black text-white">
                              {gameUi(situationPlayerLabel(index))}
                            </p>
                            <p
                              className={`mt-1 text-[10px] font-bold ${
                                won ? "text-amber-300" : "text-zinc-500"
                              }`}
                            >
                              {t(roleKey)}
                            </p>
                          </div>
                        );
                      })}
                    </div>

                    <div className="mt-6 grid gap-3 md:grid-cols-2">
                      <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4">
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-300">
                          {t("Why this card won")}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-emerald-50/85">
                          {t(activeSituation.whyKey)}
                        </p>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">
                          {t("Rule snapshot")}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-zinc-300">
                          <strong className="text-white">
                            {t("Lead suit")}:
                          </strong>{gameUi(" ")}
                          {t(activeLeadSuit)}
                          <br />
                          <strong className="text-white">
                            {t("Winning card")}:
                          </strong>{gameUi(" ")}
                          {t(
                            activeSituationCards[activeSituationWinnerIndex]
                              .suit,
                          )}{gameUi(" ")}
                          {t(
                            activeSituationCards[activeSituationWinnerIndex]
                              .rank,
                          )}
                        </p>
                      </div>
                    </div>

                    {gameUi(activeSituation.edgeKey && (
                      <div className="mt-3 rounded-2xl border border-sky-400/20 bg-sky-400/10 p-4">
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-300">
                          {t("Edge case")}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-sky-50/80">
                          {t(activeSituation.edgeKey)}
                        </p>
                      </div>
                    ))}

                    {gameUi((() => {
                      const examples =
                        situationMode === "three"
                          ? activeSituation.legalExamples3
                          : activeSituation.legalExamples4;

                      if (!examples || examples.length === 0) return null;

                      return (
                        <div className="mt-5 rounded-2xl border border-amber-400/20 bg-amber-400/[0.055] p-4">
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-300">
                            {t("Trumpf oder Kritisch: legal-card examples")}
                          </p>

                          <div className="mt-4 grid gap-4 md:grid-cols-2">
                            {examples.map((example) => (
                              <div
                                key={`${activeSituation.id}-hand-${example.playerIndex}`}
                                className="rounded-xl border border-white/10 bg-black/20 p-3"
                              >
                                <p className="text-xs font-black text-white">
                                  {gameUi(situationPlayerLabel(example.playerIndex))}
                                </p>
                                <div className="mt-3 flex flex-wrap gap-3">
                                  {example.hand.map((card, cardIndex) => {
                                    const legal =
                                      example.legalIndexes.includes(cardIndex);
                                    return (
                                      <div
                                        key={`${card.suit}-${card.rank}-${cardIndex}`}
                                        className={`rounded-xl border p-2 ${
                                          legal
                                            ? "border-emerald-400/40 bg-emerald-400/10"
                                            : "border-red-400/30 bg-red-500/10 opacity-65"
                                        }`}
                                      >
                                        <RuleCard card={card} small />
                                        <p
                                          className={`mt-2 text-center text-[9px] font-black uppercase tracking-wider ${
                                            legal
                                              ? "text-emerald-300"
                                              : "text-red-300"
                                          }`}
                                        >
                                          {gameUi(legal ? t("Legal") : t("Not legal"))}
                                        </p>
                                      </div>
                                    );
                                  })}
                                </div>
                                <p className="mt-3 text-xs leading-5 text-zinc-400">
                                  {t(example.explanationKey)}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })())}
                  </section>
                </div>
              </div>
            ))}
          </div>

          {/* ==========================
              RIGHT SIDEBAR
          =========================== */}
          <aside className="xl:sticky xl:top-6 xl:self-start">
            <div className="overflow-hidden rounded-3xl border border-white/10 bg-zinc-900/95 shadow-2xl">
              {/* CONFIGURATOR */}
              <div className="border-b border-white/10 p-5">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-400">
                  {gameUi(l("Beispiel konfigurieren", "Configure example"))}
                </p>

                <h2 className="mt-1 text-xl font-black">{t("Card ranking")}</h2>

                <p className="mt-2 text-xs leading-5 text-zinc-500">
                  {gameUi(l(
                    "Wähle Trumpf und Schlag. Die Rangfolge darunter wird\n                  automatisch angepasst.",
                    "Choose trump and Schlag. The ranking below updates automatically.",
                  ))}
                </p>

                {/* FARBE */}
                <div className="mt-6">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                    {t("Trump / suit")}
                  </label>

                  <div className="mt-2 grid grid-cols-4 gap-2">
                    {suits.map((suit) => {
                      const selected = exampleFarbe === suit;

                      return (
                        <button
                          key={suit}
                          type="button"
                          onClick={() => setExampleFarbe(suit)}
                          title={t(suit)}
                          className={`
                            flex h-16 items-center justify-center
                            rounded-xl border
                            transition
                            ${
                              selected
                                ? "border-emerald-400 bg-emerald-400/15 shadow-[0_0_15px_rgba(52,211,153,.2)]"
                                : "border-white/10 bg-white/5 hover:border-white/25"
                            }
                          `}
                        >
                          <img
                            src={suitIcons[suit]}
                            alt={t(suit)}
                            draggable={false}
                            className="h-10 w-10 object-contain"
                          />
                        </button>
                      );
                    })}
                  </div>

                  <p className="mt-2 text-xs font-semibold text-emerald-300">
                    {t(exampleFarbe)}
                  </p>
                </div>

                {/* SCHLAG */}
                <div className="mt-5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                    {t("Schlag")}
                  </label>

                  <div className="mt-2 grid grid-cols-4 gap-2">
                    {ranks.map((rank) => {
                      const selected = exampleSchlag === rank;

                      return (
                        <button
                          key={rank}
                          type="button"
                          onClick={() => setExampleSchlag(rank)}
                          className={`
                            rounded-lg border
                            px-2 py-2
                            text-[11px] font-bold
                            transition
                            ${
                              selected
                                ? "border-amber-400 bg-amber-400 text-amber-950"
                                : "border-white/10 bg-white/5 text-zinc-300 hover:border-white/25"
                            }
                          `}
                        >
                          {t(rank)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* PRIORITY */}
              <div className="max-h-[calc(100vh-120px)] overflow-y-auto p-5">
                <div className="mb-5 flex gap-2">
                  <div className="flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5">
                    <img
                      src={suitIcons[exampleFarbe]}
                      alt={gameUi(exampleFarbe)}
                      className="h-5 w-5 object-contain"
                    />

                    <span className="text-xs font-bold text-emerald-300">
                      {t(exampleFarbe)}
                    </span>
                  </div>

                  <div className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1.5 text-xs font-bold text-amber-300">
                    {t(exampleSchlag)}
                  </div>
                </div>

                {/* 1 KRITISCHE */}
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <div className="flex items-center gap-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-400 text-xs font-black text-amber-950">
                      1
                    </span>

                    <div>
                      <h3 className="font-black">{t("Critical cards")}</h3>

                      <p className="text-[10px] text-zinc-500">
                        {t("highest priority")}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4">
                    <PriorityRow
                      cards={priority.kritische}
                      language={language}
                    />
                  </div>

                  <div className="mt-3 flex justify-between text-[9px] font-semibold text-zinc-500">
                    <span>{gameUi("Max")}</span>
                    <span>{gameUi("Belli")}</span>
                    <span>{gameUi("Spitz")}</span>
                  </div>
                </div>

                <CategoryArrow language={language} />

                {/* 2 HAUPTSCHLAG */}
                <div className="rounded-2xl border border-amber-400/20 bg-amber-400/[0.06] p-4">
                  <div className="flex items-center gap-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-400 text-xs font-black text-amber-950">
                      2
                    </span>

                    <div>
                      <h3 className="font-black">{t("Main Schlag")}</h3>

                      <p className="text-[10px] text-zinc-500">
                        {gameUi(l("Farbe + Schlag", "Suit + Schlag"))}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4">
                    {gameUi(priority.hauptschlag.length > 0 ? (
                      <PriorityRow
                        cards={priority.hauptschlag}
                        language={language}
                      />
                    ) : (
                      <p className="rounded-xl bg-black/20 p-3 text-xs leading-5 text-zinc-400">
                        {gameUi(l(
                          "Bei dieser Kombination fällt die entsprechende Karte\n                        bereits unter die Kritischen.",
                          "With this combination, the corresponding card is already a critical card.",
                        ))}
                      </p>
                    ))}
                  </div>
                </div>

                <CategoryArrow language={language} />

                {/* 3 SCHLÄGE */}
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <div className="flex items-center gap-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-700 text-xs font-black">
                      3
                    </span>

                    <div>
                      <h3 className="font-black">{t("Other Schlag cards")}</h3>

                      <p className="text-[10px] text-zinc-500">
                        {t("equal priority")}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4">
                    <PriorityRow
                      cards={priority.schlaege}
                      relation="equal"
                      language={language}
                    />
                  </div>

                  <p className="mt-3 text-[10px] leading-4 text-zinc-500">
                    {gameUi(l(
                      "Bei gleicher Stärke gewinnt die zuerst gespielte Karte.",
                      "If cards have equal strength, the one played first wins.",
                    ))}
                  </p>
                </div>

                <CategoryArrow language={language} />

                {/* 4 TRUMPF */}
                <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.05] p-4">
                  <div className="flex items-center gap-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-400 text-xs font-black text-emerald-950">
                      4
                    </span>

                    <div>
                      <h3 className="font-black">{t("Trump")}</h3>

                      <p className="text-[10px] text-zinc-500">
                        {t("Remaining trump cards")}: {t(exampleFarbe)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4">
                    <PriorityRow cards={priority.trumpf} language={language} />
                  </div>
                </div>

                <CategoryArrow language={language} />

                {/* 5 NORMAL */}
                {/* 5 NORMAL */}
                <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
                  <div className="flex items-center gap-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-800 text-xs font-black text-zinc-300">
                      5
                    </span>

                    <div>
                      <h3 className="font-black">{t("Normal cards")}</h3>

                      <p className="text-[10px] text-zinc-500">
                        {t("Example")}: {t(priority.normalExampleSuit)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4">
                    <PriorityRow
                      cards={priority.normaleKarten}
                      relation="higher"
                      language={language}
                    />
                  </div>

                  <p className="mt-2 text-[10px] leading-4 text-zinc-500">
                    {gameUi(l(
                      "Keine feste Reihenfolge zwischen verschiedenen Farben. Es\n                    zählt die angespielte (zuerst gespielte) Farbe; innerhalb\n                    dieser Farbe: Ass → König → Ober → Unter → 10 → 9 → 8 → 7.",
                      "There is no fixed order between different suits. The led suit matters; within that suit: Ace → King → Ober → Unter → 10 → 9 → 8 → 7.",
                    ))}
                  </p>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
