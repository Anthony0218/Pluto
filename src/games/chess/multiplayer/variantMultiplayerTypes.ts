export type MultiplayerVariantId =
  | "randomstart"
  | "complete-chaos"
  | "draft"
  | "roulette"
  | "four-player"
  | "mirror"
  | "three-lives"
  | "mutation"
  | "fog-of-war"
  | "tectonic";

export type TwoPlayerColor = "white" | "black";
export type FourPlayerRoomColor = "red" | "blue" | "yellow" | "green";

export type VariantRoom = {
  id: string;
  code: string;
  host_id: string;
  variant: MultiplayerVariantId;
  max_players: number;
  bot_colors?: FourPlayerRoomColor[];
  status: "waiting" | "playing" | "finished";
  created_at?: string;
};

export type VariantRoomPlayer = {
  room_id: string;
  user_id: string;
  seat: number;
  display_name: string;
  chosen_color: TwoPlayerColor | null;
};

export type FourPlayerVariantRoomPlayer = Omit<
  VariantRoomPlayer,
  "chosen_color"
> & {
  chosen_color: FourPlayerRoomColor | null;
};

export type VariantGameWinner =
  | "white"
  | "black"
  | "red"
  | "blue"
  | "yellow"
  | "green"
  | "draw"
  | null;

export type VariantGame = {
  room_id: string;
  variant: MultiplayerVariantId;
  seed: number | null;
  initial_fen: string | null;
  fen: string | null;
  moves: string[];
  state: Record<string, unknown>;
  state_history?: unknown[];
  status: "waiting" | "playing" | "finished";
  winner: VariantGameWinner;
  end_reason: string | null;
  version: number;
  last_move_from: string | null;
  last_move_to: string | null;

  white_rematch_ready: boolean;
  black_rematch_ready: boolean;
  next_seed: number | null;
  next_initial_fen: string | null;
  next_state?: Record<string, unknown> | null;
  rematch_ready?: string[];

  undo_requested_by: string | null;
  undo_requested_version: number | null;
  undo_previous_fen: string | null;
  undo_previous_last_from: string | null;
  undo_previous_last_to: string | null;
  undo_previous_state?: Record<string, unknown> | null;
  undo_last_requested_by: string | null;
  undo_last_requested_version: number | null;
  undo_votes?: string[];

  last_action_user_id?: string | null;
  last_action_kind?: string | null;
  bot_undo_snapshot?: { user_id: string } | null;
};

export type DraftPrivateSetup = {
  room_id: string;
  user_id: string;
  side: "w" | "b";
  placements: Array<{ square: string; piece: string }>;
  confirmed: boolean;
  updated_at?: string;
};
