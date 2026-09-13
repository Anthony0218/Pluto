import { useMemo, useState, type ReactNode } from "react";
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
import { useTableTheme, type TableTheme } from "@/context/TableThemeContext";

import {
  createDeck,
  getCriticalValue,
  isCritical,
  isHauptschlag,
  normalRankValue,
  type WattenCard,
} from "@/utils/watten";

import { getWattenCardImage } from "@/utils/WattenCardImages";
import CardThemeSelector from "@/components/WattenCardGameSelector";
import TableThemeSelector from "@/components/TableThemeSelector";

type Tab = "overview" | "rules" | "cards";

type Suit = "Herz" | "Schellen" | "Eichel" | "Gras";

type Rank = "7" | "8" | "9" | "10" | "Unter" | "Ober" | "König" | "Ass";

type DisplayCard = Pick<WattenCard, "suit" | "rank">;

const tableBackgrounds: Record<TableTheme, string> = {
  classic: "/images/tables/classic.webp",
  bavarian: "/images/tables/bavarian.webp",
  royal: "/images/tables/royal.webp",
  steampunk: "/images/tables/steampunk.webp",
  alpine: "/images/tables/alpine.webp",
  midnight: "/images/tables/midnight.webp",
};

const suitIcons: Record<Suit, string> = {
  Herz: "/images/icons/herz.webp",
  Schellen: "/images/icons/schellen.webp",
  Eichel: "/images/icons/eichel.webp",
  Gras: "/images/icons/gras.webp",
};

const suits: Suit[] = ["Herz", "Schellen", "Eichel", "Gras"];

const ranks: Rank[] = ["7", "8", "9", "10", "Unter", "Ober", "König", "Ass"];

const criticalNames: Record<string, string> = {
  "Herz-König": "Max",
  "Schellen-7": "Belli",
  "Eichel-7": "Spitz",
};

function RuleCard({
  card,
  small = false,
}: {
  card: DisplayCard;
  small?: boolean;
}) {
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
        alt={`${card.suit} ${card.rank}`}
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
  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.045] p-6 shadow-xl">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-400/10 text-emerald-300">
          {icon}
        </div>

        <h2 className="text-xl font-black text-white">{title}</h2>
      </div>

      <div className="mt-4 space-y-3 text-sm leading-7 text-zinc-300">
        {children}
      </div>
    </section>
  );
}

function CategoryArrow() {
  return (
    <div className="flex justify-center py-1">
      <div className="flex flex-col items-center text-zinc-600">
        <span className="text-2xl leading-none">↓</span>

        <span className="mt-1 text-[8px] font-bold uppercase tracking-[0.2em]">
          niedriger
        </span>
      </div>
    </div>
  );
}

function PriorityRelation({ type }: { type: "higher" | "equal" }) {
  return (
    <div className="flex min-w-9 flex-col items-center justify-center">
      {type === "higher" ? (
        <>
          <ChevronRight size={27} className="text-amber-300" />

          <span className="mt-1 text-[8px] font-bold uppercase tracking-wider text-zinc-500">
            stärker
          </span>
        </>
      ) : (
        <>
          <CircleEqual size={25} className="text-sky-300" />

          <span className="mt-1 text-[8px] font-bold uppercase tracking-wider text-zinc-500">
            gleich
          </span>
        </>
      )}
    </div>
  );
}

function PriorityRow({
  cards,
  relation = "higher",
}: {
  cards: WattenCard[];
  relation?: "higher" | "equal";
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {cards.map((card, index) => (
        <div key={card.id} className="flex items-center gap-3">
          <div className="flex flex-col items-center gap-1.5">
            <RuleCard card={card} small />

            <span className="max-w-[74px] text-center text-[9px] font-semibold leading-4 text-zinc-400">
              {card.suit} {card.rank}
            </span>
          </div>

          {index < cards.length - 1 && <PriorityRelation type={relation} />}
        </div>
      ))}
    </div>
  );
}

