import {
  useCallback,
  useRef,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

import { AuthContext, type Profile } from "./authState";
export type { Profile } from "./authState";
// Keep the existing import path for all auth consumers.
// eslint-disable-next-line react-refresh/only-export-components
export { useAuth } from "./authState";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const userId = user?.id;
  const currentUserId = useRef<string | null>(null);

  const loadProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();
    if (currentUserId.current !== userId) return;
    if (error) console.error("Error loading profile:", error);
    setProfile(error ? null : data);
    setLoading(false);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (currentUserId.current) await loadProfile(currentUserId.current);
  }, [loadProfile]);

  useEffect(() => {
    let disposed = false;
    let authEventReceived = false;
    let liveAuthEventReceived = false;
    const applyUser = (next: User | null) => {
      if (disposed) return;
      if (currentUserId.current !== (next?.id ?? null)) {
        setProfile(null);
        setLoading(!!next);
      }
      currentUserId.current = next?.id ?? null;
      setUser(next);
      if (!next) {
        setProfile(null);
        setLoading(false);
      }
    };
    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (!authEventReceived) applyUser(session?.user ?? null);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // INITIAL_SESSION is an async snapshot. A login or logout that arrives
      // first is newer and must not be overwritten by that snapshot.
      if (event === "INITIAL_SESSION" && liveAuthEventReceived) return;
      if (event !== "INITIAL_SESSION") liveAuthEventReceived = true;
      authEventReceived = true;
      applyUser(session?.user ?? null);
    });
    return () => {
      disposed = true;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!userId) return;
    void loadProfile(userId);
    const refresh = () => void loadProfile(userId);
    window.addEventListener("focus", refresh);
    const channel = supabase
      .channel(`own-profile-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${userId}`,
        },
        refresh,
      )
      .subscribe();
    return () => {
      window.removeEventListener("focus", refresh);
      void supabase.removeChannel(channel);
    };
  }, [userId, loadProfile]);

  async function signUp(email: string, password: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    return {
      error: error ? new Error(error.message) : null,
      needsEmailConfirmation: !error && !data.session,
    };
  }

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    return {
      error: error ? new Error(error.message) : null,
    };
  }

  async function updateProfile(username: string, displayName: string) {
    if (!user) {
      return {
        error: new Error("You must be logged in."),
      };
    }

    const { data, error } = await supabase
      .from("profiles")
      .update({
        username,
        display_name: displayName || null,
      })
      .eq("id", user.id)
      .select()
      .single();

    if (error) {
      console.error("Error updating profile:", error);

      return {
        error: new Error(error.message),
      };
    }

    setProfile(data);

    return {
      error: null,
    };
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error("Error signing out:", error);
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        refreshProfile,
        signUp,
        signIn,
        updateProfile,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
