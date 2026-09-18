import { useState } from "react";
import { Link } from "react-router-dom";

type Language = "en" | "de" | "bar" | "ko" | "ru";

type VariantCard = {
  id: string;
  icon: string;
  title: string;
  subtitle: string;
  description: string;
  tags: string[];
  route?: string;
  available: boolean;
  accent: "red" | "violet" | "amber" | "rose" | "sky" | "emerald" | "zinc";
};

const languageOptions: Array<{ value: Language; label: string }> = [
  { value: "en", label: "English" },
  { value: "de", label: "Deutsch" },
  { value: "bar", label: "Boarisch" },
  { value: "ko", label: "한국어" },
  { value: "ru", label: "Русский" },
];

function getInitialChessLanguage(): Language {
  if (typeof window === "undefined") return "en";

  const stored = window.localStorage.getItem("chess-language");

  return languageOptions.some((option) => option.value === stored)
    ? (stored as Language)
    : "en";
}

const translations: Record<Exclude<Language, "en">, Record<string, string>> = {
  de: {
    "Chess Variants": "Schachvarianten",
    "Different rules. Same board.": "Andere Regeln. Dasselbe Brett.",
    "Seven ways to turn classic chess into something completely different.":
      "Sieben Arten, klassisches Schach in etwas völlig anderes zu verwandeln.",
    "Back to Chess": "Zurück zu Schach",
    Language: "Sprache",
    Available: "Verfügbar",
    "Coming soon": "Demnächst",
    "Play Hotseat": "Hotseat spielen",
    "Three Lives Chess": "Drei-Leben-Schach",
    "Every check hurts": "Jedes Schach tut weh",
    "Both players start with three lives. Every check removes one life; checkmate still wins instantly.":
      "Beide Spieler beginnen mit drei Leben. Jedes Schach kostet ein Leben; Schachmatt gewinnt weiterhin sofort.",
    "3 HP": "3 LP",
    "Check damage": "Schach-Schaden",
    Hotseat: "Hotseat",
    "Mutation Chess": "Mutationsschach",
    "The board changes itself": "Das Brett verändert sich selbst",
    "Every ten plies, a random non-king piece mutates into another piece.":
      "Alle zehn Halbzüge mutiert eine zufällige Nicht-Königsfigur in eine andere Figur.",
    "Random events": "Zufallsereignisse",
    Mutations: "Mutationen",
    "Capitalism Chess": "Kapitalismus-Schach",
    "Chess with an economy": "Schach mit Wirtschaft",
    "Earn coins from captures, checks, castling, bounties and missions, then use them for strategic advantages.":
      "Verdiene Münzen durch Schlagen, Schach, Rochade, Kopfgelder und Missionen und nutze sie für strategische Vorteile.",
    Economy: "Wirtschaft",
    Bounties: "Kopfgelder",
    Missions: "Missionen",
    "King Powers": "Königskräfte",
    "Horror Chess": "Horror-Schach",
    "The board is dangerous": "Das Brett ist gefährlich",
    "Infection, cursed pieces, burning squares and knight-triggered freezing turn the board into a survival game.":
      "Infektion, verfluchte Figuren, brennende Felder und Springer-Frost machen das Brett zum Überlebensspiel.",
    Infection: "Infektion",
    Curses: "Flüche",
    "Hot squares": "Heiße Felder",
    "Knight freeze": "Springer-Frost",
    "Fog of War Chess": "Nebel-des-Krieges-Schach",
    "You cannot see everything": "Du kannst nicht alles sehen",
    "Limited vision combines with randomized legal starting positions to create hidden-information chess.":
      "Begrenzte Sicht wird mit zufälligen legalen Startstellungen zu Schach mit verborgenen Informationen.",
    "Fog of war": "Nebel des Krieges",
    "Random start": "Zufallsstart",
    "Hidden information": "Verborgene Information",
    "Draft Chess": "Draft-Schach",
    "Build your own army": "Stelle deine eigene Armee zusammen",
    "Spend a point budget on your starting army. The king must remain on the back rank.":
      "Stelle mit einem Punktebudget deine Startarmee zusammen. Der König muss auf der Grundreihe bleiben.",
    Budget: "Budget",
    "Custom army": "Eigene Armee",
    "Back-rank king": "König auf Grundreihe",
    "Mirror Chess": "Spiegelschach",
    "Custom but symmetrical": "Individuell, aber symmetrisch",
    "Create a custom legal formation and mirror it for the opponent so both sides begin symmetrically.":
      "Erstelle eine eigene legale Formation und spiegle sie für den Gegner, sodass beide Seiten symmetrisch beginnen.",
    "Custom setup": "Eigene Aufstellung",
    Symmetry: "Symmetrie",
    "Fair start": "Fairer Start",
    "Variant roadmap": "Varianten-Roadmap",
    "We build one rules system at a time, starting with local Hotseat before AI or Multiplayer.":
      "Wir bauen ein Regelsystem nach dem anderen, beginnend mit lokalem Hotseat vor KI oder Multiplayer.",
  },
  bar: {
    "Chess Variants": "Schachvariantn",
    "Different rules. Same board.": "Andere Regeln. S gleiche Brett.",
    "Seven ways to turn classic chess into something completely different.":
      "Sieben Arten, wia aus klassischem Schach wos ganz anders werd.",
    "Back to Chess": "Zruck zum Schach",
    Language: "Sproch",
    Available: "Verfügbar",
    "Coming soon": "Kimmt boid",
    "Play Hotseat": "Hotseat spuin",
    "Three Lives Chess": "Drei-Lebn-Schach",
    "Every check hurts": "Jeds Schach kost a Lebn",
    "Both players start with three lives. Every check removes one life; checkmate still wins instantly.":
      "Beide fangn mit drei Lebn o. Jeds Schach kost a Lebn; Schachmatt gwinnt trotzdem sofort.",
    "3 HP": "3 Lebn",
    "Check damage": "Schach-Schodn",
    Hotseat: "Hotseat",
    "Mutation Chess": "Mutationsschach",
    "The board changes itself": "S Brett verändert si",
    "Every ten plies, a random non-king piece mutates into another piece.":
      "Alle zehn Halbzüg mutiert a zufällige Figur außer'm Kini.",
    "Random events": "Zufallsereignisse",
    Mutations: "Mutationen",
    "Capitalism Chess": "Kapitalismus-Schach",
    "Chess with an economy": "Schach mit Wirtschaft",
    Economy: "Wirtschaft",
    Bounties: "Kopfgelder",
    Missions: "Missionen",
    "King Powers": "Kini-Kräfte",
    "Horror Chess": "Horror-Schach",
    "The board is dangerous": "S Brett is g'fährlich",
    Infection: "Infektion",
    Curses: "Flüach",
    "Hot squares": "Heiße Felder",
    "Knight freeze": "Springa-Frost",
    "Fog of War Chess": "Nebel-Schach",
    "You cannot see everything": "Du siehst ned ois",
    "Fog of war": "Nebel",
    "Random start": "Zufallsstart",
    "Hidden information": "Verborgene Infos",
    "Draft Chess": "Draft-Schach",
    "Build your own army": "Bau da dei eigene Armee",
    Budget: "Budget",
    "Custom army": "Eigene Armee",
    "Back-rank king": "Kini hinten",
    "Mirror Chess": "Spiegelschach",
    "Custom but symmetrical": "Eigen, oba symmetrisch",
    "Custom setup": "Eigene Aufstellung",
    Symmetry: "Symmetrie",
    "Fair start": "Fairer Start",
    "Variant roadmap": "Variantn-Plan",
    "We build one rules system at a time, starting with local Hotseat before AI or Multiplayer.":
      "Mia bauen oane Regelwelt nach da andern, z'erst lokal Hotseat, später KI und Multiplayer.",
  },
  ko: {
    "Chess Variants": "체스 변형",
    "Different rules. Same board.": "다른 규칙. 같은 체스판.",
    "Seven ways to turn classic chess into something completely different.":
      "클래식 체스를 완전히 다른 게임으로 바꾸는 일곱 가지 방식입니다.",
    "Back to Chess": "체스로 돌아가기",
    Language: "언어",
    Available: "사용 가능",
    "Coming soon": "준비 중",
    "Play Hotseat": "핫시트 플레이",
    "Three Lives Chess": "세 목숨 체스",
    "Every check hurts": "체크마다 목숨 감소",
    "Both players start with three lives. Every check removes one life; checkmate still wins instantly.":
      "양쪽 모두 목숨 3개로 시작합니다. 체크를 받을 때마다 목숨 1개가 줄며, 체크메이트는 즉시 승리합니다.",
    "3 HP": "3 HP",
    "Check damage": "체크 피해",
    Hotseat: "핫시트",
    "Mutation Chess": "돌연변이 체스",
    "The board changes itself": "체스판이 스스로 변합니다",
    "Every ten plies, a random non-king piece mutates into another piece.":
      "10수(하프무브)마다 킹이 아닌 무작위 기물 하나가 다른 기물로 변합니다.",
    "Random events": "랜덤 이벤트",
    Mutations: "돌연변이",
    "Capitalism Chess": "자본주의 체스",
    "Chess with an economy": "경제 시스템이 있는 체스",
    "Earn coins from captures, checks, castling, bounties and missions, then use them for strategic advantages.":
      "기물 잡기, 체크, 캐슬링, 현상금, 미션으로 코인을 벌고 전략적 보너스에 사용합니다.",
    Economy: "경제",
    Bounties: "현상금",
    Missions: "미션",
    "King Powers": "킹 능력",
    "Horror Chess": "호러 체스",
    "The board is dangerous": "체스판 자체가 위험합니다",
    "Infection, cursed pieces, burning squares and knight-triggered freezing turn the board into a survival game.":
      "감염, 저주받은 기물, 불타는 칸, 나이트 체크의 동결 효과가 체스를 생존 게임으로 바꿉니다.",
    Infection: "감염",
    Curses: "저주",
    "Hot squares": "위험 칸",
    "Knight freeze": "나이트 동결",
    "Fog of War Chess": "전장의 안개 체스",
    "You cannot see everything": "모든 것을 볼 수 없습니다",
    "Limited vision combines with randomized legal starting positions to create hidden-information chess.":
      "제한된 시야와 무작위 합법 시작 배치를 결합한 정보 비대칭 체스입니다.",
    "Fog of war": "전장의 안개",
    "Random start": "랜덤 시작",
    "Hidden information": "숨겨진 정보",
    "Draft Chess": "드래프트 체스",
    "Build your own army": "직접 군대를 구성합니다",
    "Spend a point budget on your starting army. The king must remain on the back rank.":
      "포인트 예산으로 시작 군대를 구성합니다. 킹은 반드시 마지막 랭크에 있어야 합니다.",
    Budget: "예산",
    "Custom army": "커스텀 군대",
    "Back-rank king": "후방 랭크 킹",
    "Mirror Chess": "미러 체스",
    "Custom but symmetrical": "커스텀이지만 대칭적",
    "Create a custom legal formation and mirror it for the opponent so both sides begin symmetrically.":
      "합법적인 커스텀 배치를 만들면 상대에게 그대로 대칭 복제되어 양쪽이 공정하게 시작합니다.",
    "Custom setup": "커스텀 배치",
    Symmetry: "대칭",
    "Fair start": "공정한 시작",
    "Variant roadmap": "변형 체스 로드맵",
    "We build one rules system at a time, starting with local Hotseat before AI or Multiplayer.":
      "먼저 로컬 핫시트부터 하나씩 규칙 시스템을 만들고, 이후 AI와 멀티플레이로 확장합니다.",
  },
  ru: {
    "Chess Variants": "Варианты шахмат",
    "Different rules. Same board.": "Другие правила. Та же доска.",
    "Seven ways to turn classic chess into something completely different.":
      "Семь способов превратить классические шахматы в совсем другую игру.",
    "Back to Chess": "Назад к шахматам",
    Language: "Язык",
    Available: "Доступно",
    "Coming soon": "Скоро",
    "Play Hotseat": "Играть Hotseat",
    "Three Lives Chess": "Шахматы «Три жизни»",
    "Every check hurts": "Каждый шах отнимает жизнь",
    "Both players start with three lives. Every check removes one life; checkmate still wins instantly.":
      "Оба игрока начинают с тремя жизнями. Каждый шах отнимает одну жизнь; мат всё равно побеждает сразу.",
    "3 HP": "3 HP",
    "Check damage": "Урон шахом",
    Hotseat: "Hotseat",
    "Mutation Chess": "Мутационные шахматы",
    "The board changes itself": "Доска меняется сама",
    "Every ten plies, a random non-king piece mutates into another piece.":
      "Каждые десять полуходов случайная фигура, кроме короля, превращается в другую.",
    "Random events": "Случайные события",
    Mutations: "Мутации",
    "Capitalism Chess": "Капиталистические шахматы",
    "Chess with an economy": "Шахматы с экономикой",
    Economy: "Экономика",
    Bounties: "Награды",
    Missions: "Миссии",
    "King Powers": "Силы короля",
    "Horror Chess": "Хоррор-шахматы",
    "The board is dangerous": "Сама доска опасна",
    Infection: "Инфекция",
    Curses: "Проклятия",
    "Hot squares": "Горячие поля",
    "Knight freeze": "Заморозка конём",
    "Fog of War Chess": "Шахматы с туманом войны",
    "You cannot see everything": "Вы видите не всё",
    "Fog of war": "Туман войны",
    "Random start": "Случайный старт",
    "Hidden information": "Скрытая информация",
    "Draft Chess": "Драфт-шахматы",
    "Build your own army": "Соберите свою армию",
    Budget: "Бюджет",
    "Custom army": "Своя армия",
    "Back-rank king": "Король на задней линии",
    "Mirror Chess": "Зеркальные шахматы",
    "Custom but symmetrical": "Своя расстановка, но симметричная",
    "Custom setup": "Своя расстановка",
    Symmetry: "Симметрия",
    "Fair start": "Честный старт",
    "Variant roadmap": "План вариантов",
    "We build one rules system at a time, starting with local Hotseat before AI or Multiplayer.":
      "Сначала строим локальный Hotseat, затем добавляем ИИ и мультиплеер.",
  },
};

