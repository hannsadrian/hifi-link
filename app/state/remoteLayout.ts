import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

export type ButtonConfig = {
  id: string;
  title: string;
  icon?: string; // SF symbol key supported by IconSymbol mapping, optional
  device: string; // device name on firmware
  command: string; // command or comma-separated commands
  repetitions?: number;
};

export type LayoutPreset = { type: 'grid'; rows: number; cols: number };

export type GridSection = {
  type: 'grid';
  id: string;
  title: string;
  collapsed?: boolean;
  layout: LayoutPreset; // grid
  buttons: ButtonConfig[]; // length should fit rows*cols for grid
};

export type AmpQuickButton = { icon?: string; device: string; command: string; repetitions?: number };
export type AmpGridButton = { id: string; title: string; device: string; command: string };
export type AmpControlSide = { icon?: string; device: string; command: string; repeat?: boolean; repetitions?: number };
export type AmpControl = { left: AmpControlSide; label: string; right: AmpControlSide };

export type AmpSection = {
  type: 'amp';
  id: string;
  title: string;
  collapsed?: boolean;
  quick?: AmpQuickButton[]; // 0-3
  grid: AmpGridButton[]; // 3-9 (3 columns)
  controls: AmpControl[]; // expect 2 pairs
};

export type CdButton = { id: string; title?: string; icon?: string; device: string; command: string; repetitions?: number };
export type CdSection = {
  type: 'cd';
  id: string;
  title: string;
  collapsed?: boolean;
  buttons: CdButton[]; // shown in a single horizontal row
};

export type Section = GridSection | AmpSection | CdSection;

export type RemoteLayout = {
  sections: Section[];
};

const STORAGE_KEY = 'hifi.remote.layout.v2';

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export function defaultLayout(): RemoteLayout {
  return {
    sections: [
      {
        type: 'amp',
        id: uid(),
        title: 'atelier R4',
        collapsed: false,
        quick: [{ icon: 'speaker.slash.fill', device: 'MyAmp', command: 'MUTE' }],
        grid: [
          { id: uid(), title: 'CD', device: 'MyAmp', command: 'CD' },
          { id: uid(), title: 'Tuner', device: 'MyAmp', command: 'TUNER' },
          { id: uid(), title: 'Tape', device: 'MyAmp', command: 'TAPE' },
          { id: uid(), title: 'BT', device: 'MyAmp', command: 'BLUETOOTH' },
          { id: uid(), title: 'Phono', device: 'MyAmp', command: 'PHONO' },
          { id: uid(), title: 'AUX', device: 'MyAmp', command: 'AUX' },
        ],
        controls: [
          { left: { icon: 'chevron.left', device: 'MyAmp', command: 'PRESET_DOWN' }, label: 'program', right: { icon: 'chevron.right', device: 'MyAmp', command: 'PRESET_UP' } },
          { left: { icon: 'minus', device: 'MyAmp', command: 'VOL_DOWN', repeat: true }, label: 'volume', right: { icon: 'plus', device: 'MyAmp', command: 'VOL_UP', repeat: true } },
        ],
      },
      // Example CD section (empty by default)
      // { type: 'cd', id: uid(), title: 'CD Player', collapsed: false, buttons: [] },
    ],
  };
}

export async function loadRemoteLayout(): Promise<RemoteLayout> {
  try {
    const rawV2 = await AsyncStorage.getItem(STORAGE_KEY);
    if (rawV2) return JSON.parse(rawV2);
    // migrate from v1 if present
    const rawV1 = await AsyncStorage.getItem('hifi.remote.layout.v1');
    if (rawV1) {
      const old = JSON.parse(rawV1) as { sections: any[] };
      // best-effort migration: convert old grid-only sections to GridSection
      const migrated: RemoteLayout = {
        sections: (old.sections || []).map((s) => ({
          type: 'grid',
          id: s.id || uid(),
          title: s.title || 'Section',
          collapsed: s.collapsed || false,
          layout: s.layout || { type: 'grid', rows: 2, cols: 3 },
          buttons: s.buttons || [],
        })),
      };
      await saveRemoteLayout(migrated);
      return migrated;
    }
  } catch (e) {
    console.warn('Failed to load layout', e);
  }
  const def = defaultLayout();
  await saveRemoteLayout(def);
  return def;
}

export async function saveRemoteLayout(layout: RemoteLayout): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
}

export function useRemoteLayout() {
  const [layout, setLayout] = useState<RemoteLayout | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRemoteLayout().then((l) => {
      setLayout(l);
      setLoading(false);
    });
  }, []);

  const update = useCallback(async (updater: (curr: RemoteLayout) => RemoteLayout) => {
    setLayout((curr) => {
      const base = curr ?? { sections: [] };
      const next = updater(base);
      saveRemoteLayout(next);
      return next;
    });
  }, []);

  return { layout, setLayout: update, loading, uid } as const;
}

export function presets(): LayoutPreset[] {
  return [
    { type: 'grid', rows: 1, cols: 3 },
    { type: 'grid', rows: 2, cols: 2 },
    { type: 'grid', rows: 2, cols: 3 },
    { type: 'grid', rows: 3, cols: 3 },
    { type: 'grid', rows: 4, cols: 3 },
  ];
}
