import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Check, Gamepad2, MessageCircle, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useDashboardData, type DashboardNotification } from "@/hooks/useDashboardData";
import { ui, useUiLanguage } from "@/i18n/ui";
import FriendAvatar from "@/components/social/FriendAvatar";
import { getInviteDestination, getInviteGameLabel } from "@/components/social/inviteRoute";
import DashboardFriendDialog from "../dashboard/DashboardFriendDialog";
import { markNotificationsSeen, useDoNotDisturb, useSeenNotificationIds } from "./notificationState";

const MAX_VISIBLE = 3;
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
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [mountedAt] = useState(() => Date.now());
  const [baseline, setBaseline] = useState<Set<string> | null>(null);
  const [closed, setClosed] = useState<string[]>([]);
  const [chatFriendId, setChatFriendId] = useState<string | null>(null);

  // Everything already in the inbox when the page opened belongs to the bell, not to toasts.
  if (baseline === null && !loading) setBaseline(new Set(notifications.map(item => item.id)));

  const toasts = baseline ? notifications.filter(item =>
    item.kind === "message"
    && !baseline.has(item.id)
    && !seen.has(item.id)
    && !closed.includes(item.id)
    && Date.parse(item.createdAt) > mountedAt - RECENT_WINDOW_MS
    // An invite to the room you are already in needs no prompt.
    && !(item.gameCode && pathname.toUpperCase().includes(`/${item.gameCode.toUpperCase()}`)),
  ).slice(0, MAX_VISIBLE) : [];
  const chatFriend = friends.find(friend => friend.id === chatFriendId);

  function close(id: string) { setClosed(current => [...current, id]); }
  function accept(item: DashboardNotification) {
    if (!item.gameCode) return;
    markNotificationsSeen(userId, [item.id]);
    navigate(getInviteDestination({ game: item.game, gameCode: item.gameCode, gameRoute: item.gameRoute }, { autoJoin: true }));
  }
  function decline(item: DashboardNotification) { markNotificationsSeen(userId, [item.id]); }
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
function MessageToast({ children, onExpire }: { children: ReactNode; onExpire: () => void }) {
  const [paused, setPaused] = useState(false);
  const expire = useRef(onExpire);
  useEffect(() => { expire.current = onExpire; });
  useEffect(() => {
    if (paused) return;
    const timer = window.setTimeout(() => expire.current(), MESSAGE_TOAST_MS);
    return () => window.clearTimeout(timer);
  }, [paused]);
  return <article className="incoming-toast" onPointerEnter={() => setPaused(true)} onPointerLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>{children}</article>;
}
