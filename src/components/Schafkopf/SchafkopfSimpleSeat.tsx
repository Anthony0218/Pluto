import { gameUi, useGameLanguage } from "../../i18n/gameUi.ts";
export default function SchafkopfSimpleSeat({
  position, name, active, own, cardCount, wonTricks, points, role,
  showPoints, knocked, spritzed, announcement, canShowPreviousTrick, onShownTrickChange,
}: {
  position: "south" | "west" | "north" | "east";
  name: string; active: boolean; own: boolean; cardCount: number; wonTricks: number;
  points: number; role: "Spieler" | "Gegenspieler" | null; showPoints: boolean;
  knocked: boolean; spritzed: boolean; announcement?: string;
  canShowPreviousTrick: boolean; onShownTrickChange: (show: boolean) => void;
}) {
  useGameLanguage();
  return <div className={`sk-simple-seat sk-simple-seat-${position} ${active ? "is-active" : ""}`}>
    <strong>{name}{own && name !== "Du" && <small>{gameUi("Du")}</small>}</strong>
    <span>{gameUi(active ? "Am Zug" : role ?? `${cardCount} Karten`)}</span>
    <div className="sk-simple-seat-details">
      <button type="button" disabled={!canShowPreviousTrick}
        aria-label={gameUi(`Vorherigen Stich von ${name} anzeigen`)}
        onPointerDown={() => onShownTrickChange(true)} onPointerUp={() => onShownTrickChange(false)}
        onPointerCancel={() => onShownTrickChange(false)} onPointerLeave={() => onShownTrickChange(false)}
        onFocus={() => onShownTrickChange(true)} onBlur={() => onShownTrickChange(false)}>
        {gameUi(wonTricks)} {gameUi(wonTricks === 1 ? "Stich" : "Stiche")}
      </button>
      {showPoints && <span>{gameUi(points)}{gameUi(" Augen")}</span>}
    </div>
    {(knocked || spritzed) && <span className="sk-simple-seat-badges">{gameUi(knocked && "Geklopft")}{gameUi(knocked && spritzed && " · ")}{gameUi(spritzed && "Gespritzt")}</span>}
    {announcement && !own && <small className="sk-simple-announcement" title={gameUi(announcement)}>{gameUi(announcement)}</small>}
  </div>;
}
