import { isPixelAvatarId } from "./pixelAvatar.ts";

/** Keep the most recently created avatars first and discard malformed entries. */
export function mergeCustomAvatars(...collections: unknown[]): string[] {
  return [...new Set(collections.flatMap(value => Array.isArray(value) ? value.filter(isPixelAvatarId) : []))];
}

export function readCustomAvatars(storage: Pick<Storage, "getItem">, userId: string): string[] {
  try {
    return mergeCustomAvatars(JSON.parse(storage.getItem(`custom-avatars:${userId}`) ?? "[]"));
  } catch {
    return [];
  }
}

export function writeCustomAvatars(storage: Pick<Storage, "setItem">, userId: string, avatars: string[]): boolean {
  try {
    storage.setItem(`custom-avatars:${userId}`, JSON.stringify(mergeCustomAvatars(avatars)));
    return true;
  } catch {
    return false;
  }
}
