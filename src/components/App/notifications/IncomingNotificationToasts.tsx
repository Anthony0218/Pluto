import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Check, Eye, Gamepad2, MessageCircle, Shield, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useDashboardData, type DashboardNotification } from "@/hooks/useDashboardData";
import { ui, useUiLanguage } from "@/i18n/ui";
import FriendAvatar from "@/components/social/FriendAvatar";
import { acceptInviteState, getInviteDestination, getInviteGameLabel } from "@/components/social/inviteRoute";
import { clanRoute, isClanNotification, notificationDestination, notificationRoomCode, respondToClanInvite, respondToSpectateRequest } from "@/components/social/notificationActions";
import { leaveCurrentRoom } from "@/components/social/currentRoom";
import DashboardFriendDialog from "../dashboard/DashboardFriendDialog";
import { markNotificationsSeen, useClanPopupsMuted, useDoNotDisturb, useSeenNotificationIds } from "./notificationState";

const MAX_VISIBLE = 3;
const TOAST_KINDS = new Set<DashboardNotification["kind"]>(["message", "clan_message", "clan_invite", "clan_join_invite", "spectate_request", "spectate_accepted"]);
const MESSAGE_TOAST_MS = 9_000;
// Server and browser clocks can disagree; this only filters out history.
const RECENT_WINDOW_MS = 5 * 60_000;

export default function IncomingNotificationToasts() {
  const { user } = useAuth();
  const [doNotDisturb] = useDoNotDisturb(user?.id);
  if (!user || doNotDisturb) return null;
  // Remounting after Do Not Disturb ends starts a fresh baseline, so muted messages never pop up later.
  return <ToastStack key={user.id} userId={user.id} />;
}

