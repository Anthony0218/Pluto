import { ui, useUiLanguage } from "@/i18n/ui";
import { ArrowRight, BookOpen, Gamepad2, Target, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import FriendAvatar from "../social/FriendAvatar";

export default function VisitPlutoPreview() {
  useUiLanguage();
  const { user, profile } = useAuth();
  return (
    <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[#080d1d]/90 shadow-2xl shadow-black/50 backdrop-blur-xl">
      <div className="flex items-center gap-3 border-b border-white/10 px-5 py-4">
        {profile ? (
          <FriendAvatar profile={profile} />
        ) : (
          <img src="/pluto-icon.png" alt="" className="h-9 w-9 rounded-xl" />
        )}
        <div>
          <p className="text-sm font-semibold text-white">
            {profile?.username || profile?.display_name || "Pluto"}
          </p>
          <p className="mt-1 text-xs text-zinc-400">
            {user ? ui("Your dashboard") : ui("Your place to play and learn")}
          </p>
        </div>
      </div>
      <div className="p-5 sm:p-6">
        {profile ? (
          <div className="mb-4 grid grid-cols-3 gap-3">
            {[
              ["Games", profile.games_played],
              ["Wins", profile.wins],
              ["Rating", profile.rating],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-xl border border-white/10 bg-white/[0.025] p-3"
              >
                <p className="font-bold text-white">
                  {value?.toLocaleString() ?? "—"}
                </p>
                <p className="mt-1 text-xs text-zinc-400">{ui(label)}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="mb-4 text-sm text-zinc-400">
            {user ? ui("Your profile stats are currently unavailable.") : ui("Log in to keep your profile, game activity and friends together.")}
          </p>
        )}
        <div className="space-y-3">
          {[
            {
              title: "Explore games",
              description: "Find your next game.",
              to: "/games",
              icon: Gamepad2,
            },
            {
              title: "Learn something new",
              description: "Rules and strategies for your next match.",
              to: "/learn",
              icon: BookOpen,
            },
            {
              title: "Daily challenge",
              description: "See today's goal and your progress.",
              to: "/home",
              icon: Target,
            },
            {
              title: "Friends",
              description: "Find friends and open a conversation.",
              to: "/friends",
              icon: Users,
            },
          ].map(({ title, description, to, icon: Icon }) => (
            <Link
              key={title}
              to={to}
              className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.025] p-4 hover:bg-white/5"
            >
              <Icon className="shrink-0 text-indigo-300" size={22} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{ui(title)}</p>
                <p className="mt-1 text-xs text-zinc-400">{ui(description)}</p>
              </div>
              <ArrowRight size={16} className="text-zinc-400" />
            </Link>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between gap-4 border-t border-white/10 px-5 py-4">
        <p className="text-xs text-zinc-400">{ui("Your games, learning and progress.")}</p>
        <Link
          to="/home"
          className="shrink-0 rounded-xl bg-indigo-500 px-4 py-2.5 text-xs font-semibold text-white hover:bg-indigo-400"
        >{ui("Open Pluto")}</Link>
      </div>
    </div>
  );
}
