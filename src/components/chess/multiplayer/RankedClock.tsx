import { useEffect, useState } from 'react';
import { formatClock, remainingClock, type ClockSample } from '@/games/chess/ranked/clock';
export default function RankedClock({ sample, color, pendingAt }: { sample: ClockSample | null; color: 'white' | 'black'; pendingAt?: number }) {
  const [now, setNow] = useState(() => performance.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(performance.now()), 100); return () => clearInterval(timer); }, []);
  const ms = sample ? remainingClock(sample, color, now, pendingAt) : 300000;
  const active = sample?.game.status === 'playing' && (sample.game.fen.split(' ')[1] === (color === 'white' ? 'w' : 'b')) !== (pendingAt !== undefined);
  return <div role="timer" aria-label={`${color} clock`} className={`rounded-xl border px-4 py-2 text-right font-mono text-3xl font-bold tabular-nums ${ms < 10000 ? 'border-red-400 bg-red-950 text-red-200' : ms < 60000 ? 'border-amber-400 bg-amber-950 text-amber-200' : active ? 'border-amber-300/60 bg-white/10 text-white' : 'border-white/10 text-zinc-400'}`}>{sample ? formatClock(ms) : "—:—"}</div>;
}
