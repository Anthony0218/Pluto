import { gameUi, useGameLanguage } from "../../../i18n/gameUi.ts";
import type { ReactNode, SVGProps } from "react";

/*
 * Chess Custom icon set. One 24×24 grid, 1.75 strokes, round joins and
 * `currentColor`, drawn from chess motifs (rook battlements, knight curves,
 * bishop cuts, crowns, boards) so every icon reads at 16–32px and follows the
 * theme. Icons are decorative by default; pass `title` when an icon is the
 * only label of a control.
 */

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, "children"> {
  size?: number;
  title?: string;
}

export type ChessIcon = (props: IconProps) => React.JSX.Element;

function Svg({ size = 20, title, strokeWidth = 1.75, children, ...rest }: IconProps & { children: ReactNode }) {
  useGameLanguage();
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      {...rest}
    >
      {title && <title>{gameUi(title)}</title>}
      {gameUi(children)}
    </svg>
  );
}

const solid = { fill: "currentColor", stroke: "none" } as const;

/* Shared silhouettes ----------------------------------------------------- */

/** Small rook: battlements, tapered body, flared base. */
const rook = (x: number, y: number, s = 1) => (
  <path
    transform={`translate(${x} ${y}) scale(${s})`}
    d="M-4.5 0V-4h2v1.5H-1V-4h2v1.5h1.5V-4h2v4zM-3.5 0l-.5 6.5h8L3.5 0M-5.5 9h11l-.6-2.5h-9.8z"
  />
);

/** Pawn: round head, flared skirt, base line. */
const pawn = (x: number, y: number, s = 1, filled = false) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <circle cx="0" cy="-5" r="2.25" {...(filled ? solid : {})} />
    <path d="M-3.5 4c0-3 1.2-5.2 3.5-6.6C2.3-1.2 3.5 1 3.5 4z" {...(filled ? solid : {})} />
    <path d="M-4.75 4h9.5" />
  </g>
);

/** King: cross, crown cap, body, base. */
const king = (x: number, y: number, s = 1, filled = false) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <path d="M0-9.5v3.5M-1.6-8h3.2" />
    <path d="M-3.2-2.5c-.2-2 1.2-3.6 3.2-3.6s3.4 1.6 3.2 3.6zM-2.6-2.5 -3.3 4h6.6l-.7-6.5" {...(filled ? { fill: "currentColor" } : {})} />
    <path d="M-4.5 6.5h9l-.6-2.5h-7.8z" {...(filled ? { fill: "currentColor" } : {})} />
  </g>
);

/* Areas ------------------------------------------------------------------- */

/** My Games: a rook on the front card of a small library stack. */
export const MyGamesIcon: ChessIcon = (props) => (
  <Svg {...props}>
    <path d="M8 4.5h10a2 2 0 0 1 2 2v10.5" />
    <rect x="4" y="7.5" width="13" height="13.5" rx="2" />
    {gameUi(rook(10.5, 14, 0.62))}
  </Svg>
);

/** Create: a knight being drawn by a pen. */
export const CreateIcon: ChessIcon = (props) => (
  <Svg {...props}>
    <path d="M3.5 20.5h9.5M12.6 20.5c.4-3.4.6-7-.4-9.8C11.3 8 10 6 8.6 3.3L7.6 5.2C6.2 5.8 5 7.2 3.8 9.6c-.4.8-.1 1.7.7 2.1.6.3 1.3.2 1.8-.2L8 10.3c-.4 2.2-1.4 4-2.3 5.6-.6 1.2-.9 2.8-.9 4.6" />
    <circle cx="7.6" cy="7.4" r=".9" {...solid} />
    <path d="m15.6 13.4 5-5a1.4 1.4 0 0 0-2-2l-5 5-.5 2.5z" />
  </Svg>
);

/** Community: three different pieces standing together. */
export const CommunityIcon: ChessIcon = (props) => (
  <Svg {...props}>
    {gameUi(pawn(5.2, 15.8, 0.72))}
    {gameUi(pawn(18.8, 15.8, 0.72))}
    {gameUi(pawn(12, 14.5, 1, true))}
  </Svg>
);

/* Actions ------------------------------------------------------------------ */

/** Play: a pawn whose body is the play triangle. */
export const PlayIcon: ChessIcon = (props) => (
  <Svg {...props}>
    <circle cx="10" cy="5.5" r="2.4" />
    <path d="M8 10v10l9-5z" fill="currentColor" />
  </Svg>
);

