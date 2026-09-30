import { groupAvatars } from "./groupAvatarManifest";

export function GroupAvatar({ id, className = "h-16 w-16" }: { id: string; className?: string }) {
  const avatar = groupAvatars.find(item => item.id === id) ?? groupAvatars[0];
  const Icon = avatar.Icon;
  return <span role="img" aria-label={avatar.name} className={`inline-grid shrink-0 place-items-center overflow-hidden rounded-2xl border border-white/30 bg-gradient-to-br shadow-lg ${avatar.colors} ${className}`}>{avatar.image ? <img src={avatar.image} alt="" className="h-full w-full object-cover" /> : <Icon aria-hidden="true" className="h-1/2 w-1/2 text-white drop-shadow-lg" strokeWidth={2.4} />}</span>;
}
