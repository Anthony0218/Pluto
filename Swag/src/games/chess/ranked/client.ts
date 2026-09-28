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
  if (error || !session?.access_token) throw new RankedAuthError("Sign in again to play ranked chess.");
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
