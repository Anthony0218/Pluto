import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router";
import { useAuth } from "../context/AuthContext";
import "./Profile.css";
import ProfileCard from "../components/ProfileCard";

export default function Profile() {
  const { user, profile, loading, signOut, updateProfile } = useAuth();

  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (profile) {
      setUsername(profile.username);
      setDisplayName(profile.display_name ?? "");
    }
  }, [profile]);

  async function handleSave() {
    if (!username.trim()) {
      setMessage("Username cannot be empty.");
      return;
    }

    setSaving(true);
    setMessage("");

    const { error } = await updateProfile(username.trim(), displayName.trim());

    if (error) {
      setMessage(error.message);
    } else {
      setMessage("Profile updated!");
    }

    setSaving(false);
  }

  if (loading) {
    return (
      <main className="profile-page">
        <p>Loading...</p>
      </main>
    );
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  return (
    <ProfileCard
      profile={profile}
      user={user}
      username={username}
      displayName={displayName}
      saving={saving}
      message={message}
      setUsername={setUsername}
      setDisplayName={setDisplayName}
      onSave={handleSave}
    />
  );
}
