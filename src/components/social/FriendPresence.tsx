import { useState } from "react";
import { Eye } from "lucide-react";
import { ui, useUiLanguage } from "@/i18n/ui";
import { canRequestSpectate, presenceText, type FriendPresence } from "./activity";
import { requestSpectate } from "./notificationActions";

export function FriendPresenceText({ presence, online, className = "" }: { presence?: FriendPresence; online: boolean; className?: string }) {
  useUiLanguage();
  return <span className={`${online ? (presence?.game && presence.mode ? "text-sky-300" : "text-emerald-300") : "text-zinc-500"} ${className}`}>{presenceText(presence, online)}</span>;
}

/** Asks a friend who is in a live chess room to let you watch. */
export function SpectateRequestButton({ friendId, presence, className = "" }: { friendId: string; presence?: FriendPresence; className?: string }) {
  useUiLanguage();
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);
  if (!canRequestSpectate(presence)) return null;
  async function send() {
    setState("sending");
    setError(null);
    const failure = await requestSpectate(friendId);
    if (failure) { setError(failure); setState("idle"); return; }
    setState("sent");
  }
  return <span className={`inline-flex flex-col gap-1 ${className}`}>
    <button
      type="button"
      disabled={state !== "idle"}
      onClick={(event) => { event.stopPropagation(); void send(); }}
      className="inline-flex min-h-8 items-center justify-center gap-1.5 rounded-lg border border-sky-300/40 bg-sky-400/10 px-3 text-xs font-bold text-sky-100 transition hover:bg-sky-400/20 disabled:opacity-60"
    >
      <Eye size={14} aria-hidden="true" />{ui(state === "sent" ? "Request sent" : state === "sending" ? "Sending…" : "Request to spectate")}
    </button>
    {error && <small role="alert" className="text-[11px] text-rose-300">{ui(error)}</small>}
  </span>;
}
