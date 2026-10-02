import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { ui, useUiLanguage } from "@/i18n/ui";
import { markNotificationsSeen } from "@/components/App/notifications/notificationState";
import { ProfileAvatar } from "./ProfileAvatarPicker";
import UserLink from "./UserLink";

type Message = { id: string; group_id: string; sender_id: string; body: string; created_at: string };
type Player = { id: string; username: string | null; display_name: string | null; avatar_id: string | null };

const MAX_LENGTH = 500;

/** Free-text chat for one clan. New messages arrive live and pop up for members elsewhere in the app. */
export default function ClanChat({ clanId, userId, players }: { clanId: string; userId: string; players: Player[] }) {
  useUiLanguage();
  const [messages, setMessages] = useState<Message[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "unavailable">("loading");
  const [draft, setDraft] = useState("");
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

  async function send() {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setError(null);
    const { data, error: sendError } = await supabase.rpc("send_community_group_message", { p_group_id: clanId, p_body: body });
    setSending(false);
    if (sendError) { setError(sendError.message); return; }
    setDraft("");
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
      <form className="mt-3 flex gap-2" onSubmit={(event) => { event.preventDefault(); void send(); }}>
        <input
          aria-label={ui("Message your clan")}
          className="w-full rounded-xl border border-indigo-200/20 bg-slate-950/60 px-4 py-3 text-white outline-none focus:border-teal-300"
          value={draft}
          maxLength={MAX_LENGTH}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={ui("Message your clan")}
        />
        <button disabled={sending || !draft.trim()} className="inline-flex items-center gap-2 rounded-xl bg-teal-400 px-4 py-2.5 text-sm font-black text-teal-950 transition hover:bg-teal-300 disabled:opacity-50"><Send size={16} aria-hidden="true" /><span className="sr-only sm:not-sr-only">{ui("Send")}</span></button>
      </form>
      {error && <p role="alert" className="mt-2 text-sm text-rose-300">{ui(error)}</p>}
    </div>
  );
}