function t(language: Language, key: string): string {
  if (language === "en") return key;

  if (language === "bar") {
    return translations.bar[key] ?? translations.de[key] ?? key;
  }

  return translations[language][key] ?? key;
}

const variants: VariantCard[] = [
  {
    id: "three-lives",
    icon: "♥",
    title: "Three Lives Chess",
    subtitle: "Every check hurts",
    description:
      "Both players start with three lives. Every check removes one life; checkmate still wins instantly.",
    tags: ["3 HP", "Check damage", "Hotseat"],
    route: "/games/chess/variants/three-lives/hotseat",
    available: true,
    accent: "red",
  },
  {
    id: "mutation",
    icon: "🧬",
    title: "Mutation Chess",
    subtitle: "The board changes itself",
    description:
      "Every ten plies, a random non-king piece mutates into another piece.",
    tags: ["Random events", "Mutations", "Hotseat"],
    route: "/games/chess/variants/mutation/hotseat",
    available: true,
    accent: "violet",
  },
  {
    id: "capitalism",
    icon: "🪙",
    title: "Chess Market",
    subtitle: "Every move has a price",
    description:
      "Earn coins through captures, checks, missions and bounties, then spend them on limited Royal Powers.",
    tags: ["Economy", "Bounties", "Missions", "Royal Powers", "Hotseat"],
    route: "/games/chess/variants/chessmarket/hotseat",
    available: true,
    accent: "amber",
  },
  {
    id: "horror",
    icon: "☠",
    title: "Horror Chess",
    subtitle: "The board is dangerous",
    description:
      "Infection, cursed pieces, burning squares and knight-triggered freezing turn the board into a survival game.",
    tags: ["Infection", "Curses", "Hot squares", "Knight freeze"],
    available: false,
    accent: "rose",
  },
  {
    id: "fog-of-war",
    icon: "🌫",
    title: "Fog of War Chess",
    subtitle: "You cannot see everything",
    description:
      "Limited vision combines with randomized legal starting positions to create hidden-information chess.",
    tags: ["Fog of war", "Random start", "Hidden information"],
    available: false,
    accent: "sky",
  },
  {
    id: "draft",
    icon: "⚔",
    title: "Draft Chess",
    subtitle: "Build your own army",
    description:
      "Spend a point budget on your starting army. The king must remain on the back rank.",
    tags: ["Budget", "Custom army", "Back-rank king"],
    available: false,
    accent: "emerald",
  },
  {
    id: "mirror",
    icon: "◈",
    title: "Mirror Chess",
    subtitle: "Custom but symmetrical",
    description:
      "Create a custom legal formation and mirror it for the opponent so both sides begin symmetrically.",
    tags: ["Custom setup", "Symmetry", "Fair start"],
    available: false,
    accent: "zinc",
  },
];

