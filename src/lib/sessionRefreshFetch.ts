const DEFAULT_COOLDOWN_MS = 60_000;

/** Keep temporary auth throttling from being treated as revoked credentials. */
export function createSessionRefreshFetch(
  supabaseUrl: string,
  fetcher: typeof fetch = (...args) => globalThis.fetch(...args),
  now: () => number = () => Date.now(),
): typeof fetch {
  const endpoint = new URL("/auth/v1/token", supabaseUrl);
  let retryAt = 0;

  return async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const method = init?.method ?? (input instanceof Request ? input.method : "GET");
    const isRefresh = method.toUpperCase() === "POST"
      && url.origin === endpoint.origin
      && url.pathname === endpoint.pathname
      && url.searchParams.get("grant_type") === "refresh_token";

    // Supabase treats fetch rejections as retryable and retains the session.
    // Suppress its retries during the cooldown without sending more requests.
    if (isRefresh && now() < retryAt) throw new Error("Session refresh is temporarily rate limited.");

    const response = await fetcher(input, init);
    if (isRefresh && response.status === 429) {
      const retryAfter = response.headers.get("Retry-After");
      const seconds = retryAfter === null ? NaN : Number(retryAfter);
      const delay = Number.isFinite(seconds)
        ? seconds * 1000
        : Date.parse(retryAfter ?? "") - now();
      retryAt = now() + Math.max(DEFAULT_COOLDOWN_MS, Number.isFinite(delay) ? delay : 0);
      throw new Error("Session refresh is temporarily rate limited.");
    }
    return response;
  };
}
