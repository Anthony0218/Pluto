import type { SupabaseClient } from "@supabase/supabase-js";

type FriendRequestResult = { error: { code?: string; message: string } | null };

export async function sendFriendRequest(
  client: SupabaseClient,
  expectedUserId: string,
  receiverId: string,
): Promise<FriendRequestResult> {
  try {
    // The UI can retain its user during a temporary refresh failure. Check the
    // credentials before inserting, rather than letting the SDK send as anon.
    const { data: { session }, error } = await client.auth.getSession();
    if (error) return {
      error: {
        code: "AUTH_SESSION_UNAVAILABLE",
        message: error.name === "AuthRetryableFetchError" || error.status === 429
          ? "Your session could not be refreshed. Wait a minute and try again."
          : "Sign in again before sending a friend request.",
      },
    };
    if (!session?.access_token || !session.user?.id) return {
      error: { code: "AUTH_SESSION_MISSING", message: "Sign in again before sending a friend request." },
    };
    if (session.user.id !== expectedUserId) return {
      error: { code: "AUTH_ACCOUNT_CHANGED", message: "Your account changed. Reload this page and try again." },
    };
    if (receiverId === session.user.id) return {
      error: { code: "SELF_FRIEND_REQUEST", message: "You cannot add yourself as a friend." },
    };

    const result = await client.from("friend_requests").insert({
      sender_id: session.user.id,
      receiver_id: receiverId,
      status: "pending",
    }).setHeader("Authorization", `Bearer ${session.access_token}`);
    return { error: result.error };
  } catch {
    return { error: { code: "FRIEND_REQUEST_FAILED", message: "Could not send the friend request. Please try again." } };
  }
}
