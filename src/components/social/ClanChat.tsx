import { useEffect, useRef, useState } from "react";
import { CHAT_PRESETS } from "./chatPresets";
import { supabase } from "@/lib/supabase";
import { ui, useUiLanguage } from "@/i18n/ui";
import { markNotificationsSeen } from "@/components/App/notifications/notificationState";
import { ProfileAvatar } from "./ProfileAvatarPicker";
import UserLink from "./UserLink";

type Message = { id: string; group_id: string; sender_id: string; body: string; created_at: string };
type Player = { id: string; username: string | null; display_name: string | null; avatar_id: string | null };



/** Preset chat for one clan, shared with friend chat. */
export default function ClanChat({ clanId, userId, players }: { clanId: string; userId: string; players: Player[] }) {
  useUiLanguage();
  const [messages, setMessages] = useState<Message[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "unavailable">("loading");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const list = useRef<HTMLOListElement>(null);
  const [seenClan, setSeenClan] = useState(clanId);
  if (seenClan !== clanId) {
    setSeenClan(clanId);
    setMessages([]);
    setStatus("loading");
  }

  useEffect(() => {
    let active = true;
    const load = async () => {
      const { data, error: loadError } = await supabase
        .from("community_group_messages")
        .select("id,group_id,sender_id,body,created_at")
        .eq("group_id", clanId)
        .order("created_at", { ascending: false })
        .limit(100);
      if (!active) return;
      if (loadError) { setStatus("unavailable"); return; }
      const rows = ((data ?? []) as Message[]).reverse();
      setMessages(rows);
      setStatus("ready");
      // Reading the chat clears its pop-ups and bell entries.
      markNotificationsSeen(userId, rows.map((row) => `clan-message-${row.id}`));
    };
    void load();
    const channel = supabase
      .channel(`clan-chat-${clanId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "community_group_messages", filter: `group_id=eq.${clanId}` }, () => void load())
      .subscribe();
    const timer = window.setInterval(() => void load(), 15_000);
    return () => {
      active = false;
      window.clearInterval(timer);
      void supabase.removeChannel(channel);
    };
  }, [clanId, userId]);

  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight });
  }, [messages.length]);

  async function send(body: string) {
    if (!body || sending) return;
    setSending(true);
    setError(null);
    const { data, error: sendError } = await supabase.rpc("send_community_group_message", { p_group_id: clanId, p_body: body });
    setSending(false);
    if (sendError) { setError(sendError.message); return; }
    setMessages((current) => current.some((row) => row.id === data) ? current : [...current, { id: data as string, group_id: clanId, sender_id: userId, body, created_at: new Date().toISOString() }]);
  }

  const playerById = new Map(players.map((player) => [player.id, player]));

  if (status === "unavailable") return <p className="text-sm text-slate-400">{ui("Clan chat will be available after the database update.")}</p>;

  return (
    <div>
      <ol ref={list} className="max-h-80 min-h-40 space-y-3 overflow-y-auto rounded-2xl border border-white/10 bg-slate-950/40 p-3" aria-live="polite" aria-label={ui("Clan messages")}>
        {status === "loading" && <li className="text-sm text-slate-400">{ui("Loading...")}</li>}
        {status === "ready" && !messages.length && <li className="text-sm text-slate-400">{ui("No messages yet. Say hi to your clan!")}</li>}
        {messages.map((message) => {
          const sender = playerById.get(message.sender_id);
          const own = message.sender_id === userId;
          const name = sender?.username || sender?.display_name || ui("Player");
          return (
            <li key={message.id} className={`flex items-start gap-2 ${own ? "flex-row-reverse text-right" : ""}`}>
              <UserLink userId={message.sender_id} className="shrink-0"><ProfileAvatar avatarId={sender?.avatar_id ?? "m1"} className="h-8 w-8 rounded-full" /></UserLink>
              <div className={`min-w-0 max-w-[80%] rounded-2xl px-3 py-2 ${own ? "bg-teal-500/20" : "bg-white/[.06]"}`}>
                <p className="text-[11px] text-slate-400"><UserLink userId={message.sender_id} className="font-bold text-slate-200">{name}</UserLink> · {new Date(message.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
                <p className="whitespace-pre-wrap break-words text-sm text-white">{message.body}</p>
              </div>
            </li>
          );
        })}
      </ol>
      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label={ui("Preset messages")}>{Object.entries(CHAT_PRESETS).map(([key, label]) => <button key={key} type="button" disabled={sending || status !== "ready"} onClick={() => void send(label)} className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{ui(label)}</button>)}</div>
      {error && <p role="alert" className="mt-2 text-sm text-rose-300">{ui(error)}</p>}
    </div>
  );
}