const accentClasses: Record<VariantCard["accent"], string> = {
  red: "border-red-400/20 bg-red-400/[0.05] text-red-300",
  violet: "border-violet-400/20 bg-violet-400/[0.05] text-violet-300",
  amber: "border-amber-400/20 bg-amber-400/[0.05] text-amber-300",
  rose: "border-rose-400/20 bg-rose-400/[0.05] text-rose-300",
  sky: "border-sky-400/20 bg-sky-400/[0.05] text-sky-300",
  emerald: "border-emerald-400/20 bg-emerald-400/[0.05] text-emerald-300",
  zinc: "border-zinc-500/30 bg-zinc-500/[0.06] text-zinc-300",
};

const buttonClasses: Record<VariantCard["accent"], string> = {
  red: "bg-red-300 text-zinc-950 hover:bg-red-200",
  violet: "bg-violet-300 text-zinc-950 hover:bg-violet-200",
  amber: "bg-amber-300 text-zinc-950 hover:bg-amber-200",
  rose: "bg-rose-300 text-zinc-950 hover:bg-rose-200",
  sky: "bg-sky-300 text-zinc-950 hover:bg-sky-200",
  emerald: "bg-emerald-300 text-zinc-950 hover:bg-emerald-200",
  zinc: "bg-zinc-300 text-zinc-950 hover:bg-zinc-200",
};

