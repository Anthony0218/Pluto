export type PublicProfile = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  avatar_id?: string | null;
};

export type Friend = PublicProfile;

export type FriendRequest = {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: "pending" | "accepted" | "declined";
  created_at: string;
};

export type PresetMessageType =
  | "hey"
  | "play"
  | "yes"
  | "no"
  | "game_code";

export type FriendMessage = {
  id: string;
  sender_id: string;
  receiver_id: string;
  message_type: PresetMessageType;
  game: "chess" | "watten" | null;
  game_code: string | null;
  game_route?: string | null;
  created_at: string;
};
