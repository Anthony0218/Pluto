import { ui, useUiLanguage } from "@/i18n/ui";
import { useEffect, useMemo, useRef, useState } from "react";
import { Gamepad2, Send } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import { variants } from "@/data/chessVariants";
import type {
  Friend,
  FriendMessage,
  PresetMessageType,
} from "../../types/social";
import FriendAvatar from "./FriendAvatar";

type FriendChatProps = { friend: Friend; roomInvite?: { code: string; lobbyRoute: string } };

const PRESET_LABELS: Record<Exclude<PresetMessageType, "game_code">, string> = {
  hey: "Hey",
  play: "You want to play?",
  yes: "Yes",
  no: "No",
};

export default function FriendChat({ friend, roomInvite }: FriendChatProps) {
  useUiLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<FriendMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [inviteSent, setInviteSent] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteGame, setInviteGame] = useState<"chess" | "watten">("chess");
  const [gameCode, setGameCode] = useState(roomInvite?.code ?? "");
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
          "id,sender_id,receiver_id,message_type,game,game_code,game_route,created_at",
        )
        .or(
          `and(sender_id.eq.${user?.id},receiver_id.eq.${friend.id}),and(sender_id.eq.${friend.id},receiver_id.eq.${user?.id})`,
        )
        .order("created_at", { ascending: true });

      if (!disposed) {
        if (error) {
          setErrorMessage(
            "Messages could not be loaded. Please reopen this chat to retry.",
          );
        } else {
          setMessages((current) => [
            ...new Map(
              [...current, ...((data ?? []) as FriendMessage[])].map(
                (message) => [message.id, message],
              ),
            ).values(),
          ]);
        }
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
    const messages = bottomRef.current?.parentElement;
    if (messages) messages.scrollTop = messages.scrollHeight;
  }, [orderedMessages.length]);

  async function sendPreset(
    messageType: Exclude<PresetMessageType, "game_code">,
  ) {
    if (!user || sending) return;
    setSending(true);
    setErrorMessage(null);

    const { data, error } = await supabase
      .from("friend_messages")
      .insert({
        sender_id: user.id,
        receiver_id: friend.id,
        message_type: messageType,
        game: null,
        game_code: null,
      })
      .select("id,sender_id,receiver_id,message_type,game,game_code,game_route,created_at")
      .single();

    if (error) setErrorMessage("Message could not be sent. Please try again.");
    else if (data)
      setMessages((current) =>
        current.some((message) => message.id === data.id)
          ? current
          : [...current, data as FriendMessage],
      );
    setSending(false);
  }

  async function sendGameInvite() {
    if (!user || sending) return;
    const normalizedCode = gameCode.trim().toUpperCase().replace(/\s+/g, "");
    if (!/^[A-Z0-9_-]{3,20}$/.test(normalizedCode)) return;

    setSending(true);
    setErrorMessage(null);
    const { data, error } = await supabase
      .from("friend_messages")
      .insert({
        sender_id: user.id,
        receiver_id: friend.id,
        message_type: "game_code",
        game: inviteGame,
        game_code: normalizedCode,
        game_route: roomInvite?.lobbyRoute ?? null,
      })
      .select("id,sender_id,receiver_id,message_type,game,game_code,game_route,created_at")
      .single();

    if (!error) {
      if (data)
        setMessages((current) =>
          current.some((message) => message.id === data.id)
            ? current
            : [...current, data as FriendMessage],
        );
      setInviteSent(true);
      setGameCode(roomInvite?.code ?? "");
      setInviteOpen(false);
    } else {
      setErrorMessage("Game invite could not be sent. Please try again.");
    }

    setSending(false);
  }

  function joinInvite(message: FriendMessage) {
    if (!message.game || !message.game_code) return;

    if (message.game_route === "/games/atlas-arena/multiplayer" || message.game_route === "/games/eat-it/multiplayer") {
      navigate(`${message.game_route}/${encodeURIComponent(message.game_code)}`);
      return;
    }

    if (message.game_route && /^\/games\/chess\/(?:(?:classic|variants\/[a-z0-9-]+)\/multiplayer|ranked)$/.test(message.game_route)) {
      navigate(`${message.game_route}?code=${encodeURIComponent(message.game_code)}`);
      return;
    }

    if (message.game === "watten") {
      navigate(
        `/games/watten/multiplayer?code=${encodeURIComponent(message.game_code)}`,
      );
      return;
    }

    navigate(
      `/games/chess/classic/multiplayer?code=${encodeURIComponent(message.game_code)}`,
    );
  }

  function renderMessage(message: FriendMessage) {
    if (message.message_type === "game_code") {
      const chessMode = message.game_route === "/games/chess/ranked" ? ui("Ranked Chess")
        : message.game_route?.includes("/variants/") ? ui(variants.find(variant => variant.multiplayerRoute === message.game_route)?.title ?? "Chess variant")
        : ui("Classic Chess");
      return (
        <div>
          <p className="mb-1 text-xs opacity-75">{message.sender_id === user?.id ? `${ui("You invited")} ${friendName}` : `${friendName} ${ui("invited you")}`}</p>
          <div className="flex items-center gap-2 font-semibold">
            <Gamepad2 size={16} />
            {message.game_route === "/games/eat-it/multiplayer" ? ui("Eat It invite") : message.game_route === "/games/atlas-arena/multiplayer" ? ui("Atlas Arena invite") : message.game === "watten" ? ui("Watten invite") : `${ui("Chess invite")} · ${chessMode}`}
          </div>
          <div className="mt-2 font-mono text-lg font-black tracking-widest">
            {message.game_code}
          </div>
          {message.receiver_id === user?.id && (
            <button
              type="button"
              onClick={() => joinInvite(message)}
              className="mt-3 rounded-lg bg-sky-500 px-3 py-2 text-xs font-bold text-white transition hover:bg-sky-400"
            >{ui("Open lobby")}</button>
          )}
        </div>
      );
    }

    return PRESET_LABELS[message.message_type];
  }

  return (
    <section className="flex h-[min(640px,65dvh)] min-h-0 flex-col overflow-hidden rounded-3xl border border-white/10 bg-zinc-900/80 shadow-2xl shadow-black/20 backdrop-blur-md">
      <header className="flex items-center gap-3 border-b border-white/10 px-5 py-4">
        <FriendAvatar profile={friend} />
        <div className="min-w-0">
          <h2 className="truncate font-bold text-white">{friendName}</h2>
          {friend.username && (
            <p className="truncate text-xs text-zinc-500">@{friend.username}</p>
          )}
        </div>
      </header>

      {errorMessage && (
        <p
          role="alert"
          className="border-b border-red-400/20 bg-red-400/10 px-5 py-3 text-sm text-red-200"
        >
          {ui(errorMessage)}
        </p>
      )}
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-5">
        {loading ? (
          <p className="text-sm text-zinc-500">{ui("Loading messages...")}</p>
        ) : orderedMessages.length === 0 ? (
          <div className="flex h-full min-h-56 items-center justify-center text-center">
            <div>
              <p className="font-semibold text-zinc-300">{ui("No messages yet")}</p>
              <p className="mt-1 text-sm text-zinc-500">{ui("Say Hey or send a game invite.")}</p>
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
          >{ui("👋 Hey")}</button>
          <button
            disabled={sending}
            onClick={() => void sendPreset("play")}
            className="rounded-xl border border-white/10 bg-zinc-800 px-3 py-2.5 text-sm font-semibold text-zinc-200 hover:bg-zinc-700 disabled:opacity-50"
          >{ui("🎮 Play?")}</button>
          <button
            disabled={sending}
            onClick={() => void sendPreset("yes")}
            className="rounded-xl border border-white/10 bg-zinc-800 px-3 py-2.5 text-sm font-semibold text-zinc-200 hover:bg-zinc-700 disabled:opacity-50"
          >{ui("✅ Yes")}</button>
          <button
            disabled={sending}
            onClick={() => void sendPreset("no")}
            className="rounded-xl border border-white/10 bg-zinc-800 px-3 py-2.5 text-sm font-semibold text-zinc-200 hover:bg-zinc-700 disabled:opacity-50"
          >{ui("❌ No")}</button>
        </div>

        <button
          type="button"
          disabled={sending}
          onClick={() => roomInvite ? void sendGameInvite() : setInviteOpen((current) => !current)}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 via-indigo-500 to-fuchsia-500 px-4 py-3 text-sm font-black text-white hover:brightness-110"
        >
          <Send size={16} /> {sending ? ui("Sending...") : ui("Send game code")}
        </button>

        {inviteSent && <p role="status" className="mt-2 text-sm text-emerald-300">{ui("Room code sent.")}</p>}
        {inviteOpen && (
          <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-3">
            <div className="grid gap-2 sm:grid-cols-[140px_1fr_auto]">
              <select
                aria-label={ui("Invite game")}
                value={inviteGame}
                onChange={(event) =>
                  setInviteGame(event.target.value as "chess" | "watten")
                }
                className="rounded-xl border border-white/10 bg-zinc-950 px-3 py-2.5 text-sm text-white outline-none"
              >
                <option value="chess">{ui("Chess")}</option>
                <option value="watten">{ui("Watten")}</option>
              </select>

              <input
                aria-label={ui("Room code")}
                value={gameCode}
                onChange={(event) =>
                  setGameCode(event.target.value.toUpperCase())
                }
                maxLength={20}
                placeholder={ui("Room code")}
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
              >{ui("Send")}</button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
