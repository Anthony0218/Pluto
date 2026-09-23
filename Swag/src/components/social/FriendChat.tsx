import { useEffect, useMemo, useRef, useState } from "react";
import { Gamepad2, Send } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import type {
  Friend,
  FriendMessage,
  PresetMessageType,
} from "../../types/social";
import FriendAvatar from "./FriendAvatar";

type FriendChatProps = { friend: Friend };

const PRESET_LABELS: Record<Exclude<PresetMessageType, "game_code">, string> = {
  hey: "Hey",
  play: "You want to play?",
  yes: "Yes",
  no: "No",
};

export default function FriendChat({ friend }: FriendChatProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<FriendMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteGame, setInviteGame] = useState<"chess" | "watten">("chess");
  const [gameCode, setGameCode] = useState("");
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const friendName =
    friend.display_name || (friend.username ? `@${friend.username}` : "Friend");

  const orderedMessages = useMemo(
    () =>
      [...messages].sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      ),
    [messages],
  );

  useEffect(() => {
    if (!user) return;
    let disposed = false;

    async function loadMessages() {
      setLoading(true);
      const { data, error } = await supabase
        .from("friend_messages")
        .select(
          "id,sender_id,receiver_id,message_type,game,game_code,created_at",
        )
        .or(
          `and(sender_id.eq.${user?.id},receiver_id.eq.${friend.id}),and(sender_id.eq.${friend.id},receiver_id.eq.${user?.id})`,
        )
        .order("created_at", { ascending: true });

      if (!disposed) {
        if (error) console.error("Could not load friend messages:", error);
        setMessages((data ?? []) as FriendMessage[]);
        setLoading(false);
      }
    }

    void loadMessages();

    const channel = supabase
      .channel(`friend-chat-${user.id}-${friend.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "friend_messages" },
        (payload) => {
          const message = payload.new as FriendMessage;
          const belongs =
            (message.sender_id === user.id &&
              message.receiver_id === friend.id) ||
            (message.sender_id === friend.id &&
              message.receiver_id === user.id);

          if (!belongs) return;

          setMessages((current) =>
            current.some((item) => item.id === message.id)
              ? current
              : [...current, message],
          );
        },
      )
      .subscribe();

    return () => {
      disposed = true;
      void supabase.removeChannel(channel);
    };
  }, [friend.id, user]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [orderedMessages.length]);

  async function sendPreset(
    messageType: Exclude<PresetMessageType, "game_code">,
  ) {
    if (!user || sending) return;
    setSending(true);

    const { error } = await supabase.from("friend_messages").insert({
      sender_id: user.id,
      receiver_id: friend.id,
      message_type: messageType,
      game: null,
      game_code: null,
    });

    if (error) console.error("Could not send message:", error);
    setSending(false);
  }

  async function sendGameInvite() {
    if (!user || sending) return;
    const normalizedCode = gameCode.trim().toUpperCase().replace(/\s+/g, "");
    if (!/^[A-Z0-9_-]{3,20}$/.test(normalizedCode)) return;

    setSending(true);
    const { error } = await supabase.from("friend_messages").insert({
      sender_id: user.id,
      receiver_id: friend.id,
      message_type: "game_code",
      game: inviteGame,
      game_code: normalizedCode,
    });

    if (!error) {
      setGameCode("");
      setInviteOpen(false);
    } else {
      console.error("Could not send game invite:", error);
    }

    setSending(false);
  }

  function joinInvite(message: FriendMessage) {
    if (!message.game || !message.game_code) return;

    if (message.game === "watten") {
      navigate(`/games/watten/multiplayer/${message.game_code}`);
      return;
    }

    navigate(`/games/chess/classic/multiplayer/${message.game_code}`);
  }

  function renderMessage(message: FriendMessage) {
    if (message.message_type === "game_code") {
      return (
        <div>
          <div className="flex items-center gap-2 font-semibold">
            <Gamepad2 size={16} />
            {message.game === "watten" ? "Watten invite" : "Chess invite"}
          </div>
          <div className="mt-2 font-mono text-lg font-black tracking-widest">
            {message.game_code}
          </div>
          {message.receiver_id === user?.id && (
            <button
              type="button"
              onClick={() => joinInvite(message)}
              className="mt-3 rounded-lg bg-sky-500 px-3 py-2 text-xs font-bold text-white transition hover:bg-sky-400"
            >
              Join game
            </button>
          )}
        </div>
      );
    }

    return PRESET_LABELS[message.message_type];
  }

  return (
    <section className="flex min-h-[640px] flex-col overflow-hidden rounded-3xl border border-white/10 bg-zinc-900/80 shadow-2xl shadow-black/20 backdrop-blur-md">
      <header className="flex items-center gap-3 border-b border-white/10 px-5 py-4">
        <FriendAvatar profile={friend} />
        <div className="min-w-0">
          <h2 className="truncate font-bold text-white">{friendName}</h2>
          {friend.username && (
            <p className="truncate text-xs text-zinc-500">@{friend.username}</p>
          )}
        </div>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto p-5">
        {loading ? (
          <p className="text-sm text-zinc-500">Loading messages...</p>
        ) : orderedMessages.length === 0 ? (
          <div className="flex h-full min-h-56 items-center justify-center text-center">
            <div>
              <p className="font-semibold text-zinc-300">No messages yet</p>
              <p className="mt-1 text-sm text-zinc-500">
                Say Hey or send a game invite.
              </p>
            </div>
          </div>
        ) : (
          orderedMessages.map((message) => {
            const mine = message.sender_id === user?.id;
            return (
              <div
                key={message.id}
                className={`flex ${mine ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm ${
                    mine
                      ? "bg-sky-500 text-white"
                      : "border border-white/10 bg-zinc-800 text-zinc-200"
                  }`}
                >
                  {renderMessage(message)}
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-white/10 p-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <button
            disabled={sending}
            onClick={() => void sendPreset("hey")}
            className="rounded-xl border border-white/10 bg-zinc-800 px-3 py-2.5 text-sm font-semibold text-zinc-200 hover:bg-zinc-700 disabled:opacity-50"
          >
            👋 Hey
          </button>
          <button
            disabled={sending}
            onClick={() => void sendPreset("play")}
            className="rounded-xl border border-white/10 bg-zinc-800 px-3 py-2.5 text-sm font-semibold text-zinc-200 hover:bg-zinc-700 disabled:opacity-50"
          >
            🎮 Play?
          </button>
          <button
            disabled={sending}
            onClick={() => void sendPreset("yes")}
            className="rounded-xl border border-white/10 bg-zinc-800 px-3 py-2.5 text-sm font-semibold text-zinc-200 hover:bg-zinc-700 disabled:opacity-50"
          >
            ✅ Yes
          </button>
          <button
            disabled={sending}
            onClick={() => void sendPreset("no")}
            className="rounded-xl border border-white/10 bg-zinc-800 px-3 py-2.5 text-sm font-semibold text-zinc-200 hover:bg-zinc-700 disabled:opacity-50"
          >
            ❌ No
          </button>
        </div>

        <button
          type="button"
          onClick={() => setInviteOpen((current) => !current)}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 via-indigo-500 to-fuchsia-500 px-4 py-3 text-sm font-black text-white hover:brightness-110"
        >
          <Send size={16} /> Send game code
        </button>

        {inviteOpen && (
          <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-3">
            <div className="grid gap-2 sm:grid-cols-[140px_1fr_auto]">
              <select
                value={inviteGame}
                onChange={(event) =>
                  setInviteGame(event.target.value as "chess" | "watten")
                }
                className="rounded-xl border border-white/10 bg-zinc-950 px-3 py-2.5 text-sm text-white outline-none"
              >
                <option value="chess">Chess</option>
                <option value="watten">Watten</option>
              </select>

              <input
                value={gameCode}
                onChange={(event) =>
                  setGameCode(event.target.value.toUpperCase())
                }
                maxLength={20}
                placeholder="Room code"
                className="rounded-xl border border-white/10 bg-zinc-950 px-3 py-2.5 font-mono text-sm uppercase text-white outline-none focus:border-sky-400/50"
              />

              <button
                type="button"
                disabled={
                  sending ||
                  !/^[A-Z0-9_-]{3,20}$/.test(gameCode.trim().toUpperCase())
                }
                onClick={() => void sendGameInvite()}
                className="rounded-xl bg-sky-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-sky-400 disabled:opacity-40"
              >
                Send
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
