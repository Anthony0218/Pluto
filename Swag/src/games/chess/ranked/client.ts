import { supabase } from "@/lib/supabase";

export class RankedAuthError extends Error {
  constructor(message = "Your session could not be verified. Sign out and sign in again.") {
    super(message);
    this.name = "RankedAuthError";
  }
}

type FunctionErrorBody = { error?: string; message?: string };

async function invokeWithToken<T>(body: Record<string, unknown>, token: string): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>("ranked-chess", {
    body,
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!error) return data as T;

  const context = "context" in error ? error.context : null;
  if (context instanceof Response) {
    const detail = await context.clone().json().catch(() => null) as FunctionErrorBody | null;
    if (context.status === 401) throw new RankedAuthError(detail?.error ?? detail?.message);
    throw new Error(detail?.error ?? detail?.message ?? error.message);
  }
  throw new Error(error.message);
}

export async function invokeRankedChess<T>(body: Record<string, unknown>): Promise<T> {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session?.access_token) throw new RankedAuthError("Sign in again to play multiplayer chess.");
  try {
    return await invokeWithToken<T>(body, session.access_token);
  } catch (cause) {
    if (!(cause instanceof RankedAuthError)) throw cause;
    const { data, error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError || !data.session?.access_token) throw new RankedAuthError();
    try {
      return await invokeWithToken<T>(body, data.session.access_token);
    } catch (retryCause) {
      if (retryCause instanceof RankedAuthError) throw new RankedAuthError();
      throw retryCause;
    }
  }
}

// Cache the token while the page is alive: pagehide cannot await getSession().
let queueToken: string | undefined;
void supabase.auth.getSession().then(({ data }) => { queueToken = data.session?.access_token; });
supabase.auth.onAuthStateChange((_event, session) => { queueToken = session?.access_token; });
export function leaveRankedQueue(sessionId: string) {
  if (!queueToken) { void invokeRankedChess({ op: "leaveQueue", sessionId }).catch(() => {}); return; }
  void fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ranked-chess`, {
    method: "POST", keepalive: true,
    headers: { Authorization: `Bearer ${queueToken}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ op: "leaveQueue", sessionId }),
  }).catch(() => { /* The server lease expires even if the browser cannot send. */ });
}
