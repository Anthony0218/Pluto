import { useCallback, useEffect, useRef } from "react";
import type { MinigameInput } from "../../../../games/party/types.ts";

// Sends continuous-control input (paddle height, joystick direction) at most every `intervalMs`, always
// delivering the latest value with a trailing send. Identical consecutive values are skipped. Keeps the
// client well under the server's per-socket message limit.
export function useThrottledInput(
  send: (input: MinigameInput) => void,
  intervalMs: number,
) {
  const last = useRef({ at: 0, key: "" });
  const pending = useRef<MinigameInput | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sendRef = useRef(send);
  useEffect(() => {
    sendRef.current = send;
  });
  const flush = useCallback(() => {
    timer.current = null;
    const input = pending.current;
    pending.current = null;
    if (!input) return;
    const key = JSON.stringify(input);
    if (key === last.current.key) return;
    last.current = { at: performance.now(), key };
    sendRef.current(input);
  }, []);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  return useCallback(
    (input: MinigameInput) => {
      pending.current = input;
      const wait = intervalMs - (performance.now() - last.current.at);
      if (wait <= 0) flush();
      else if (!timer.current) timer.current = setTimeout(flush, wait);
    },
    [flush, intervalMs],
  );
}