export default function WattenRule() {
  const [activeTab, setActiveTab] = useState<Tab>("overview");

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
      label: "Übersicht",
    },
    {
      id: "rules",
      label: "Regeln",
    },
    {
      id: "cards",
      label: "Karten",
    },
  ];

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-7 text-white md:px-8">
      <div className="mx-auto max-w-[1500px]">
        <div className="ml-10 relative z-[200] mb-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-zinc-900/80 px-5 py-3 shadow-xl backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-400/10">
              🎨
            </div>

            <div>
              <p className="text-sm font-bold text-white">Design</p>

              <p className="text-[11px] text-zinc-500">
                Darstellung der Regeln anpassen
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <CardThemeSelector />
            <TableThemeSelector />
          </div>
        </div>
        {/* HERO */}
        <section
          className="
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
          style={{
            backgroundImage: `url(${tableBackgrounds[tableTheme]})`,
            backgroundPosition: "center",
            backgroundSize: "100% 100%",
          }}
        >
          <div className="absolute inset-0 bg-black/50" />

          <div className="relative z-10 flex h-full items-center px-8 py-10 md:px-12">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/30 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-emerald-300 backdrop-blur">
                <BookOpen size={15} />
                Bayerisches Watten
              </div>

              <h1 className="mt-5 text-4xl font-black md:text-5xl">
                Spielregeln
              </h1>

              <p className="mt-4 max-w-2xl leading-7 text-zinc-200">
                Regeln, Kartenrangfolge und ein interaktives Beispiel für Farbe,
                Schlag und Kartenpriorität.
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
              {tab.label}
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
            {activeTab === "overview" && (
              <div className="grid gap-5 md:grid-cols-2">
                <RulePanel icon={<Target size={22} />} title="Ziel des Spiels">
                  <p>
                    Ziel ist es, eine Runde durch Stiche zu gewinnen und dadurch
                    Punkte für die Gesamtwertung zu erhalten.
                  </p>

                  <p>
                    Eine Runde wird normalerweise über fünf mögliche Stiche
                    entschieden. Wer zuerst die notwendige Mehrheit der Stiche
                    erreicht, gewinnt die Runde.
                  </p>

                  <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4">
                    <strong className="text-emerald-300">Grundidee:</strong>

                    <p className="mt-1">
                      Gute Karten helfen – aber Farbe, Schlag, Kritische und
                      taktische Ansagen bestimmen oft, welche Karte tatsächlich
                      gewinnt.
                    </p>
                  </div>
                </RulePanel>

                <RulePanel icon={<Swords size={22} />} title="Stiche">
                  <p>
                    Jeder Spieler legt pro Stich eine Karte. Anschließend wird
                    bestimmt, welche Karte den Stich gewinnt.
                  </p>

                  <p>Entscheidend ist dabei die Kartenpriorität:</p>

                  <div className="rounded-2xl bg-black/20 p-4 font-semibold">
                    <div>Kritische</div>
                    <div className="pl-3 text-zinc-500">↓</div>

                    <div>Hauptschlag</div>
                    <div className="pl-3 text-zinc-500">↓</div>

                    <div>Schläge</div>
                    <div className="pl-3 text-zinc-500">↓</div>

                    <div>Trumpf / Farbe</div>
                    <div className="pl-3 text-zinc-500">↓</div>

                    <div>Normale Karten</div>
                  </div>

                  <p>
                    Der Gewinner eines Stichs spielt den nächsten Stich aus.
                    Keine feste Reihenfolge zwischen verschiedenen Farben. Es
                    zählt die angespielte (zuerst gespielte) Farbe; innerhalb
                    dieser Farbe: Ass → König → Ober → Unter → 10 → 9 → 8 → 7.
                  </p>
                </RulePanel>
              </div>
            )}

            {/* =====================
                REGELN
            ====================== */}
            {activeTab === "rules" && (
              <div className="space-y-5">
                <RulePanel icon={<ShieldAlert size={22} />} title="Gehen">
                  <p>
                    Eine Runde beginnt in deiner Umsetzung mit einem Wert von{" "}
                    <strong className="text-amber-300">2 Punkten</strong>.
                  </p>

                  <p>
                    Durch „Gehen“ kann eine Seite versuchen, den Rundenwert zu
                    erhöhen.
                  </p>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-center">
                      <div className="text-2xl font-black text-white">2</div>

                      <div className="mt-1 text-xs text-zinc-500">
                        Startwert
                      </div>
                    </div>

                    <div className="rounded-xl border border-amber-400/20 bg-amber-400/10 p-4 text-center">
                      <div className="text-2xl font-black text-amber-300">
                        3
                      </div>

                      <div className="mt-1 text-xs text-zinc-500">
                        erstes Gehen
                      </div>
                    </div>

                    <div className="rounded-xl border border-amber-400/20 bg-amber-400/10 p-4 text-center">
                      <div className="text-2xl font-black text-amber-300">
                        4
                      </div>

                      <div className="mt-1 text-xs text-zinc-500">maximal</div>
                    </div>
                  </div>

                  <p>
                    Die Gegenseite kann den höheren Wert
                    <strong className="text-emerald-300"> halten</strong>. Dann
                    wird um den neuen Wert weitergespielt.
                  </p>

                  <p>
                    Wird nicht gehalten, gewinnt die Seite, die erhöht hat, die
                    Runde zum bisher gültigen Rundenwert.
                  </p>
                </RulePanel>

                <RulePanel icon={<Hand size={22} />} title="Abheben">
                  <p>Vor dem eigentlichen Austeilen wird abgehoben.</p>

                  <p>Der Abheber befindet sich rechts vom Geber.</p>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <p className="font-bold text-white">3 Spieler</p>

                      <p className="mt-2 text-sm text-zinc-400">
                        Eine Karte wird beim Abheben aufgedeckt. Ist sie
                        kritisch, erhält der Abheber die Karte. Bei einer
                        normalen Karte wird das Abheben beendet.
                      </p>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <p className="font-bold text-white">4 Spieler</p>

                      <p className="mt-2 text-sm text-zinc-400">
                        Der Stapel wird an einer gewählten Stelle getrennt.
                        Kritische Karten können beim Aufdecken bereits verteilt
                        werden, bevor die restlichen Karten ausgegeben werden.
                      </p>
                    </div>
                  </div>

                  <p>
                    Danach wird so ausgeteilt, dass jeder Spieler insgesamt fünf
                    Karten besitzt.
                  </p>
                </RulePanel>

                <RulePanel
                  icon={<Sparkles size={22} />}
                  title="Trumpf oder Kritisch"
                >
                  <p>
                    Diese Sonderregel kann im ersten Stich durch den
                    <strong className="text-amber-300"> Hauptschlag</strong>
                    aktiviert werden.
                  </p>

                  <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-5">
                    <p className="font-black text-amber-200">
                      Wird der Hauptschlag ausgespielt:
                    </p>

                    <p className="mt-2 text-amber-100/80">
                      Spieler, die einen Trumpf oder eine Kritische besitzen,
                      müssen eine solche Karte spielen.
                    </p>
                  </div>

                  <p>
                    Besitzt ein Spieler weder Trumpf noch Kritische, darf er
                    frei eine andere Karte wählen.
                  </p>
                </RulePanel>
              </div>
            )}

            {/* =====================
                KARTEN
            ====================== */}
            {activeTab === "cards" && (
              <div className="space-y-5">
                {/* KRITISCHE */}
                <RulePanel icon={<Crown size={22} />} title="Kritische Karten">
                  <p>
                    Die drei Kritischen stehen an der Spitze der
                    Kartenrangfolge.
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
                            {item.name}
                          </span>

                          <span className="text-[10px] text-zinc-500">
                            {item.card.suit} {item.card.rank}
                          </span>
                        </div>

                        {index < array.length - 1 && (
                          <PriorityRelation type="higher" />
                        )}
                      </div>
                    ))}
                  </div>

                  <p>
                    Damit gilt:
                    <strong className="text-white"> Max → Belli → Spitz</strong>
                    .
                  </p>
                </RulePanel>

                {/* HAUPTSCHLAG */}
                <RulePanel icon={<Crown size={22} />} title="Hauptschlag">
                  <p>
                    Der Hauptschlag entsteht aus der Kombination von
                    <strong className="text-emerald-300"> Trumpf </strong> und
                    <strong className="text-amber-300"> Schlag</strong>.
                  </p>

                  <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                    <p className="text-sm text-zinc-400">Beispiel</p>

                    <p className="mt-1 font-bold">
                      Trumpf = Gras
                      <br />
                      Schlag = Ober
                    </p>

                    <p className="mt-3">
                      → <strong className="text-amber-300">Gras Ober</strong>{" "}
                      ist der Hauptschlag.
                    </p>
                  </div>

                  <p>
                    Der Hauptschlag steht unmittelbar unter den Kritischen und
                    über allen gewöhnlichen Schlägen und Trumpfkarten.
                  </p>

                  <p>
                    Im ersten Stich kann der Hauptschlag außerdem die Regel
                    „Trumpf oder Kritisch“ aktivieren.
                  </p>
                </RulePanel>

                {/* SCHLAG */}
                <RulePanel icon={<Layers3 size={22} />} title="Schlag">
                  <p>
                    Der Schlag ist ein bestimmter Kartenrang, zum Beispiel Ober,
                    König oder 9.
                  </p>

                  <p>Alle Karten dieses Rangs werden zu Schlägen.</p>

                  <div className="rounded-2xl border border-sky-400/20 bg-sky-400/10 p-4">
                    <p className="font-bold text-sky-200">Wichtig:</p>

                    <p className="mt-1">
                      Die normalen Schläge besitzen untereinander dieselbe
                      Stärke. Werden zwei gleichwertige Schläge gespielt,
                      gewinnt der zuerst gespielte.
                    </p>
                  </div>
                </RulePanel>

                {/* FARBE */}
                <RulePanel icon={<Sparkles size={22} />} title="Farbe / Trumpf">
                  <p>Die gewählte Farbe ist die Trumpffarbe der Runde.</p>

                  <div className="grid grid-cols-4 gap-3">
                    {suits.map((suit) => (
                      <div
                        key={suit}
                        className="flex flex-col items-center rounded-2xl border border-white/10 bg-white/5 p-3"
                      >
                        <img
                          src={suitIcons[suit]}
                          alt={suit}
                          className="h-12 w-12 object-contain"
                        />

                        <span className="mt-2 text-xs font-bold">{suit}</span>
                      </div>
                    ))}
                  </div>

                  <p>
                    Trumpfkarten stehen unterhalb der Schläge, sind aber stärker
                    als gewöhnliche Karten.
                  </p>
                </RulePanel>

                {/* NORMAL */}
                <RulePanel icon={<Layers3 size={22} />} title="Normale Karten">
                  <p>
                    Normale Karten sind weder Kritische noch Hauptschlag, Schlag
                    oder Trumpf.
                  </p>

                  <div className="rounded-2xl bg-black/20 p-4 text-center font-black tracking-wide text-white">
                    Keine feste Reihenfolge zwischen verschiedenen Farben. Es
                    zählt die angespielte (zuerst gespielte) Farbe; innerhalb
                    dieser Farbe: Ass → König → Ober → Unter → 10 → 9 → 8 → 7.
                  </div>

                  <p>
                    Zwischen verschiedenen normalen Farben besteht keine
                    allgemeine Trumpf-Priorität.
                  </p>
                </RulePanel>
              </div>
            )}
          </div>

          {/* ==========================
              RIGHT SIDEBAR
          =========================== */}
          <aside className="xl:sticky xl:top-6 xl:self-start">
            <div className="overflow-hidden rounded-3xl border border-white/10 bg-zinc-900/95 shadow-2xl">
              {/* CONFIGURATOR */}
              <div className="border-b border-white/10 p-5">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-400">
                  Beispiel konfigurieren
                </p>

                <h2 className="mt-1 text-xl font-black">Kartenrangfolge</h2>

                <p className="mt-2 text-xs leading-5 text-zinc-500">
                  Wähle Trumpf und Schlag. Die Rangfolge darunter wird
                  automatisch angepasst.
                </p>

                {/* FARBE */}
                <div className="mt-6">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                    Farbe / Trumpf
                  </label>

                  <div className="mt-2 grid grid-cols-4 gap-2">
                    {suits.map((suit) => {
                      const selected = exampleFarbe === suit;

                      return (
                        <button
                          key={suit}
                          type="button"
                          onClick={() => setExampleFarbe(suit)}
                          title={suit}
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
                            alt={suit}
                            draggable={false}
                            className="h-10 w-10 object-contain"
                          />
                        </button>
                      );
                    })}
                  </div>

                  <p className="mt-2 text-xs font-semibold text-emerald-300">
                    {exampleFarbe}
                  </p>
                </div>

                {/* SCHLAG */}
                <div className="mt-5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                    Schlag
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
                          {rank}
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
                      alt={exampleFarbe}
                      className="h-5 w-5 object-contain"
                    />

                    <span className="text-xs font-bold text-emerald-300">
                      {exampleFarbe}
                    </span>
                  </div>

                  <div className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1.5 text-xs font-bold text-amber-300">
                    {exampleSchlag}
                  </div>
                </div>

                {/* 1 KRITISCHE */}
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <div className="flex items-center gap-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-400 text-xs font-black text-amber-950">
                      1
                    </span>

                    <div>
                      <h3 className="font-black">Kritische</h3>

                      <p className="text-[10px] text-zinc-500">
                        höchste Priorität
                      </p>
                    </div>
                  </div>

                  <div className="mt-4">
                    <PriorityRow cards={priority.kritische} />
                  </div>

                  <div className="mt-3 flex justify-between text-[9px] font-semibold text-zinc-500">
                    <span>Max</span>
                    <span>Belli</span>
                    <span>Spitz</span>
                  </div>
                </div>

                <CategoryArrow />

                {/* 2 HAUPTSCHLAG */}
                <div className="rounded-2xl border border-amber-400/20 bg-amber-400/[0.06] p-4">
                  <div className="flex items-center gap-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-400 text-xs font-black text-amber-950">
                      2
                    </span>

                    <div>
                      <h3 className="font-black">Hauptschlag</h3>

                      <p className="text-[10px] text-zinc-500">
                        Farbe + Schlag
                      </p>
                    </div>
                  </div>

                  <div className="mt-4">
                    {priority.hauptschlag.length > 0 ? (
                      <PriorityRow cards={priority.hauptschlag} />
                    ) : (
                      <p className="rounded-xl bg-black/20 p-3 text-xs leading-5 text-zinc-400">
                        Bei dieser Kombination fällt die entsprechende Karte
                        bereits unter die Kritischen.
                      </p>
                    )}
                  </div>
                </div>

                <CategoryArrow />

                {/* 3 SCHLÄGE */}
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <div className="flex items-center gap-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-700 text-xs font-black">
                      3
                    </span>

                    <div>
                      <h3 className="font-black">Schläge</h3>

                      <p className="text-[10px] text-zinc-500">
                        gleiche Priorität
                      </p>
                    </div>
                  </div>

                  <div className="mt-4">
                    <PriorityRow cards={priority.schlaege} relation="equal" />
                  </div>

                  <p className="mt-3 text-[10px] leading-4 text-zinc-500">
                    Bei gleicher Stärke gewinnt die zuerst gespielte Karte.
                  </p>
                </div>

                <CategoryArrow />

                {/* 4 TRUMPF */}
                <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.05] p-4">
                  <div className="flex items-center gap-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-400 text-xs font-black text-emerald-950">
                      4
                    </span>

                    <div>
                      <h3 className="font-black">Trumpf</h3>

                      <p className="text-[10px] text-zinc-500">
                        übrige {exampleFarbe}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4">
                    <PriorityRow cards={priority.trumpf} />
                  </div>
                </div>

                <CategoryArrow />

                {/* 5 NORMAL */}
                {/* 5 NORMAL */}
                <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
                  <div className="flex items-center gap-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-800 text-xs font-black text-zinc-300">
                      5
                    </span>

                    <div>
                      <h3 className="font-black">Normale Karten</h3>

                      <p className="text-[10px] text-zinc-500">
                        Beispiel: {priority.normalExampleSuit}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4">
                    <PriorityRow
                      cards={priority.normaleKarten}
                      relation="higher"
                    />
                  </div>

                  <p className="mt-2 text-[10px] leading-4 text-zinc-500">
                    Keine feste Reihenfolge zwischen verschiedenen Farben. Es
                    zählt die angespielte (zuerst gespielte) Farbe; innerhalb
                    dieser Farbe: Ass → König → Ober → Unter → 10 → 9 → 8 → 7.
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