/** Edit: a bishop mitre with a geometric pencil mark. */
export const EditIcon: ChessIcon = (props) => (
  <Svg {...props}>
    <path d="M8 3.8c2.3 1.8 3.6 4 3.6 6.2 0 1.9-1.5 3.3-3.6 3.3S4.4 11.9 4.4 10c0-2.2 1.3-4.4 3.6-6.2zM9.3 7.6 7.6 9.7M4 20.5h8M5.6 13.3l-.8 7.2M10.4 13.3l.8 7.2" />
    <path d="M14.2 20.4l.6-2.6 5.4-5.4a1.35 1.35 0 0 1 1.9 1.9l-5.4 5.4z" />
  </Svg>
);

/** Share: a queen's crown sending out connection lines. */
export const ShareIcon: ChessIcon = (props) => (
  <Svg {...props}>
    <path d="M3.5 20.5h10M4.2 17.7l-.9-6.2 3 2.2 2.2-4 2.2 4 3-2.2-.9 6.2z" />
    <path d="M8.5 9.7 15.3 5.9M12.2 13.2l3.7 1.2" strokeDasharray="0" />
    <circle cx="17.5" cy="4.8" r="2" />
    <circle cx="18.3" cy="15.1" r="2" />
  </Svg>
);

/** Delete: a rook struck through. */
export const DeleteIcon: ChessIcon = (props) => (
  <Svg {...props}>
    {gameUi(rook(12, 9, 0.95))}
    <path d="M4 3.5 20 20.5" />
  </Svg>
);

/** Remix: a branch splitting from one line into two. */
export const RemixIcon: ChessIcon = (props) => (
  <Svg {...props}>
    <circle cx="6" cy="5" r="2" />
    <circle cx="6" cy="19" r="2" />
    <path d="M6 7v10M18 11c0 4.2-5.3 3.2-10.6 6.6" />
    <path d="M18 3.5l2.6 2.6-2.6 2.6-2.6-2.6z" />
    <path d="M18 8.7V11" />
  </Svg>
);

/** View: an eye with a bishop-cut diamond pupil. */
export const ViewIcon: ChessIcon = (props) => (
  <Svg {...props}>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
    <path d="M12 9l3 3-3 3-3-3z" />
  </Svg>
);

export const SaveIcon: ChessIcon = (props) => (
  <Svg {...props}>
    <path d="M5 3.5h11l3.5 3.5v13.5H5z" />
    <path d="M8.5 3.5v5h7v-5M8.5 20.5v-6h8v6" />
  </Svg>
);

/** Save as / duplicate: a second card with a plus. */
export const DuplicateIcon: ChessIcon = (props) => (
  <Svg {...props}>
    <rect x="8.5" y="8.5" width="12" height="12" rx="2" />
    <path d="M15.5 8.5V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7.5a2 2 0 0 0 2 2h2.5M14.5 11.5v6M11.5 14.5h6" />
  </Svg>
);

export const UndoIcon: ChessIcon = (props) => (
  <Svg {...props}>
    <path d="M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
  </Svg>
);

export const RedoIcon: ChessIcon = (props) => (
  <Svg {...props}>
    <path d="m15 14 5-5-5-5M20 9H9.5a5.5 5.5 0 0 0 0 11H13" />
  </Svg>
);

/** Previous / Next: knight-move L arrows. */
export const PreviousIcon: ChessIcon = (props) => (
  <Svg {...props}>
    <path d="M19.5 7.5v5.5H5.5M9 9.5 5.5 13 9 16.5" />
  </Svg>
);

export const NextIcon: ChessIcon = (props) => (
  <Svg {...props}>
    <path d="M4.5 7.5v5.5h14M15 9.5l3.5 3.5-3.5 3.5" />
  </Svg>
);

/** Help: a question mark inside an octagonal piece base. */
export const HelpIcon: ChessIcon = (props) => (
  <Svg {...props}>
    <path d="M8.3 3h7.4L21 8.3v7.4L15.7 21H8.3L3 15.7V8.3z" />
    <path d="M9.6 9.6a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1.1.9-1.1 1.6v.5" />
    <circle cx="12" cy="17" r="1.1" {...solid} />
  </Svg>
);

/** More actions: three board tiles. */
export const MoreIcon: ChessIcon = (props) => (
  <Svg {...props}>
    <path d="M5 10.5 6.5 12 5 13.5 3.5 12zM12 10.5l1.5 1.5-1.5 1.5-1.5-1.5zM19 10.5l1.5 1.5-1.5 1.5-1.5-1.5z" {...solid} />
  </Svg>
);

export const CloseIcon: ChessIcon = (props) => (
  <Svg {...props}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Svg>
);

