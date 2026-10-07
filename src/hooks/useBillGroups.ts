import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import type { ExpenseGroup } from '@/data/lifeTools';
export type BillInvitation = { id: string; groupId: string; name: string; currency: string };
export function useBillGroups() {
  const { user } = useAuth();
  const [snapshot, setSnapshot] = useState<{ account: string; groups: ExpenseGroup[]; invitations: BillInvitation[] }>({ account: '', groups: [], invitations: [] });
  const [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const account = user?.id ?? '', current = useRef(account), request = useRef(0);
  useEffect(() => { current.current = account; }, [account]);
  const refresh = useCallback(async () => {
    if (!account) return;
    const token = ++request.current;
    const { data, error } = await supabase.rpc('bill_list');
    if (current.current !== account || token !== request.current) return;
    if (error) setError(error.message); else { setSnapshot({ account, groups: data.groups, invitations: data.invitations }); setError(''); }
  }, [account]);
  useEffect(() => {
    const initial = window.setTimeout(() => void refresh(), 0);
    const timer = window.setInterval(() => void refresh(), 15000);
    window.addEventListener('focus', refresh);
    return () => { window.clearTimeout(initial); window.clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [refresh]);
  const run = async (name: string, args: Record<string, unknown>): Promise<{ ok: boolean; id?: string }> => {
    if (!account || busy) return { ok: false };
    setBusy(true); setError('');
    try {
      const { data, error } = await supabase.rpc(name, args);
      if (current.current !== account) return { ok: false };
      if (error) { setError(error.message); return { ok: false }; }
      await refresh(); return { ok: true, id: typeof data === 'string' ? data : undefined };
    } catch (error) { if (current.current === account) setError(error instanceof Error ? error.message : 'Could not connect. Try again.'); return { ok: false }; }
    finally { if (current.current === account) setBusy(false); }
  };
  return { groups: snapshot.account === account ? snapshot.groups : [], invitations: snapshot.account === account ? snapshot.invitations : [], error, busy, refresh, run };
}
