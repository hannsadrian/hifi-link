import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

export type Settings = {
  baseUrl: string; // e.g. http://192.168.1.50
  apiKey: string;
};

const STORAGE_KEY = 'hifi.settings.v1';

export async function loadSettings(): Promise<Settings | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Settings) : null;
  } catch (e) {
    console.warn('Failed to load settings', e);
    return null;
  }
}

export async function saveSettings(s: Settings): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSettings().then((s) => {
      setSettings(s);
      setLoading(false);
    });
  }, []);

  const update = async (patch: Partial<Settings>) => {
    const next: Settings = { baseUrl: '', apiKey: '', ...(settings ?? {}), ...patch };
    setSettings(next);
    await saveSettings(next);
  };

  return { settings, setSettings: update, loading } as const;
}
