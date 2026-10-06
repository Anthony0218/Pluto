import { useEffect, useState } from 'react';
export function useToolClock(active = true, interval = 500) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { if (!active) return; const tick = () => setNow(Date.now()); const timer = setInterval(tick, interval); window.addEventListener('focus', tick); document.addEventListener('visibilitychange', tick); return () => { clearInterval(timer); window.removeEventListener('focus', tick); document.removeEventListener('visibilitychange', tick); }; }, [active, interval]);
  return now;
}