function LanguageSelector({
  language,
  onChange,
}: {
  language: Language;
  onChange: (language: Language) => void;
}) {
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
      <span className="hidden sm:inline">{t(language, "Language")}</span>

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

function VariantCardView({
  variant,
  language,
  number,
}: {
  variant: VariantCard;
  language: Language;
  number: number;
}) {
  return (
    <article
      className="
        group
        relative
        flex
        min-h-[310px]
        flex-col
        overflow-hidden
        rounded-3xl
        border
        border-white/10
        bg-zinc-900/70
        p-5
        shadow-xl
        shadow-black/20
        backdrop-blur-md
        transition
        duration-300
        hover:-translate-y-1
        hover:border-white/20
        hover:bg-zinc-900
      "
    >
      <div
        className="
          pointer-events-none
          absolute
          -right-12
          -top-12
          h-36
          w-36
          rounded-full
          bg-white/[0.025]
          blur-2xl
        "
      />

      <div className="relative flex items-start justify-between gap-4">
        <div
          className={`
            flex
            h-14
            w-14
            shrink-0
            items-center
            justify-center
            rounded-2xl
            border
            text-3xl
            shadow-inner
            ${accentClasses[variant.accent]}
          `}
        >
          {variant.icon}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black text-zinc-700">
            {String(number).padStart(2, "0")}
          </span>

          <span
            className={`
              rounded-full
              border
              px-2.5
              py-1
              text-[9px]
              font-black
              uppercase
              tracking-widest
              ${
                variant.available
                  ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
                  : "border-white/10 bg-white/5 text-zinc-600"
              }
            `}
          >
            {t(language, variant.available ? "Available" : "Coming soon")}
          </span>
        </div>
      </div>

      <div className="relative mt-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-600">
          {t(language, variant.subtitle)}
        </p>

        <h2 className="mt-1 text-xl font-black tracking-tight text-white">
          {t(language, variant.title)}
        </h2>

        <p className="mt-3 text-sm leading-6 text-zinc-500">
          {t(language, variant.description)}
        </p>
      </div>

      <div className="relative mt-4 flex flex-wrap gap-2">
        {variant.tags.map((tag) => (
          <span
            key={tag}
            className="
              rounded-full
              border
              border-white/10
              bg-black/20
              px-2.5
              py-1
              text-[10px]
              font-bold
              text-zinc-500
            "
          >
            {t(language, tag)}
          </span>
        ))}
      </div>

      <div className="relative mt-auto pt-5">
        {variant.available && variant.route ? (
          <Link
            to={variant.route}
            className={`
              flex
              w-full
              items-center
              justify-center
              gap-2
              rounded-xl
              px-4
              py-3
              text-sm
              font-black
              transition
              ${buttonClasses[variant.accent]}
            `}
          >
            <span>{t(language, "Play Hotseat")}</span>
            <span aria-hidden="true">→</span>
          </Link>
        ) : (
          <button
            type="button"
            disabled
            className="
              w-full
              cursor-not-allowed
              rounded-xl
              border
              border-white/5
              bg-white/[0.025]
              px-4
              py-3
              text-sm
              font-bold
              text-zinc-700
            "
          >
            {t(language, "Coming soon")}
          </button>
        )}
      </div>
    </article>
  );
}

export default function ChessVariantsMenu() {
  const [language, setLanguage] = useState<Language>(getInitialChessLanguage);

  function changeLanguage(nextLanguage: Language) {
    setLanguage(nextLanguage);

    if (typeof window !== "undefined") {
      window.localStorage.setItem("chess-language", nextLanguage);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div
        className="
          pointer-events-none
          fixed
          inset-0
          bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.06),transparent_34%)]
        "
      />

      <div className="relative mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <header
          className="
            mb-7
            flex
            flex-col
            gap-5
            rounded-3xl
            border
            border-white/5
            bg-zinc-900/50
            px-5
            py-5
            shadow-xl
            shadow-black/20
            backdrop-blur-md
            md:flex-row
            md:items-center
            md:justify-between
          "
        >
          <div className="flex items-center gap-4">
            <div
              className="
                flex
                h-14
                w-14
                shrink-0
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
                  font-black
                  uppercase
                  tracking-[0.28em]
                  text-amber-400
                "
              >
                {t(language, "Different rules. Same board.")}
              </p>

              <h1 className="mt-1 text-3xl font-black tracking-tight text-white">
                {t(language, "Chess Variants")}
              </h1>

              <p className="mt-1 max-w-2xl text-sm text-zinc-500">
                {t(
                  language,
                  "Seven ways to turn classic chess into something completely different.",
                )}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <LanguageSelector language={language} onChange={changeLanguage} />

            <Link
              to="/games/chess"
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
              ← {t(language, "Back to Chess")}
            </Link>
          </div>
        </header>

        <section
          className="
            mb-6
            rounded-3xl
            border
            border-amber-400/10
            bg-amber-400/[0.035]
            px-5
            py-4
          "
        >
          <div className="flex items-start gap-3">
            <span className="mt-0.5 text-xl">♜</span>

            <div>
              <p className="text-sm font-black text-amber-200">
                {t(language, "Variant roadmap")}
              </p>

              <p className="mt-1 text-xs leading-5 text-zinc-500">
                {t(
                  language,
                  "We build one rules system at a time, starting with local Hotseat before AI or Multiplayer.",
                )}
              </p>
            </div>
          </div>
        </section>

        <section
          className="
            grid
            gap-5
            md:grid-cols-2
            xl:grid-cols-3
          "
        >
          {variants.map((variant, index) => (
            <VariantCardView
              key={variant.id}
              variant={variant}
              language={language}
              number={index + 1}
            />
          ))}
        </section>

        <footer className="py-8 text-center text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-800">
          Chess Variants · 7 modes
        </footer>
      </div>
    </main>
  );
}
