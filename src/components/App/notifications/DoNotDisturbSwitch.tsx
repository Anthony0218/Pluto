import { BellOff, BellRing, Shield, ShieldOff } from "lucide-react";
import { ui, useUiLanguage } from "@/i18n/ui";
import { useClanPopupsMuted, useDoNotDisturb } from "./notificationState";

export default function DoNotDisturbSwitch({ userId, className = "" }: { userId?: string; className?: string }) {
  useUiLanguage();
  const [enabled, setEnabled] = useDoNotDisturb(userId);
  const Icon = enabled ? BellOff : BellRing;
  return <button type="button" role="switch" aria-checked={enabled} className={`dnd-switch ${className}`} onClick={() => setEnabled(!enabled)}>
    <span className="dnd-switch-copy">
      <Icon size={18} className={enabled ? "shrink-0 text-violet-300" : "shrink-0 text-slate-400"} aria-hidden="true" />
      <span><strong>{ui("Do not disturb")}</strong><small>{ui(enabled ? "Message and invite pop-ups are muted. They still arrive here." : "Show new messages and game invites in the bottom-right corner.")}</small></span>
    </span>
    <span className="dnd-switch-track" aria-hidden="true" />
  </button>;
}

/** Mutes clan chat and clan lobby pop-ups while friend messages keep arriving. */
export function ClanPopupsSwitch({ userId, className = "" }: { userId?: string; className?: string }) {
  useUiLanguage();
  const [enabled, setEnabled] = useClanPopupsMuted(userId);
  const [doNotDisturb] = useDoNotDisturb(userId);
  const Icon = enabled ? ShieldOff : Shield;
  return <button type="button" role="switch" aria-checked={enabled} disabled={doNotDisturb} className={`dnd-switch ${className}`} onClick={() => setEnabled(!enabled)}>
    <span className="dnd-switch-copy">
      <Icon size={18} className={enabled ? "shrink-0 text-violet-300" : "shrink-0 text-slate-400"} aria-hidden="true" />
      <span><strong>{ui("Only allow non-clan chats")}</strong><small>{ui(doNotDisturb ? "Do not disturb already mutes every pop-up." : enabled ? "Clan messages and clan invites stay quiet. Friend messages still pop up." : "Clan messages and clan invites also pop up in the bottom-right corner.")}</small></span>
    </span>
    <span className="dnd-switch-track" aria-hidden="true" />
  </button>;
}
