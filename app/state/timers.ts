import { CreateTimerRequest, HifiApi, TimerItem } from '@/lib/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';

const STORAGE_KEY = 'hifi.timers.cache.v1';

export function useTimers(api: HifiApi | null) {
  const [timers, setTimers] = useState<TimerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const refreshRef = useRef<NodeJS.Timeout | null>(null);

  // Load cached first for instant UX
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) setTimers(JSON.parse(raw));
      } catch {}
      setLoading(false);
    })();
  }, []);

  const fetchNow = useCallback(async () => {
    if (!api) return;
    setLoading(true);
    setError(null);
    try {
      const list = await api.timers();
      setTimers(list);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load timers');
    } finally {
      setLoading(false);
    }
  }, [api]);

  // Poll every 5s to keep remaining time fresh
  useEffect(() => {
    if (!api) return;
    fetchNow();
    if (refreshRef.current) clearInterval(refreshRef.current as any);
    refreshRef.current = setInterval(fetchNow, 5000) as any;
    return () => { if (refreshRef.current) clearInterval(refreshRef.current as any); };
  }, [api, fetchNow]);

  const create = useCallback(async (req: CreateTimerRequest) => {
    if (!api) throw new Error('API not configured');
    const ok = await api.createTimer(req);
    if (ok) await fetchNow();
    return ok;
  }, [api, fetchNow]);

  const test = useCallback(async (req: CreateTimerRequest) => {
    if (!api) throw new Error('API not configured');
    return api.testTimer(req);
  }, [api]);

  const remove = useCallback(async (id: string) => {
    if (!api) throw new Error('API not configured');
    const ok = await api.deleteTimer(id);
    if (ok) await fetchNow();
    return ok;
  }, [api, fetchNow]);

  return { timers, loading, error, fetch: fetchNow, create, test, remove } as const;
}
