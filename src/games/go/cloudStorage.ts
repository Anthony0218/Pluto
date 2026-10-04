import { supabase } from "../../lib/supabase";
import { cacheGoRecord, listSavedGoGames, parseSavedGoRecord, type SavedGoGame } from "./storage";

export async function uploadGoRecord(record: SavedGoGame, userId: string): Promise<void> {
  if (record.ownerId !== userId) throw new Error("This game belongs to a different account.");
  const { error } = await supabase.from("go_saved_games").upsert({ id: record.id, user_id: userId, saved_at: record.savedAt, record });
  if (error) throw new Error(error.message);
}

export async function fetchCloudGoGames(userId: string): Promise<SavedGoGame[]> {
  const records: SavedGoGame[] = [];
  const pageSize = 200;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase.from("go_saved_games").select("record").eq("user_id", userId).order("saved_at", { ascending: false }).order("id").range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      const record = parseSavedGoRecord(row.record);
      if (record?.ownerId === userId) records.push(record);
    }
    if (!data || data.length < pageSize) return records;
  }
}

export async function refreshGoLibrary(userId: string): Promise<SavedGoGame[]> {
  const remote = await fetchCloudGoGames(userId);
  for (const record of remote) cacheGoRecord(record);
  // Retry records saved offline on this account. Anonymous records stay local
  // until the user explicitly chooses to claim them.
  const remoteIds = new Set(remote.map(record => record.id));
  for (const record of listSavedGoGames(userId)) if (record.ownerId === userId && !remoteIds.has(record.id)) await uploadGoRecord(record, userId);
  return listSavedGoGames(userId);
}

export async function claimLocalGoGames(userId: string): Promise<SavedGoGame[]> {
  for (const record of listSavedGoGames(userId)) {
    if (record.ownerId) continue;
    const claimed = { ...record, ownerId: userId };
    await uploadGoRecord(claimed, userId);
    cacheGoRecord(claimed);
  }
  return listSavedGoGames(userId);
}

export async function deleteCloudGoGame(id: string, userId: string): Promise<void> {
  const { error } = await supabase.from("go_saved_games").delete().eq("id", id).eq("user_id", userId);
  if (error) throw new Error(error.message);
}
