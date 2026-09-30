/** Keep friend-message read state separate from the notification bell. */
export function getFriendMessageBaseline(userId?: string) {
  const identity = userId ?? "guest";
  try {
    const key = `pluto-friends-message-baseline-${identity}`;
    const saved = localStorage.getItem(key);
    if (saved !== null) return Number(saved) || 0;
    const previousNotificationReadAt = Number(localStorage.getItem(`pluto-notifications-read-${identity}`) || 0);
    localStorage.setItem(key, String(previousNotificationReadAt));
    return previousNotificationReadAt;
  } catch { return 0; }
}
