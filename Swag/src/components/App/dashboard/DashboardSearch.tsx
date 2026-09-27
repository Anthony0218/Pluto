import { useState } from "react";
import { Link } from "react-router-dom";
import { Search } from "lucide-react";
import { games } from "@/data/games";
import { learningResources } from "@/data/navigation";
import { ui, useUiLanguage } from "@/i18n/ui";
import type { Friend } from "@/types/social";
import FriendAvatar from "@/components/social/FriendAvatar";

export default function DashboardSearch({ friends, onChat }: { friends: Friend[]; onChat: (id: string) => void }) {
  useUiLanguage();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const query = search.trim().toLocaleLowerCase();
  const matches = (text: string) => text.toLocaleLowerCase().includes(query);
  const gameResults = games.filter(game => matches(`${game.title} ${ui(game.title)} ${game.description} ${ui(game.description)}`));
  const lessons = learningResources.filter(item => matches(`${item.title} ${ui(item.title)} ${item.description} ${ui(item.description)}`));
  const people = friends.filter(friend => matches(`${friend.username ?? ""} ${friend.display_name ?? ""}`));
  return <div className="dashboard-search" onKeyDown={event => { if (event.key === "Escape") setOpen(false); }} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    <Search size={19} aria-hidden="true" /><input className="dash-input" aria-label={ui("Search games, learning resources and friends")} type="search" value={search} onFocus={() => setOpen(true)} onChange={event => { setSearch(event.target.value); setOpen(true); }} placeholder={ui("Search games, learning resources, friends...")} />
    {open && query && <div className="dashboard-search-results" aria-label={ui("Search results")}>
      {[...gameResults.map(game => ({ ...game, type: "Game" })), ...lessons.map(item => ({ ...item, type: "Learn" }))].map(item => <Link key={item.route} to={item.route} onClick={() => setOpen(false)}><span>{ui(item.title)}</span><small>{ui(item.type)}</small></Link>)}
      {people.map(friend => <button key={friend.id} onClick={() => { onChat(friend.id); setSearch(""); setOpen(false); }}><FriendAvatar profile={friend} size="sm" /><span>{friend.username || friend.display_name || ui("Player")}</span><small>{ui("Chat")}</small></button>)}
      {!gameResults.length && !lessons.length && !people.length && <p className="p-3 text-sm text-slate-400">{ui("No results found.")}</p>}
    </div>}
  </div>;
}
