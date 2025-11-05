import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { makeApi } from '@/lib/api';
import { safeSelectionAsync } from '@/lib/haptics';
import { useSettings } from '@/state/settings';
import { useTimers } from '@/state/timers';
import React, { useMemo, useState } from 'react';
import { Alert, FlatList, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

type ActionDraft = { device: string; action: string; repetitions?: number; delay_ms?: number };

function formatRemaining(trigger: string, type: string) {
  // try parse yyyy-MM-dd'T'HH:mm:ss.SSSSSS or ISO
  let date = new Date(trigger);
  if (String(date) === 'Invalid Date') {
    // try without timezone but with micros
    const m = trigger.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})/);
    if (m) date = new Date(m[1].replace('T', ' ') + 'Z');
  }
  if (String(date) === 'Invalid Date') return trigger;
  if (type === 'wakeup') return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(date);
  const diff = date.getTime() - Date.now();
  if (diff <= 0) return 'Now';
  const s = Math.floor(diff / 1000);
  if (s < 60) return `in ${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `in ${m}m`;
  const h = Math.floor(m / 60);
  return `in ${h}h`;
}

export default function TimersScreen() {
  const { settings } = useSettings();
  const api = useMemo(() => makeApi({ baseUrl: settings?.baseUrl, apiKey: settings?.apiKey }), [settings]);
  const { timers, loading, error, fetch, remove, create, test } = useTimers(settings?.baseUrl ? api : null);
  const [showAdd, setShowAdd] = useState(false);
  const scheme = useColorScheme() ?? 'light';
  const C = Colors[scheme];
  const cardBg = scheme === 'dark' ? '#1E1F20' : '#fafafa';
  const cardBorder = scheme === 'dark' ? '#2A2D2E' : '#ddd';
  const subtleBg = scheme === 'dark' ? '#222426' : '#eee';
  const inputBg = scheme === 'dark' ? '#1E1F20' : '#fff';
  const inputBorder = scheme === 'dark' ? '#2A2D2E' : '#ddd';
  const placeholder = scheme === 'dark' ? '#9BA1A6' : '#687076';

  const configured = !!settings?.baseUrl;

  return (
    <ThemedView style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
      <View style={styles.headerRow}>
        <ThemedText type="title">Timers</ThemedText>
        <View style={{ marginLeft: 'auto' }}>
          <TouchableOpacity onPress={() => {
            if (!configured) { Alert.alert('Configure device', 'Set the device IP in Settings first.'); return; }
            setShowAdd(true);
          }}>
            <ThemedText>New</ThemedText>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={timers}
        keyExtractor={(t) => t.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, gap: 12 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={fetch} />}
        ListEmptyComponent={
          <View style={{ padding: 24, alignItems: 'center' }}>
            <ThemedText>{!configured ? 'Configure device IP in Settings' : loading ? 'Loading…' : error ? error : 'No active timers'}</ThemedText>
          </View>
        }
        renderItem={({ item }) => (
          <View style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <ThemedText style={{ fontWeight: '600', fontSize: 18 }}>{item.label}</ThemedText>
              <ThemedText style={{ marginLeft: 'auto', fontFamily: 'Menlo', fontSize: 16, opacity: 0.9 }}>{formatRemaining(item.trigger_time, item.type)}</ThemedText>
            </View>
            <View style={{ flexDirection: 'row', marginTop: 6, alignItems: 'center', gap: 8 }}>
              <ThemedText style={{ opacity: 0.8 }}>{item.type}</ThemedText>
            </View>
            <ThemedText style={{ marginTop: 6, opacity: 0.6 }}>
              {item.actions.map(a => `${a.device}: ${a.action}`).join(', ')}
            </ThemedText>
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 10 }}>
              <Pressable
                onPress={async () => {
                  const ok = await remove(item.id);
                  if (!ok) Alert.alert('Timer not found');
                }}
                style={({ pressed }) => [styles.button, { backgroundColor: subtleBg, opacity: pressed ? 0.6 : 1 }]}>
                <ThemedText>Delete</ThemedText>
              </Pressable>
            </View>
          </View>
        )}
      />

      <AddTimerModal
        visible={showAdd}
        onClose={() => setShowAdd(false)}
        onCreate={async (req) => {
          const ok = await create(req);
          if (!ok) Alert.alert('Failed to create');
          else await safeSelectionAsync();
          setShowAdd(false);
        }}
        onTest={async (req) => {
          const ok = await test({ ...req, delay_minutes: 0 });
          if (!ok) Alert.alert('Failed to send test');
          else await safeSelectionAsync();
        }}
      />
      </SafeAreaView>
    </ThemedView>
  );
}

function AddTimerModal(props: { visible: boolean; onClose: () => void; onCreate: (req: { label: string; type: string; delay_minutes: number; actions: ActionDraft[] }) => Promise<void> | void; onTest: (req: { label: string; type: string; delay_minutes: number; actions: ActionDraft[] }) => Promise<void> | void; }) {
  const scheme = useColorScheme() ?? 'light';
  const C = Colors[scheme];
  const insets = useSafeAreaInsets();
  const inputBg = scheme === 'dark' ? '#1E1F20' : '#fff';
  const inputBorder = scheme === 'dark' ? '#2A2D2E' : '#ddd';
  const placeholder = scheme === 'dark' ? '#9BA1A6' : '#687076';
  const segmentBg = scheme === 'dark' ? '#222426' : '#eee';
  const segmentActiveBg = scheme === 'dark' ? '#2C2F31' : '#fff';
  const subtleBg = scheme === 'dark' ? '#222426' : '#eee';
  const dividerColor = scheme === 'dark' ? '#2A2D2E' : '#eee';
  const cardBg = scheme === 'dark' ? '#1E1F20' : '#fff';
  const cardBorder = inputBorder;
  const { settings } = useSettings();
  const api = useMemo(() => makeApi({ baseUrl: settings?.baseUrl, apiKey: settings?.apiKey }), [settings]);
  const [type, setType] = useState<'sleep' | 'wakeup' | 'generic'>('sleep');
  const [label, setLabel] = useState('');
  const [delay, setDelay] = useState(15);
  const [wake, setWake] = useState(getDefaultWake());
  const [device, setDevice] = useState('MyAmp');
  const [action, setAction] = useState('on');
  const [repetitions, setRepetitions] = useState<number | undefined>(undefined);
  const [delayMs, setDelayMs] = useState<number | undefined>(undefined);
  const [actions, setActions] = useState<ActionDraft[]>([]);
  const [devices, setDevices] = useState<string[]>([]);
  const [commands, setCommands] = useState<string[]>([]);

  // Load devices when modal opens
  React.useEffect(() => {
    if (!props.visible) return;
    if (!settings?.baseUrl) { setDevices([]); return; }
    api
      .devices()
      .then((d) => setDevices(Object.keys(d)))
      .catch(() => setDevices([]));
  }, [props.visible, api, settings?.baseUrl]);

  // Load commands when a device is chosen
  React.useEffect(() => {
    if (!props.visible || !device) { setCommands([]); return; }
    api
      .getDevice(device)
      .then((d: any) => {
        const keys = new Set<string>();
        if (d && typeof d === 'object') {
          for (const val of Object.values(d as Record<string, any>)) {
            if (val && typeof val === 'object' && val.commands && typeof val.commands === 'object') {
              for (const k of Object.keys(val.commands)) keys.add(k);
            }
          }
        }
        setCommands(Array.from(keys));
      })
      .catch(() => setCommands([]));
  }, [props.visible, device, api]);

  function genLabel() {
    if (label.trim()) return label.trim();
    if (type === 'sleep') return `Sleep in ${delay} min`;
    if (type === 'wakeup') return `Wake up at ${wake}`;
    return 'Timer';
  }

  function computedDelayMinutes() {
    if (type === 'sleep') return delay;
    if (type === 'wakeup') {
      // wake is HH:mm local
      const [hh, mm] = wake.split(':').map((x) => parseInt(x, 10));
      const now = new Date();
      const when = new Date(now);
      when.setHours(hh, mm, 0, 0);
      if (when.getTime() <= now.getTime()) when.setDate(when.getDate() + 1);
      const mins = Math.max(0, Math.round((when.getTime() - now.getTime()) / 60000));
      return mins;
    }
    return delay;
  }

  const addAction = () => {
    const a: ActionDraft = { device: device.trim(), action: action.trim() };
    if (!a.device || !a.action) return;
    if (repetitions && repetitions > 0) a.repetitions = repetitions;
    if (delayMs && delayMs > 0) a.delay_ms = delayMs;
    setActions((arr) => [...arr, a]);
  };

  const clearForm = () => {
    setType('sleep');
    setLabel('');
    setDelay(15);
    setWake(getDefaultWake());
    setDevice('MyAmp');
    setAction('on');
    setRepetitions(undefined);
    setDelayMs(undefined);
    setActions([]);
  };

  function submit(isTest: boolean) {
    const req = { label: isTest ? `Test Timer (${genLabel()})` : genLabel(), type, delay_minutes: isTest ? 0 : computedDelayMinutes(), actions };
    if (actions.length === 0) { Alert.alert('Please add at least one action'); return; }
    if (isTest) props.onTest(req);
    else props.onCreate(req);
    clearForm();
  }

  return (
    <Modal visible={props.visible} animationType="slide" onRequestClose={props.onClose}>
      <ThemedView style={{ flex: 1 }}>
        <SafeAreaView style={{ flex: 1, paddingTop: insets.top, paddingBottom: insets.bottom }} edges={["top","bottom"]}>
        <View style={[styles.headerRow, { paddingHorizontal: 16 }]}>
          <ThemedText type="title">New Timer</ThemedText>
          <TouchableOpacity style={{ marginLeft: 'auto' }} onPress={props.onClose}><ThemedText>Close</ThemedText></TouchableOpacity>
        </View>

        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20, gap: 12 }}>
          <ThemedText>Label</ThemedText>
          <TextInput
            value={label}
            onChangeText={setLabel}
            placeholder={genLabel()}
            placeholderTextColor={placeholder}
            style={[styles.input, { backgroundColor: inputBg, borderColor: inputBorder, color: C.text }]} />

          <ThemedText>Type</ThemedText>
          <View style={[styles.segmented, { backgroundColor: segmentBg, borderColor: inputBorder, borderWidth: StyleSheet.hairlineWidth }]}>
            {(['wakeup','sleep'] as const).map((t) => (
              <Pressable key={t} onPress={() => setType(t)} style={[styles.segment, type === t && [styles.segmentActive, { backgroundColor: segmentActiveBg }]]}>
                <ThemedText style={{ fontWeight: '600' }}>{t}</ThemedText>
              </Pressable>
            ))}
          </View>

          <View style={{ padding: 12, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: cardBorder, backgroundColor: cardBg }}>
            {type === 'sleep' ? (
              <>
                <ThemedText>Delay (minutes)</ThemedText>
                <TextInput
                  value={String(delay)}
                  onChangeText={(v) => setDelay(Number(v || 0))}
                  keyboardType="number-pad"
                  placeholderTextColor={placeholder}
                  style={[styles.input, { backgroundColor: inputBg, borderColor: inputBorder, color: C.text }]} />
              </>
            ) : (
              <>
                <ThemedText>Wake up time (HH:mm)</ThemedText>
                <TextInput
                  value={wake}
                  onChangeText={setWake}
                  placeholder="07:30"
                  placeholderTextColor={placeholder}
                  style={[styles.input, { backgroundColor: inputBg, borderColor: inputBorder, color: C.text }]} />
              </>
            )}
          </View>

          <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: dividerColor, marginVertical: 8 }} />

          <ThemedText>Build Action</ThemedText>
          {devices.length > 0 ? (
            <View style={styles.wrapList}>
              {devices.map((d) => (
                <TouchableOpacity key={d} onPress={() => setDevice(d)} style={[styles.chip, device === d && styles.chipActive]}>
                  <ThemedText>{d}</ThemedText>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
          <TextInput
            value={device}
            onChangeText={setDevice}
            placeholder="Device name"
            placeholderTextColor={placeholder}
            style={[styles.input, { backgroundColor: inputBg, borderColor: inputBorder, color: C.text }]} />
          {commands.length > 0 ? (
            <View style={styles.wrapList}>
              {commands.map((c) => (
                <TouchableOpacity key={c} onPress={() => setAction(c)} style={[styles.chip, action === c && styles.chipActive]}>
                  <ThemedText>{c}</ThemedText>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
          <TextInput
            value={action}
            onChangeText={setAction}
            placeholder="Action"
            placeholderTextColor={placeholder}
            style={[styles.input, { backgroundColor: inputBg, borderColor: inputBorder, color: C.text }]} />
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TextInput
              value={repetitions ? String(repetitions) : ''}
              onChangeText={(v) => setRepetitions(v ? Number(v) : undefined)}
              placeholder="repetitions (optional)"
              keyboardType="number-pad"
              placeholderTextColor={placeholder}
              style={[styles.input, { flex: 1, backgroundColor: inputBg, borderColor: inputBorder, color: C.text }]} />
            <TextInput
              value={delayMs ? String(delayMs) : ''}
              onChangeText={(v) => setDelayMs(v ? Number(v) : undefined)}
              placeholder="delay ms (optional)"
              keyboardType="number-pad"
              placeholderTextColor={placeholder}
              style={[styles.input, { flex: 1, backgroundColor: inputBg, borderColor: inputBorder, color: C.text }]} />
          </View>
          <TouchableOpacity style={[styles.button, { backgroundColor: subtleBg }]} onPress={addAction}><ThemedText>Add action</ThemedText></TouchableOpacity>

          {actions.length > 0 && (
            <View style={{ gap: 6, marginTop: 6 }}>
              {actions.map((a, i) => (
                <View key={i} style={{ padding: 8, borderRadius: 8, borderColor: inputBorder, borderWidth: 1, backgroundColor: inputBg, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <ThemedText style={{ flex: 1 }}>{a.device}: {a.action} {a.repetitions ? `×${a.repetitions}` : ''} {a.delay_ms ? `(delay ${a.delay_ms}ms)` : ''}</ThemedText>
                  <TouchableOpacity onPress={() => setActions((arr) => arr.filter((_, idx) => idx !== i))} style={[styles.chip, { paddingVertical: 4 }]}>
                    <ThemedText>Remove</ThemedText>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
            <TouchableOpacity style={[styles.button, { backgroundColor: subtleBg }]} onPress={() => submit(true)}>
              <ThemedText>Test</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, { backgroundColor: C.tint }]} onPress={() => submit(false)}>
              <ThemedText style={{ color: scheme === 'dark' ? '#111' : '#fff' }}>Create</ThemedText>
            </TouchableOpacity>
          </View>
        </ScrollView>
        </SafeAreaView>
      </ThemedView>
    </Modal>
  );
}

function getDefaultWake() {
  const d = new Date(Date.now() + 30 * 60000);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 8 },
  card: { padding: 12, borderRadius: 12, borderWidth: 1 },
  button: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 },
  segmented: { flexDirection: 'row', borderRadius: 8, overflow: 'hidden' },
  segment: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  segmentActive: {},
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, backgroundColor: 'rgba(127,127,127,0.12)' },
  chipActive: { backgroundColor: 'rgba(10,126,164,0.25)' },
  wrapList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