export const PlusIcon: ChessIcon = (props) => (
  <Svg {...props}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);

export const CheckIcon: ChessIcon = (props) => (
  <Svg {...props}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </Svg>
);

export const SearchIcon: ChessIcon = (props) => (
  <Svg {...props}>
    <circle cx="10.5" cy="10.5" r="6" />
    <path d="m15 15 5 5" />
  </Svg>
);

export const ChevronUpIcon: ChessIcon = (props) => (
  <Svg {...props}>
    <path d="m6 15 6-6 6 6" />
  </Svg>
);

export const ChevronDownIcon: ChessIcon = (props) => (
  <Svg {...props}>
    <path d="m6 9 6 6 6-6" />
  </Svg>
);

export const RefreshIcon: ChessIcon = (props) => (
  <Svg {...props}>
    <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 4v4.5H15" />
  </Svg>
);

export const ImportIcon: ChessIcon = (props) => (
  <Svg {...props}>
    <path d="M4 15v3.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V15M12 15V4M8 11l4 4 4-4" />
  </Svg>
);

export const ExportIcon: ChessIcon = (props) => (
  <Svg {...props}>
    <path d="M4 15v3.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V15M12 15V4M8 8l4-4 4 4" />
  </Svg>
);

export const CloudIcon: ChessIcon = (props) => (
  <Svg {...props}>
    <path d="M7 18.5a4.5 4.5 0 0 1-.6-9 6 6 0 0 1 11.5 1.6A3.75 3.75 0 0 1 17.25 18.5z" />
  </Svg>
);

export const DeviceIcon: ChessIcon = (props) => (
  <Svg {...props}>
    <rect x="3" y="4" width="18" height="12.5" rx="2" />
    <path d="M9 20.5h6M12 16.5v4" />
  </Svg>
);

export const WarningIcon: ChessIcon = (props) => (
  <Svg {...props}>
    <path d="M12 3.5 21.5 20h-19z" />
    <path d="M12 10v4.5" />
    <circle cx="12" cy="17.2" r="1" {...solid} />
  </Svg>
);

/** Private: a padlock whose body carries rook battlements. */
export const PrivateIcon: ChessIcon = (props) => (
  <Svg {...props}>
    <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
    <path d="M5 21v-9.5h2.5V13H10v-1.5h4V13h2.5v-1.5H19V21z" />
  </Svg>
);

/** Public: a crown broadcasting outwards. */
export const PublicIcon: ChessIcon = (props) => (
  <Svg {...props}>
    <path d="M8.5 17.5h7M8.9 15.3l-.6-5 2 1.5L12 8.5l1.7 3.3 2-1.5-.6 5z" />
    <path d="M5.2 7.8a8 8 0 0 0 0 9.4M18.8 7.8a8 8 0 0 1 0 9.4M2.6 5.4a12 12 0 0 0 0 14.2M21.4 5.4a12 12 0 0 1 0 14.2" />
  </Svg>
);

export const LayersIcon: ChessIcon = (props) => (
  <Svg {...props}>
    <path d="m12 3.5 9 4.5-9 4.5L3 8z" />
    <path d="m3 12.25 9 4.5 9-4.5M3 16.5 12 21l9-4.5" />
  </Svg>
);

/* Create steps --------------------------------------------------------------- */

/** Overview: a dashboard with a small checkered tile. */
export const OverviewIcon: ChessIcon = (props) => (
  <Svg {...props}>
    <rect x="3.5" y="4" width="17" height="16" rx="2" />
    <rect x="6.5" y="7" width="5" height="5" />
    <path d="M6.5 7H9v2.5H6.5zM9 9.5h2.5V12H9z" {...solid} />
    <path d="M14.5 8h3M14.5 11h3M6.5 16h11" />
  </Svg>
);

/** Board: an isometric board with grid lines. */
export const BoardIcon: ChessIcon = (props) => (
  <Svg {...props}>
    <path d="m12 3.5 9 5-9 5-9-5z" />
    <path d="m7.5 6 9 5M16.5 6l-9 5" />
    <path d="M3 8.5V12l9 5 9-5V8.5" />
  </Svg>
);

/** Teams: two pawns, one light and one dark. */
export const TeamsIcon: ChessIcon = (props) => (
  <Svg {...props}>
    {gameUi(pawn(7.5, 15, 0.92))}
    {gameUi(pawn(16.5, 15, 0.92, true))}
  </Svg>
);

