import { useSyncExternalStore } from "react";
import {
  getPreferences,
  subscribePreferences,
  type PartyPreferences,
} from "../../../games/party/client/preferences.ts";

export function usePreferences(): PartyPreferences {
  return useSyncExternalStore(subscribePreferences, getPreferences, getPreferences);
}
