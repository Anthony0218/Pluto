import { Link } from "react-router-dom";
import { Flame } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { games } from "@/data/games";
import { useDashboardData } from "@/hooks/useDashboardData";
import { ui, useUiLanguage } from "@/i18n/ui";
import { useCopy } from "./copy";

/** For signed-in visitors: a greeting, their streak and the games they were last in. Renders nothing for guests. */
export default function ReturningStrip() {
  useUiLanguage();
  const text = useCopy();
  const { user, profile } = useAuth();
  const { activity } = useDashboardData();
  if (!user) return null;
  const name = profile?.display_name?.trim() || profile?.username?.trim() || user.email?.split("@")[0] || ui("Player");
  const recent = (activity?.recent_games ?? []).flatMap(item => {
    const game = games.find(candidate => item.game_route === candidate.route || item.game_route.startsWith(`${candidate.route}/`));
    return game ? [{ route: item.game_route, title: game.title }] : [];
  }).filter((item, index, all) => all.findIndex(other => other.title === item.title) === index).slice(0, 3);
  return <div className="returning-strip">
    <p><strong>{text("welcomeBack").replace("{name}", name)}</strong>{!!activity?.streak && <span><Flame size={14} aria-hidden="true" />{text("streakDays").replace("{days}", String(activity.streak))}</span>}</p>
    {recent.length > 0 && <p className="returning-recent">{text("continueLabel")}{recent.map(item => <Link key={item.route} to={item.route}>{ui(item.title)}</Link>)}</p>}
  </div>;
}
