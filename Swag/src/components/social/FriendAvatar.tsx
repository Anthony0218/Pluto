import type { PublicProfile } from "../../types/social";

type FriendAvatarProps = {
  profile: Pick<PublicProfile, "display_name" | "username" | "avatar_url">;
  size?: "sm" | "md" | "lg";
};

const sizeClasses = {
  sm: "h-9 w-9 text-xs",
  md: "h-11 w-11 text-sm",
  lg: "h-14 w-14 text-base",
};

export default function FriendAvatar({
  profile,
  size = "md",
}: FriendAvatarProps) {
  const label =
    profile.display_name?.trim() ||
    profile.username?.trim() ||
    "Friend";

  const initial = label.charAt(0).toUpperCase();

  if (profile.avatar_url) {
    return (
      <img
        src={profile.avatar_url}
        alt={`${label} avatar`}
        className={`${sizeClasses[size]} shrink-0 rounded-full border border-white/10 object-cover`}
      />
    );
  }

  return (
    <div
      className={`${sizeClasses[size]} flex shrink-0 items-center justify-center rounded-full border border-sky-400/20 bg-gradient-to-br from-sky-500/30 via-indigo-500/25 to-fuchsia-500/25 font-black text-white`}
      aria-label={`${label} avatar`}
    >
      {initial}
    </div>
  );
}
