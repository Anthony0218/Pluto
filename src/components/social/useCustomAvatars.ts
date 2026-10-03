import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { mergeCustomAvatars, readCustomAvatars, writeCustomAvatars } from "./customAvatars";

/** The local collection also works while the gallery migration is being deployed. */
export function useCustomAvatars(userId: string | undefined, currentAvatar: string | null | undefined) {
  const [collection, setCollection] = useState<{ userId: string; avatars: string[] } | null>(null);
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    const local = mergeCustomAvatars([currentAvatar], readCustomAvatars(window.localStorage, userId));
    writeCustomAvatars(window.localStorage, userId, local);
    const timer = window.setTimeout(() => { if (!cancelled) setCollection({ userId, avatars: local }); }, 0);
    void (async () => {
      const { data } = await supabase.from("profile_custom_avatars").select("avatar_id").eq("user_id", userId).order("created_at", { ascending: false });
      if (cancelled) return;
      const avatars = mergeCustomAvatars(readCustomAvatars(window.localStorage, userId), data?.map(row => row.avatar_id), [currentAvatar]);
      writeCustomAvatars(window.localStorage, userId, avatars);
      setCollection({ userId, avatars });
      // Import avatars created before the collection existed, including the current avatar.
      if (avatars.length) await supabase.from("profile_custom_avatars").upsert(avatars.map(avatar_id => ({ user_id: userId, avatar_id })), { onConflict: "user_id,avatar_id", ignoreDuplicates: true });
    })();
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [userId, currentAvatar]);

  async function saveCustomAvatar(avatarId: string) {
    if (!userId) return;
    const avatars = mergeCustomAvatars([avatarId], collection && collection.userId === userId ? collection.avatars : [], readCustomAvatars(window.localStorage, userId));
    writeCustomAvatars(window.localStorage, userId, avatars);
    setCollection({ userId, avatars });
    await supabase.from("profile_custom_avatars").upsert({ user_id: userId, avatar_id: avatarId }, { onConflict: "user_id,avatar_id", ignoreDuplicates: true });
  }

  return { customAvatars: collection && collection.userId === userId ? collection.avatars : [], saveCustomAvatar };
}
