import { createContext, useContext } from "react";
import type { User } from "@supabase/supabase-js";

export type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  avatar_id?: string | null;
  rating: number;
  games_played: number;
  wins: number;
  losses: number;
  draws: number;
};

export type AuthContextType = {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  passwordRecovery: boolean;
  finishPasswordRecovery: () => void;
  refreshProfile: () => Promise<void>;

  signUp: (
    email: string,
    password: string,
  ) => Promise<{
    error: Error | null;
    needsEmailConfirmation: boolean;
  }>;

  signIn: (
    email: string,
    password: string,
  ) => Promise<{
    error: Error | null;
  }>;

  updateProfile: (
    username: string,
    displayName: string,
  ) => Promise<{
    error: Error | null;
  }>;

  signOut: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextType | undefined>(
  undefined,
);

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside an AuthProvider");
  }

  return context;
}
