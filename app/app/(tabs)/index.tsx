import { AddSectionSheet } from '@/components/remote/AddSectionSheet';
import { AmpControlSection } from '@/components/remote/AmpControlSection';
import { CdPlayerSection } from '@/components/remote/CdPlayerSection';
import { EditorModal } from '@/components/remote/EditorModal';
import { RemoteSection } from '@/components/remote/RemoteSection';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { makeApi } from '@/lib/api';
import { prompt } from '@/lib/prompt';
import { AmpSection, CdSection, GridSection, Section, useRemoteLayout } from '@/state/remoteLayout';
import { useSettings } from '@/state/settings';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, FlatList, StyleSheet, TouchableOpacity, View } from 'react-native';
import { RenderItemParams } from 'react-native-draggable-flatlist';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function RemoteScreen() {
  const [editMode, setEditMode] = useState(false);
  const { layout, setLayout, loading, uid } = useRemoteLayout();
  const { settings } = useSettings();
  const api = useMemo(() => makeApi({ baseUrl: settings?.baseUrl, apiKey: settings?.apiKey }), [settings]);

  // On mount/settings change, attempt to load UI config from backend and hydrate layout
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!settings?.baseUrl) return;
      try {
        const cfg = await api.getUiConfig();
        let maybeLayout: any = null;
        if (cfg && typeof cfg === 'object' && Array.isArray(cfg.sections)) {
          // Entire blob is the remote layout
          maybeLayout = cfg;
        } else if (cfg && typeof cfg === 'object' && cfg.remoteLayout && Array.isArray(cfg.remoteLayout.sections)) {
          // Namespaced inside 'remoteLayout'
          maybeLayout = cfg.remoteLayout;
        }
        if (maybeLayout && !cancelled) {
          setLayout(() => maybeLayout);
        }
      } catch (e) {
        // ignore; fall back to local AsyncStorage
      }
    })();
    return () => { cancelled = true; };
  }, [settings?.baseUrl, settings?.apiKey]);

  // Debounced push of layout changes to backend UI config
  const saveTimer = useRef<any>(null);
  useEffect(() => {
    if (!layout || !settings?.baseUrl) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        // Fetch current UI config to preserve unrelated keys
        let current: any = {};
        try { current = await api.getUiConfig(); } catch {}
        let body: any;
        if (current && typeof current === 'object' && Array.isArray(current.sections)) {
          // Server currently stores layout as top-level; overwrite with our layout
          body = layout;
        } else {
          // Store under a namespaced key to avoid clobbering other data
          body = { ...(typeof current === 'object' && current ? current : {}), remoteLayout: layout };
        }
        await api.putUiConfig(body);
      } catch (e) {
        // ignore transient errors; local storage remains the source of truth offline
      }
    }, 500);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [layout, settings?.baseUrl, settings?.apiKey]);

  const sendGridAt = (sectionIdx: number) => async (btnIdx: number) => {
    if (!layout) return;
    const section = layout.sections[sectionIdx] as GridSection;
    if (section.type !== 'grid') return;
    const btn = section.buttons[btnIdx];
    if (!btn || !btn.device || !btn.command) {
      if (editMode) return;
      Alert.alert('Not configured', 'Configure this button in Edit mode.');
      return;
    }
    try {
  await api.deviceSend({ name: btn.device, command: btn.command, repetitions: Math.max(1, btn.repetitions ?? 1), fast: true });
    } catch (e: any) {
      Alert.alert('Send failed', e?.message ?? String(e));
    }
  };

  const addGridSection = (rows = 2, cols = 3) => {
    setLayout((curr) => ({
      ...curr,
      sections: [
        ...curr.sections,
        { type: 'grid', id: uid(), title: 'New Grid', collapsed: false, layout: { type: 'grid', rows, cols }, buttons: [] },
      ],
    }));
  };
  const addAmpSection = () => {
    setLayout((curr) => ({
      ...curr,
      sections: [
        ...curr.sections,
        {
          type: 'amp', id: uid(), title: 'New Amp', collapsed: false,
          quick: [],
          grid: [
            { id: uid(), title: 'Source 1', device: '', command: '' },
            { id: uid(), title: 'Source 2', device: '', command: '' },
            { id: uid(), title: 'Source 3', device: '', command: '' },
          ],
          controls: [
            { left: { icon: 'chevron.left', device: '', command: '' }, label: 'program', right: { icon: 'chevron.right', device: '', command: '' } },
            { left: { icon: 'minus', device: '', command: '', repeat: true }, label: 'volume', right: { icon: 'plus', device: '', command: '', repeat: true } },
          ],
        } as AmpSection,
      ],
    }));
  };

  const addCdSection = () => {
    setLayout((curr) => ({
      ...curr,
      sections: [
        ...curr.sections,
        {
          type: 'cd', id: uid(), title: 'CD Player', collapsed: false,
          buttons: [
            { id: uid(), title: 'Prev', icon: 'backward.end.fill', device: '', command: '' },
            { id: uid(), title: 'Rew', icon: 'backward.fill', device: '', command: '' },
            { id: uid(), title: 'Play', icon: 'play.fill', device: '', command: '' },
            { id: uid(), title: 'Pause', icon: 'pause.fill', device: '', command: '' },
            { id: uid(), title: 'Stop', icon: 'stop.fill', device: '', command: '' },
            { id: uid(), title: 'FF', icon: 'forward.fill', device: '', command: '' },
            { id: uid(), title: 'Next', icon: 'forward.end.fill', device: '', command: '' },
            { id: uid(), title: 'Eject', icon: 'eject.fill', device: '', command: '' },
          ].slice(0, 6),
        } as CdSection,
      ],
    }));
  };

  const renameSection = async (idx: number) => {
    const name = await prompt('Section name?', layout?.sections[idx]?.title ?? '');
    if (!name) return;
    setLayout((curr) => {
      const sections = curr.sections.slice();
      sections[idx] = { ...sections[idx], title: name };
      return { ...curr, sections };
    });
  };

  const changeLayout = (idx: number) => {
    setLayout((curr) => {
      const s = curr.sections[idx];
      if (s.type !== 'grid') return curr;
      const presets = [
        { type: 'grid' as const, rows: 1, cols: 3 },
        { type: 'grid' as const, rows: 2, cols: 2 },
        { type: 'grid' as const, rows: 2, cols: 3 },
        { type: 'grid' as const, rows: 3, cols: 3 },
      ];
      const nextIdx = (presets.findIndex((p) => p.rows === s.layout.rows && p.cols === s.layout.cols) + 1) % presets.length;
      const next = presets[nextIdx];
      const total = next.rows * next.cols;
      const buttons = s.buttons.slice(0, total);
      return { ...curr, sections: curr.sections.map((sec, i) => (i === idx ? { ...(s as GridSection), layout: next, buttons } : sec)) };
    });
  };

  // Drag handles reordering handled by DraggableFlatList onDragEnd

  const deleteSection = (idx: number) => {
    setLayout((curr) => ({ ...curr, sections: curr.sections.filter((_, i) => i !== idx) }));
  };

  const toggleCollapsed = (idx: number) => {
    setLayout((curr) => {
      const sections = curr.sections.slice();
      sections[idx] = { ...sections[idx], collapsed: !sections[idx].collapsed };
      return { ...curr, sections };
    });
  };

  const editButton = async (sectionIdx: number, btnIdx: number) => {
    if (!layout) return;
    const section = layout.sections[sectionIdx];
    if (section.type !== 'grid') return;
    const curr = section.buttons[btnIdx] ?? { id: uid(), title: '', device: '', command: '' };
    openEditor({
      title: `Button #${btnIdx + 1}`,
      showTitle: true,
      showIcon: true,
      showDevice: true,
      showCommand: true,
      showRepetitions: true,
  initial: { title: curr.title, icon: curr.icon, device: curr.device, command: curr.command, repetitions: Math.max(1, curr.repetitions ?? 1) },
      onSave: (val) => {
        setLayout((prev) => {
          const p = prev.sections[sectionIdx] as GridSection;
          const total = p.layout.rows * p.layout.cols;
          const buttons = p.buttons.slice();
          if (!val.device || !val.command) {
            // delete/reset: make this slot a placeholder
            if (btnIdx < buttons.length) buttons[btnIdx] = { id: buttons[btnIdx]?.id ?? uid(), title: '', device: '', command: '' } as any;
            else {
              for (let i = buttons.length; i < btnIdx; i++) buttons[i] = { id: uid(), title: '', device: '', command: '' } as any;
              buttons[btnIdx] = { id: uid(), title: '', device: '', command: '' } as any;
            }
          } else {
            const payload = {
              id: curr.id ?? uid(),
              title: val.title ?? curr.title,
              icon: val.icon ?? curr.icon,
              device: val.device ?? curr.device,
              command: val.command ?? curr.command,
              repetitions: val.repetitions ?? curr.repetitions,
            };
            if (btnIdx < buttons.length) buttons[btnIdx] = payload as any;
            else {
              for (let i = buttons.length; i < btnIdx; i++) buttons[i] = { id: uid(), title: '', device: '', command: '' } as any;
              buttons[btnIdx] = payload as any;
            }
          }
          return {
            ...prev,
            sections: prev.sections.map((s, i) => (i === sectionIdx ? { ...(p as GridSection), buttons: buttons.slice(0, total) } : s)),
          };
        });
      },
    });
  };

  // Amp editing helpers
  const editAmpQuick = async (idx: number) => {
    if (!layout) return;
    const sec = layout.sections[idx];
    if (sec.type !== 'amp') return;
    const nextQuick = [...(sec.quick ?? [])];
    for (let i = 0; i < 3; i++) {
      const q = nextQuick[i] ?? { icon: 'speaker.slash.fill', device: '', command: '' };
      const icon = (await prompt(`Quick #${i + 1} icon (optional)`, q.icon ?? '')) || undefined;
      const device = (await prompt(`Quick #${i + 1} device`, q.device)) ?? q.device;
      const command = (await prompt(`Quick #${i + 1} command`, q.command)) ?? q.command;
      if (!device || !command) {
        // remove slot if empty
        if (i < nextQuick.length) nextQuick.splice(i, 1);
        continue;
      }
      nextQuick[i] = { icon, device, command };
    }
    setLayout((prev) => {
      const p = prev.sections[idx];
      if (p.type !== 'amp') return prev;
      return { ...prev, sections: prev.sections.map((s, i) => (i === idx ? { ...p, quick: nextQuick.slice(0, 3) } : s)) };
    });
  };

  const editAmpGrid = async (idx: number) => {
    if (!layout) return;
    const sec = layout.sections[idx];
    if (sec.type !== 'amp') return;
    const countStr = await prompt('Number of grid buttons (3-9)?', String(sec.grid.length));
    const count = Math.max(3, Math.min(9, Number(countStr || sec.grid.length)));
    const nextGrid = [...sec.grid];
    for (let i = 0; i < count; i++) {
      const g = nextGrid[i] ?? { id: uid(), title: `Button ${i + 1}`, device: '', command: '' };
      const title = (await prompt(`Grid #${i + 1} title`, g.title)) ?? g.title;
      const device = (await prompt(`Grid #${i + 1} device`, g.device)) ?? g.device;
      const command = (await prompt(`Grid #${i + 1} command`, g.command)) ?? g.command;
      nextGrid[i] = { ...g, title, device, command };
    }
    setLayout((prev) => {
      const p = prev.sections[idx];
      if (p.type !== 'amp') return prev;
      return { ...prev, sections: prev.sections.map((s, i) => (i === idx ? { ...p, grid: nextGrid.slice(0, count) } : s)) };
    });
  };

  const editAmpControls = async (idx: number) => {
    if (!layout) return;
    const sec = layout.sections[idx];
    if (sec.type !== 'amp') return;
    const nextControls = [...(sec.controls ?? [])];
    for (let p = 0; p < 2; p++) {
      const c = nextControls[p] ?? { left: { icon: 'chevron.left', device: '', command: '' }, label: p === 0 ? 'program' : 'volume', right: { icon: p === 0 ? 'chevron.right' : 'plus', device: '', command: '' } };
      const label = (await prompt(`Pair ${p + 1} label`, c.label)) ?? c.label;
      const lIcon = (await prompt(`Pair ${p + 1} left icon`, c.left.icon ?? '')) || undefined;
      const lDevice = (await prompt(`Pair ${p + 1} left device`, c.left.device)) ?? c.left.device;
      const lCommand = (await prompt(`Pair ${p + 1} left command`, c.left.command)) ?? c.left.command;
      const lRepeat = ((await prompt(`Pair ${p + 1} left repeat? (y/n)`, c.left.repeat ? 'y' : 'n')) ?? (c.left.repeat ? 'y' : 'n')).toLowerCase().startsWith('y');
      const rIcon = (await prompt(`Pair ${p + 1} right icon`, c.right.icon ?? '')) || undefined;
      const rDevice = (await prompt(`Pair ${p + 1} right device`, c.right.device)) ?? c.right.device;
      const rCommand = (await prompt(`Pair ${p + 1} right command`, c.right.command)) ?? c.right.command;
      const rRepeat = ((await prompt(`Pair ${p + 1} right repeat? (y/n)`, c.right.repeat ? 'y' : 'n')) ?? (c.right.repeat ? 'y' : 'n')).toLowerCase().startsWith('y');
      nextControls[p] = {
        left: { icon: lIcon, device: lDevice, command: lCommand, repeat: lRepeat },
        label,
        right: { icon: rIcon, device: rDevice, command: rCommand, repeat: rRepeat },
      };
    }
    setLayout((prev) => {
      const p = prev.sections[idx];
      if (p.type !== 'amp') return prev;
      return { ...prev, sections: prev.sections.map((s, i) => (i === idx ? { ...p, controls: nextControls.slice(0, 2) } : s)) };
    });
  };

  const [editorVisible, setEditorVisible] = useState(false);
  const [editorConfig, setEditorConfig] = useState<{
    title: string;
    showTitle?: boolean;
    showIcon?: boolean;
    showRepetitions?: boolean;
    showDevice?: boolean;
    showCommand?: boolean;
    initial: any;
    onSave: (val: any) => void;
  } | null>(null);
  const [addVisible, setAddVisible] = useState(false);

  const openEditor = (cfg: NonNullable<typeof editorConfig>) => {
    setEditorConfig(cfg);
    setEditorVisible(true);
  };

  const renderItem = ({ item, drag, getIndex }: RenderItemParams<Section>) => {
    // Prefer getIndex from DraggableFlatList to avoid mismatches
    const index = Math.max(0, getIndex?.() ?? 0);
  if (item.type === 'amp') {
      const amp = item as AmpSection;
      const quickButtons = (amp.quick ?? [])
        .filter(Boolean)
        .slice(0, 3)
        .map((q) => ({
          icon: q?.icon ?? 'speaker.slash.fill',
          onPress: async () => {
            if (!q?.device || !q?.command) return;
            try { await api.deviceSend({ name: q.device, command: q.command, repetitions: Math.max(1, q.repetitions ?? 1), fast: true }); }
            catch (e: any) { Alert.alert('Send failed', e?.message ?? String(e)); }
          },
        }));
      const gridButtons = ((amp.grid ?? []) as any[])
        .filter((g) => editMode ? true : (!!g?.device && !!g?.command))
        .map((g) => ({
          title: g?.title ?? '',
          onPress: async () => {
            if (!g?.device || !g?.command) return;
            try { await api.deviceSend({ name: g.device, command: g.command, fast: true }); }
            catch (e: any) { Alert.alert('Send failed', e?.message ?? String(e)); }
          },
        }));
      const controlPairs = (amp.controls ?? [])
        .filter(Boolean)
        .slice(0, 2)
        .map((c) => ({
          left: {
            icon: c?.left?.icon,
            repeat: c?.left?.repeat,
            onPress: async () => {
              if (!c?.left?.device || !c?.left?.command) return;
              try { await api.deviceSend({ name: c.left.device, command: c.left.command, repetitions: c.left.repetitions, fast: true }); }
              catch (e: any) { Alert.alert('Send failed', e?.message ?? String(e)); }
            },
          },
          label: c?.label ?? '',
          right: {
            icon: c?.right?.icon,
            repeat: c?.right?.repeat,
            onPress: async () => {
              if (!c?.right?.device || !c?.right?.command) return;
              try { await api.deviceSend({ name: c.right.device, command: c.right.command, repetitions: c.right.repetitions, fast: true }); }
              catch (e: any) { Alert.alert('Send failed', e?.message ?? String(e)); }
            },
          },
        }));

      return (
        <AmpControlSection
          title={amp.title}
          collapsed={!!amp.collapsed}
          onToggle={() => toggleCollapsed(index)}
          quickButtons={quickButtons}
          gridButtons={gridButtons}
          controlPairs={controlPairs}
          editMode={editMode}
          onStartDrag={drag}
          onEditTitle={async () => {
            const newTitle = await prompt('Section name?', amp.title);
            if (!newTitle) return;
            setLayout((prev) => ({ ...prev, sections: prev.sections.map((s, i) => (i === index ? { ...s, title: newTitle } : s)) }));
          }}
          onDelete={() => {
            Alert.alert('Delete section?', 'This cannot be undone.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Delete', style: 'destructive', onPress: () => deleteSection(index) },
            ]);
          }}
          onEditQuickAt={(qi) => {
            openEditor({
              title: `Quick #${qi + 1}`,
              showIcon: true,
              showRepetitions: true,
              showDevice: true,
              showCommand: true,
              initial: { icon: amp.quick?.[qi]?.icon, repetitions: Math.max(1, amp.quick?.[qi]?.repetitions ?? 1), device: amp.quick?.[qi]?.device, command: amp.quick?.[qi]?.command },
              onSave: (val) => {
                setLayout((prev) => {
                  const sec = prev.sections[index];
                  if (sec.type !== 'amp') return prev;
                  const quick = [...(sec.quick ?? [])];
                  if (!val.device || !val.command) quick.splice(qi, 1);
                  else quick[qi] = { icon: val.icon, device: val.device, command: val.command, repetitions: val.repetitions };
                  return { ...prev, sections: prev.sections.map((s, i) => (i === index ? { ...sec, quick } : s)) };
                });
              },
            });
          }}
          onEditGridAt={(gi) => {
            const init = amp.grid[gi];
            openEditor({
              title: `Grid #${gi + 1}`,
              showTitle: true,
              showDevice: true,
              showCommand: true,
              initial: init ?? {},
              onSave: (val) => {
                setLayout((prev) => {
                  const sec = prev.sections[index];
                  if (sec.type !== 'amp') return prev;
                  const grid = [...sec.grid];
                  if (!val.device || !val.command) {
                    // delete/reset to placeholder (visible only in edit mode)
                    grid[gi] = { id: grid[gi]?.id ?? uid(), title: '', device: '', command: '' };
                  } else {
                    grid[gi] = { id: grid[gi]?.id ?? uid(), title: val.title ?? grid[gi]?.title ?? '', device: val.device ?? grid[gi]?.device ?? '', command: val.command ?? grid[gi]?.command ?? '' };
                  }
                  return { ...prev, sections: prev.sections.map((s, i) => (i === index ? { ...sec, grid } : s)) };
                });
              },
            });
          }}
          onEditControl={(pi, side) => {
            const c = amp.controls?.[pi];
            if (side === 'label') {
              openEditor({
                title: 'Edit label',
                showTitle: true,
                initial: { title: c?.label },
                onSave: (val) => {
                  setLayout((prev) => {
                    const sec = prev.sections[index];
                    if (sec.type !== 'amp') return prev;
                    const controls = [...(sec.controls ?? [])];
                    const curr = controls[pi] ?? { left: { icon: '', device: '', command: '' }, label: '', right: { icon: '', device: '', command: '' } };
                    controls[pi] = { ...curr, label: val.title ?? curr.label };
                    return { ...prev, sections: prev.sections.map((s, i) => (i === index ? { ...sec, controls } : s)) };
                  });
                },
              });
              return;
            }
            const sideData = side === 'left' ? c?.left : c?.right;
            openEditor({
              title: side === 'left' ? 'Edit left control' : 'Edit right control',
              showIcon: true,
              showRepetitions: true,
              showDevice: true,
              showCommand: true,
              initial: { icon: sideData?.icon, repetitions: Math.max(1, sideData?.repetitions ?? 1), device: sideData?.device, command: sideData?.command },
              onSave: (val) => {
                setLayout((prev) => {
                  const sec = prev.sections[index];
                  if (sec.type !== 'amp') return prev;
                  const controls = [...(sec.controls ?? [])];
                  const curr = controls[pi] ?? { left: { icon: '', device: '', command: '' }, label: '', right: { icon: '', device: '', command: '' } };
                  if (side === 'left') {
                    controls[pi] = { ...curr, left: { icon: val.icon ?? curr.left.icon, device: val.device ?? curr.left.device, command: val.command ?? curr.left.command, repeat: curr.left.repeat, repetitions: val.repetitions ?? curr.left.repetitions } };
                  } else {
                    controls[pi] = { ...curr, right: { icon: val.icon ?? curr.right.icon, device: val.device ?? curr.right.device, command: val.command ?? curr.right.command, repeat: curr.right.repeat, repetitions: val.repetitions ?? curr.right.repetitions } };
                  }
                  return { ...prev, sections: prev.sections.map((s, i) => (i === index ? { ...sec, controls } : s)) };
                });
              },
            });
          }}
        />
      );
    }
    if (item.type === 'cd') {
      const cd = item as CdSection;
      const buttons = (cd.buttons ?? []).filter(Boolean).map((b) => ({
        title: b?.title ?? '',
        icon: b?.icon,
        onPress: async () => {
          if (!b?.device || !b?.command) return;
          try { await api.deviceSend({ name: b.device, command: b.command, repetitions: Math.max(1, b.repetitions ?? 1), fast: true }); }
          catch (e: any) { Alert.alert('Send failed', e?.message ?? String(e)); }
        },
      }));
      return (
        <CdPlayerSection
          title={cd.title}
          collapsed={!!cd.collapsed}
          onToggle={() => toggleCollapsed(index)}
          buttons={buttons}
          editMode={editMode}
          onStartDrag={drag}
          onEditTitle={async () => {
            const newTitle = await prompt('Section name?', cd.title);
            if (!newTitle) return;
            setLayout((prev) => ({ ...prev, sections: prev.sections.map((s, i) => (i === index ? { ...s, title: newTitle } : s)) }));
          }}
          onDelete={() => {
            Alert.alert('Delete section?', 'This cannot be undone.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Delete', style: 'destructive', onPress: () => deleteSection(index) },
            ]);
          }}
          onEditButtonAt={(bi) => {
            const curr = cd.buttons?.[bi] ?? { id: uid(), title: '', icon: 'play.fill', device: '', command: '' };
            openEditor({
              title: curr?.title ? `Button “${curr.title}”` : `Button #${bi + 1}`,
              showTitle: true,
              showIcon: true,
              showRepetitions: true,
              showDevice: true,
              showCommand: true,
              initial: { title: curr?.title, icon: curr?.icon, repetitions: Math.max(1, curr?.repetitions ?? 1), device: curr?.device, command: curr?.command },
              onSave: (val) => {
                setLayout((prev) => {
                  const sec = prev.sections[index];
                  if (sec.type !== 'cd') return prev;
                  let list = [...(sec.buttons ?? [])];
                  // If device/command empty, remove this button slot
                  if (!val.device || !val.command) {
                    if (bi < list.length) list.splice(bi, 1);
                  } else {
                    const payload = {
                      id: curr.id ?? uid(),
                      title: val.title ?? curr.title ?? '',
                      icon: val.icon ?? curr.icon,
                      device: val.device ?? curr.device ?? '',
                      command: val.command ?? curr.command ?? '',
                      repetitions: val.repetitions ?? curr.repetitions,
                    };
                    list[bi] = payload as any;
                  }
                  return { ...prev, sections: prev.sections.map((s, i) => (i === index ? { ...sec, buttons: list } : s)) };
                });
              },
            });
          }}
        />
      );
    }
    const grid = item as GridSection;
    return (
      <RemoteSection
        section={grid}
  onToggleCollapsed={() => toggleCollapsed(index)}
        onPressButton={sendGridAt(index)}
        editMode={editMode}
        onEditButton={(btnIdx) => editButton(index, btnIdx)}
        onRename={async () => {
          const newTitle = await prompt('Section name?', grid.title);
          if (!newTitle) return;
          setLayout((prev) => ({ ...prev, sections: prev.sections.map((s, i) => (i === index ? { ...s, title: newTitle } : s)) }));
        }}
        onChangeLayout={() => changeLayout(index)}
        onStartDrag={drag}
        onDelete={() => {
          Alert.alert('Delete section?', 'This cannot be undone.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: () => deleteSection(index) },
          ]);
        }}
      />
    );
  };

  return (
    <ThemedView style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={[styles.headerRow, { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 }]}>
          <ThemedText type="title">Remote</ThemedText>
          <View style={{ marginLeft: 'auto', flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity onPress={() => setEditMode((v) => !v)}>
              <ThemedText>{editMode ? 'Done' : 'Edit'}</ThemedText>
            </TouchableOpacity>
            {editMode ? (
              <TouchableOpacity onPress={() => setAddVisible(true)}>
                <ThemedText>Add</ThemedText>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        <FlatList
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, gap: 18 }}
          data={layout?.sections ?? []}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => renderItem({ item, getIndex: () => index, drag: () => {} } as any)}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator
          ListEmptyComponent={
            <View style={{ paddingVertical: 32, alignItems: 'center' }}>
              <ThemedText>{loading ? 'Loading…' : 'No sections yet'}</ThemedText>
              {!loading && editMode ? (
                <TouchableOpacity style={{ marginTop: 12 }} onPress={() => setAddVisible(true)}>
                  <ThemedText>Add a section</ThemedText>
                </TouchableOpacity>
              ) : null}
            </View>
          }
        />

        <EditorModal
          visible={editorVisible && !!editorConfig}
          onClose={() => setEditorVisible(false)}
          title={editorConfig?.title ?? ''}
          showTitle={editorConfig?.showTitle}
          showIcon={editorConfig?.showIcon}
          showRepetitions={editorConfig?.showRepetitions}
          showDevice={editorConfig?.showDevice}
          showCommand={editorConfig?.showCommand}
          initial={editorConfig?.initial ?? {}}
          onSave={editorConfig?.onSave ?? (() => {})}
        />

        <AddSectionSheet
          visible={addVisible}
          onClose={() => setAddVisible(false)}
          onAddAmp={() => { setAddVisible(false); addAmpSection(); }}
          onAddGrid={(r,c) => { setAddVisible(false); addGridSection(r,c); }}
          onAddCd={() => { setAddVisible(false); addCdSection(); }}
        />
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
});
