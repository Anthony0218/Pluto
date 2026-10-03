/** Keep a user's exact server row visible when pagination puts it off-screen. */
export function pinnedGoRow<T extends { user_id: string }>(rows: T[], own: T | null): T | null {
  return own && !rows.some(row => row.user_id === own.user_id) ? own : null;
}
