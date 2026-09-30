import type { User } from "@supabase/supabase-js";
import type { Dispatch, SetStateAction } from "react";

import type { Profile } from "../../context/AuthContext";
import FriendAvatar from "./FriendAvatar";

type ProfileCardProps = {
  profile: Profile | null;
  user: User;

  username: string;
  displayName: string;

  saving: boolean;
  message: string;

  setUsername: Dispatch<SetStateAction<string>>;
  setDisplayName: Dispatch<SetStateAction<string>>;

  onSave: () => void | Promise<void>;
};

export default function ProfileCard({
  profile,
  user,
  username,
  displayName,
  saving,
  message,
  setUsername,
  setDisplayName,
  onSave,
}: ProfileCardProps) {
  return (
    <div className="profile-card">
      <div className="profile-header">
        {profile && <FriendAvatar profile={profile} size="lg" />}

        <div>
          <h1>{profile?.username ?? "Player"}</h1>

          <p>{profile?.display_name ?? user.email}</p>
        </div>
      </div>

      <div className="rating">
        <span>Rating</span>
        <strong>{profile?.rating ?? "—"}</strong>
      </div>

      <div className="stats">
        <div>
          <strong>{profile?.games_played ?? 0}</strong>
          <span>Games</span>
        </div>

        <div>
          <strong>{profile?.wins ?? 0}</strong>
          <span>Wins</span>
        </div>

        <div>
          <strong>{profile?.losses ?? 0}</strong>
          <span>Losses</span>
        </div>

        <div>
          <strong>{profile?.draws ?? 0}</strong>
          <span>Draws</span>
        </div>
      </div>

      <div className="edit-profile">
        <h2>Edit Profile</h2>

        <label>
          Username
          <input
            type="text"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            maxLength={20}
          />
        </label>

        <label>
          Display name
          <input
            type="text"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            maxLength={30}
          />
        </label>

        <button onClick={onSave} disabled={saving}>
          {saving ? "Saving..." : "Save Changes"}
        </button>

        {message && <p>{message}</p>}
      </div>
    </div>
  );
}