/** Pieces: pawn, king and rook side by side. */
export const PiecesIcon: ChessIcon = (props) => (
  <Svg {...props}>
    {gameUi(pawn(4.8, 16.3, 0.68))}
    {gameUi(king(12, 13, 0.86, true))}
    {gameUi(rook(19.2, 13.8, 0.62))}
  </Svg>
);

/** Rules: a rule card topped with battlements. */
export const RulesIcon: ChessIcon = (props) => (
  <Svg {...props}>
    <rect x="4.5" y="3" width="15" height="18" rx="2" />
    <path d="m8.6 10.5-.5-3.8 2 1.4L12 5.4l1.9 2.7 2-1.4-.5 3.8z" />
    <path d="M8 14h8M8 17.5h5" />
  </Svg>
);

/** Events: a pawn sending out trigger ripples. */
export const EventsIcon: ChessIcon = (props) => (
  <Svg {...props}>
    {gameUi(pawn(12, 14.2, 0.85, true))}
    <path d="M6.3 7.5a7.5 7.5 0 0 0 0 9.2M17.7 7.5a7.5 7.5 0 0 1 0 9.2M3.4 5.2a11.5 11.5 0 0 0 0 13.8M20.6 5.2a11.5 11.5 0 0 1 0 13.8" />
  </Svg>
);

/** Victory: a crown inside a target. */
export const VictoryIcon: ChessIcon = (props) => (
  <Svg {...props}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3" />
    <path d="M8.6 15.2 8 10.4l2.4 1.8L12 9l1.6 3.2 2.4-1.8-.6 4.8z" fill="currentColor" />
  </Svg>
);

/** Position: a board with the starting tile highlighted. */
export const PositionIcon: ChessIcon = (props) => (
  <Svg {...props}>
    <rect x="3.5" y="3.5" width="17" height="17" rx="2" />
    <path d="M9.2 3.5v17M14.8 3.5v17M3.5 9.2h17M3.5 14.8h17" />
    <path d="M3.5 14.8h5.7v5.7H5.5a2 2 0 0 1-2-2z" {...solid} />
  </Svg>
);

/** Simulation: a piece inside a camera orbit. */
export const SimulationIcon: ChessIcon = (props) => (
  <Svg {...props}>
    {gameUi(pawn(12, 13, 0.82))}
    <ellipse cx="12" cy="15" rx="9.5" ry="3.6" transform="rotate(-12 12 15)" strokeDasharray="2.2 2.2" />
    <circle cx="20.4" cy="11.6" r="1.6" {...solid} />
  </Svg>
);

/** Settings: sliders with diamond (bishop-cut) knobs. */
export const SettingsIcon: ChessIcon = (props) => (
  <Svg {...props}>
    <path d="M4 7h3M11 7h9M4 12h9M17 12h3M4 17h1M9 17h11" />
    <path d="m9 5 2 2-2 2-2-2zM15 10l2 2-2 2-2-2zM7 15l2 2-2 2-2-2z" />
  </Svg>
);

/* Play modes (also used at 32–48px) ------------------------------------------ */

/** Singleplayer: a king facing an abstract, mechanical opponent. */
export const SingleplayerIcon: ChessIcon = (props) => (
  <Svg {...props}>
    {gameUi(king(6.5, 12.5, 0.9))}
    <path d="M17.5 4.2 20.6 6v3.6l-3.1 1.8-3.1-1.8V6z" />
    <path d="M16 7.8h3" />
    <path d="M15.2 20.5 16 13.6h3l.8 6.9M13.7 20.5h7.6" />
    <path d="M11.2 12h1.6" strokeDasharray="0.1 2" />
  </Svg>
);

/** Multiplayer: two opposing pieces linked across a distance. */
export const MultiplayerIcon: ChessIcon = (props) => (
  <Svg {...props}>
    {gameUi(pawn(5.5, 15.5, 0.85))}
    {gameUi(pawn(18.5, 15.5, 0.85, true))}
    <path d="M7.5 7.2C9.5 4.2 14.5 4.2 16.5 7.2" strokeDasharray="1.6 2" />
    <circle cx="12" cy="4.9" r="1" {...solid} />
  </Svg>
);

/** Hotseat: two kings facing each other on one board. */
export const HotseatIcon: ChessIcon = (props) => (
  <Svg {...props}>
    {gameUi(king(6.8, 11.5, 0.82))}
    {gameUi(king(17.2, 11.5, 0.82, true))}
    <path d="M2 19.5h20M3.5 22h17" />
    <path d="M6 19.5 5.2 22M10 19.5l-.3 2.5M14 19.5l.3 2.5M18 19.5l.8 2.5" />
  </Svg>
);