function ToastStack({ userId }: { userId: string }) {
  useUiLanguage();
  const { notifications, friends, onlineIds, loading } = useDashboardData();
  const seen = useSeenNotificationIds(userId);
  const [clanMuted] = useClanPopupsMuted(userId);
  const [actionError, setActionError] = useState<Record<string, string>>({});
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [mountedAt] = useState(() => Date.now());
  const [baseline, setBaseline] = useState<Set<string> | null>(null);
  const [closed, setClosed] = useState<string[]>([]);
  const [chatFriendId, setChatFriendId] = useState<string | null>(null);

  // Everything already in the inbox when the page opened belongs to the bell, not to toasts.
  if (baseline === null && !loading) setBaseline(new Set(notifications.map(item => item.id)));

  const toasts = baseline ? notifications.filter(item =>
    TOAST_KINDS.has(item.kind)
    && !(clanMuted && isClanNotification(item))
    && !baseline.has(item.id)
    && !seen.has(item.id)
    && !closed.includes(item.id)
    && Date.parse(item.createdAt) > mountedAt - RECENT_WINDOW_MS
    // An invite to the room you are already in needs no prompt.
    && !(item.gameCode && pathname.toUpperCase().includes(`/${item.gameCode.toUpperCase()}`))
    // The open clan chat already shows its own messages.
    && !(item.kind === "clan_message" && pathname === "/clans" && new URLSearchParams(window.location.search).get("clan") === item.clanId),
  ).slice(0, MAX_VISIBLE) : [];
  const chatFriend = friends.find(friend => friend.id === chatFriendId);

  function close(id: string) { setClosed(current => [...current, id]); }
  function accept(item: DashboardNotification) {
    if (!item.gameCode) return;
    markNotificationsSeen(userId, [item.id]);
    leaveCurrentRoom(item.gameCode);
    navigate(getInviteDestination({ game: item.game, gameCode: item.gameCode, gameRoute: item.gameRoute }, { autoJoin: true }), { state: acceptInviteState() });
  }
  function decline(item: DashboardNotification) { markNotificationsSeen(userId, [item.id]); }
  function open(item: DashboardNotification) {
    markNotificationsSeen(userId, [item.id]);
    const roomCode = notificationRoomCode(item);
    if (roomCode) leaveCurrentRoom(roomCode);
    navigate(notificationDestination(item), { state: acceptInviteState() });
  }
  async function answerSpectate(item: DashboardNotification, accept: boolean) {
    if (!item.spectateRequestId) return;
    const error = await respondToSpectateRequest(item.spectateRequestId, accept);
    if (error && accept) { setActionError(current => ({ ...current, [item.id]: error })); return; }
    markNotificationsSeen(userId, [item.id]);
  }
  async function answerClanInvite(item: DashboardNotification, accept: boolean) {
    if (!item.clanInviteId) return;
    const error = await respondToClanInvite(item.clanInviteId, accept);
    if (error && accept) { setActionError(current => ({ ...current, [item.id]: error })); return; }
    markNotificationsSeen(userId, [item.id]);
    close(item.id);
    if (accept) navigate(clanRoute(item.clanId));
  }
  function openChat(item: DashboardNotification) {
    markNotificationsSeen(userId, [item.id]);
    if (item.senderId && friends.some(friend => friend.id === item.senderId)) setChatFriendId(item.senderId);
    else navigate(`/friends${item.senderId ? `?friend=${encodeURIComponent(item.senderId)}` : ""}`);
  }

  return <>
    <section className="incoming-toasts" aria-label={ui("Notifications")} aria-live="polite">
      {toasts.map(item => {
        const sender = friends.find(friend => friend.id === item.senderId);
        const name = item.senderName || ui("A friend");
        if (item.kind === "clan_message") return <MessageToast key={item.id} className="is-clan" onExpire={() => close(item.id)}>
          <ToastAvatar sender={sender} />
          <div className="incoming-toast-copy">
            <p className="incoming-toast-eyebrow"><Shield size={12} aria-hidden="true" />{ui("Clan")}{item.clanName ? ` · ${item.clanName}` : ""}</p>
            <p className="incoming-toast-title"><strong>{item.senderName || ui("A clan member")}</strong></p>
            <p className="incoming-toast-body">{item.body}</p>
            <div className="incoming-toast-actions">
              <button type="button" className="is-accept" onClick={() => open(item)}><MessageCircle size={15} aria-hidden="true" />{ui("Open clan")}</button>
            </div>
          </div>
          <button type="button" className="incoming-toast-close" aria-label={ui("Close")} onClick={() => close(item.id)}><X size={14} /></button>
        </MessageToast>;
        if (item.kind === "clan_invite") return <article key={item.id} className="incoming-toast is-invite">
          <ToastAvatar sender={sender} invite />
          <div className="incoming-toast-copy">
            <p className="incoming-toast-eyebrow"><Shield size={12} aria-hidden="true" />{ui("Clan game invite")}{item.clanName ? ` · ${item.clanName}` : ""}</p>
            <p className="incoming-toast-title"><strong>{item.senderName || ui("A clan member")}</strong> {ui("shared a lobby")}</p>
            <p className="incoming-toast-detail">{ui(getInviteGameLabel({ game: item.game, gameRoute: item.gameRoute }))} · <span className="font-mono tracking-widest">{item.gameCode}</span></p>
            <div className="incoming-toast-actions">
              <button type="button" className="is-accept" onClick={() => open(item)}><Check size={15} aria-hidden="true" />{ui("Join")}</button>
              <button type="button" onClick={() => decline(item)}><X size={15} aria-hidden="true" />{ui("Decline")}</button>
            </div>
          </div>
        </article>;
        if (item.kind === "clan_join_invite") return <article key={item.id} className="incoming-toast is-invite">
          <ToastAvatar sender={sender} invite />
          <div className="incoming-toast-copy">
            <p className="incoming-toast-eyebrow"><Shield size={12} aria-hidden="true" />{ui("Clan invitation")}</p>
            <p className="incoming-toast-title"><strong>{name}</strong> {ui("invited you to join")} <strong>{item.clanName}</strong></p>
            {actionError[item.id] && <p className="incoming-toast-detail text-rose-300" role="alert">{ui(actionError[item.id])}</p>}
            <div className="incoming-toast-actions">
              <button type="button" className="is-accept" onClick={() => void answerClanInvite(item, true)}><Check size={15} aria-hidden="true" />{ui("Accept")}</button>
              <button type="button" onClick={() => void answerClanInvite(item, false)}><X size={15} aria-hidden="true" />{ui("Decline")}</button>
            </div>
          </div>
        </article>;
        if (item.kind === "spectate_request") return <article key={item.id} className="incoming-toast is-invite">
          <ToastAvatar sender={sender} invite />
          <div className="incoming-toast-copy">
            <p className="incoming-toast-eyebrow"><Eye size={12} aria-hidden="true" />{ui("Spectate request")}</p>
            <p className="incoming-toast-title"><strong>{name}</strong> {ui("wants to watch your game")}</p>
            {actionError[item.id] && <p className="incoming-toast-detail text-rose-300" role="alert">{ui(actionError[item.id])}</p>}
            <div className="incoming-toast-actions">
              <button type="button" className="is-accept" onClick={() => void answerSpectate(item, true)}><Check size={15} aria-hidden="true" />{ui("Allow")}</button>
              <button type="button" onClick={() => void answerSpectate(item, false)}><X size={15} aria-hidden="true" />{ui("Decline")}</button>
            </div>
          </div>
        </article>;
        if (item.kind === "spectate_accepted") return <article key={item.id} className="incoming-toast is-invite">
          <ToastAvatar sender={sender} invite />
          <div className="incoming-toast-copy">
            <p className="incoming-toast-eyebrow"><Eye size={12} aria-hidden="true" />{ui("Spectate request accepted")}</p>
            <p className="incoming-toast-title"><strong>{name}</strong> {ui("lets you watch")}</p>
            <div className="incoming-toast-actions">
              <button type="button" className="is-accept" onClick={() => open(item)}><Eye size={15} aria-hidden="true" />{ui("Watch now")}</button>
              <button type="button" onClick={() => decline(item)}><X size={15} aria-hidden="true" />{ui("Not now")}</button>
            </div>
          </div>
        </article>;
        return item.gameCode
          ? <article key={item.id} className="incoming-toast is-invite">
            <ToastAvatar sender={sender} invite />
            <div className="incoming-toast-copy">
              <p className="incoming-toast-eyebrow"><Gamepad2 size={12} aria-hidden="true" />{ui("Game invite")}</p>
              <p className="incoming-toast-title"><strong>{name}</strong> {ui("invited you")}</p>
              <p className="incoming-toast-detail">{ui(getInviteGameLabel(item))} · <span className="font-mono tracking-widest">{item.gameCode}</span></p>
              <div className="incoming-toast-actions">
                <button type="button" className="is-accept" onClick={() => accept(item)}><Check size={15} aria-hidden="true" />{ui("Accept")}</button>
                <button type="button" onClick={() => decline(item)}><X size={15} aria-hidden="true" />{ui("Decline")}</button>
              </div>
            </div>
          </article>
          : <MessageToast key={item.id} onExpire={() => close(item.id)}>
            <ToastAvatar sender={sender} />
            <div className="incoming-toast-copy">
              <p className="incoming-toast-eyebrow"><MessageCircle size={12} aria-hidden="true" />{ui("New message")}</p>
              <p className="incoming-toast-title"><strong>{name}</strong> {ui("messaged you")}</p>
              <div className="incoming-toast-actions">
                <button type="button" className="is-accept" onClick={() => openChat(item)}><MessageCircle size={15} aria-hidden="true" />{ui("Open chat")}</button>
              </div>
            </div>
            <button type="button" className="incoming-toast-close" aria-label={ui("Close")} onClick={() => close(item.id)}><X size={14} /></button>
          </MessageToast>;
      })}
    </section>
    {chatFriend && <DashboardFriendDialog
      friend={chatFriend}
      online={onlineIds.includes(chatFriend.id)}
      view="chat"
      onViewChange={() => {}}
      onClose={() => setChatFriendId(null)}
    />}
  </>;
}

function ToastAvatar({ sender, invite = false }: { sender?: Parameters<typeof FriendAvatar>[0]["profile"]; invite?: boolean }) {
  return <span className={`incoming-toast-avatar${invite ? " is-invite" : ""}`}>
    {sender ? <FriendAvatar profile={sender} /> : invite ? <Gamepad2 size={20} aria-hidden="true" /> : <MessageCircle size={20} aria-hidden="true" />}
  </span>;
}

/** Plain messages step aside on their own; pausing on hover keeps them readable. */
function MessageToast({ children, onExpire, className = "" }: { children: ReactNode; onExpire: () => void; className?: string }) {
  const [paused, setPaused] = useState(false);
  const expire = useRef(onExpire);
  useEffect(() => { expire.current = onExpire; });
  useEffect(() => {
    if (paused) return;
    const timer = window.setTimeout(() => expire.current(), MESSAGE_TOAST_MS);
    return () => window.clearTimeout(timer);
  }, [paused]);
  return <article className={`incoming-toast ${className}`} onPointerEnter={() => setPaused(true)} onPointerLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>{children}</article>;
}
