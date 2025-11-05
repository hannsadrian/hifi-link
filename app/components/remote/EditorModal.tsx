import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { makeApi } from '@/lib/api';
import { useSettings } from '@/state/settings';
import React, { useEffect, useMemo, useState } from 'react';
import { Modal, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';

const ICONS = [
  'speaker.slash.fill',
  'chevron.left',
  'chevron.right',
  'plus',
  'minus',
  'house.fill',
  'paperplane.fill',
  'chevron.left.forwardslash.chevron.right',
  // Media controls
  'play.fill',
  'pause.fill',
  'stop.fill',
  'backward.end.fill',
  'backward.fill',
  'forward.fill',
  'forward.end.fill',
  'eject.fill',
] as const;

export type EditorModalProps = {
  visible: boolean;
  onClose: () => void;
  title: string;
  showTitle?: boolean;
  showIcon?: boolean;
  showRepetitions?: boolean;
  showDevice?: boolean;
  showCommand?: boolean;
  initial: Partial<{ title: string; icon: string; repetitions: number; device: string; command: string }>;
  onSave: (val: { title?: string; icon?: string; repetitions?: number; device?: string; command?: string }) => void;
};

export function EditorModal({ visible, onClose, title, showTitle, showIcon, showRepetitions, showDevice, showCommand, initial, onSave }: EditorModalProps) {
  const { settings } = useSettings();
  const api = useMemo(() => makeApi({ baseUrl: settings?.baseUrl, apiKey: settings?.apiKey }), [settings]);
  const theme = useColorScheme() ?? 'light';
  const textColor = theme === 'light' ? Colors.light.text : Colors.dark.text;
  const placeholderColor = theme === 'light' ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.5)';
  const [name, setName] = useState(initial.title ?? '');
  const [icon, setIcon] = useState(initial.icon ?? '');
  const [repetitions, setRepetitions] = useState<number>(Number.isFinite(initial.repetitions as any) ? Math.max(1, Number(initial.repetitions)) : 1);
  const [device, setDevice] = useState(initial.device ?? '');
  const [command, setCommand] = useState(initial.command ?? '');
  const [devices, setDevices] = useState<string[]>([]);
  const [commands, setCommands] = useState<string[]>([]);

  useEffect(() => {
    if (!visible) return;
    setName(initial.title ?? '');
    setIcon(initial.icon ?? '');
    setRepetitions(Number.isFinite(initial.repetitions as any) ? Math.max(1, Number(initial.repetitions)) : 1);
    setDevice(initial.device ?? '');
    setCommand(initial.command ?? '');
  }, [visible]);

  useEffect(() => {
    if (!visible || !showDevice) return;
    api
      .devices()
      .then((d) => setDevices(Object.keys(d)))
      .catch(() => setDevices([]));
  }, [visible, showDevice]);

  useEffect(() => {
    if (!visible || !showCommand || !device) {
      setCommands([]);
      return;
    }
    api
      .getDevice(device)
      .then((d) => {
        const keys = new Set<string>();
        // Generic extractor: scan top-level protocol objects and pull keys under a `commands` map
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
  }, [visible, showCommand, device]);

  const save = () => {
    onSave({ title: showTitle ? name : undefined, icon: showIcon ? icon : undefined, repetitions: showRepetitions ? Math.max(1, repetitions || 1) : undefined, device: showDevice ? device : undefined, command: showCommand ? command : undefined });
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <ThemedView style={styles.sheet}>
          <View style={styles.headerRow}>
            <ThemedText type="subtitle">{title}</ThemedText>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}><ThemedText>Close</ThemedText></TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ gap: 12 }}>
            {showTitle ? (
              <View style={styles.field}> 
                <ThemedText>Title</ThemedText>
                <TextInput
                  style={[styles.input, theme === 'light' ? styles.inputLight : styles.inputDark, { color: textColor }]}
                  value={name}
                  onChangeText={setName}
                  placeholder="Title"
                  placeholderTextColor={placeholderColor}
                  selectionColor={textColor}
                  keyboardAppearance={theme === 'light' ? 'light' : 'dark'}
                />
              </View>
            ) : null}

            {showIcon ? (
              <View style={styles.field}> 
                <ThemedText>Icon</ThemedText>
                <View style={styles.wrapList}>
                  {ICONS.map((i) => (
                    <TouchableOpacity key={i} onPress={() => setIcon(i)} style={[styles.iconPick, icon === i && styles.iconPickActive]}>
                      {/* @ts-ignore */}
                      <IconSymbol name={i as any} color={textColor} size={20} />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ) : null}

            {showDevice ? (
              <View style={styles.field}> 
                <ThemedText>Device</ThemedText>
                <ScrollView horizontal contentContainerStyle={{ gap: 8 }}>
                  {devices.map((d) => (
                    <TouchableOpacity key={d} onPress={() => setDevice(d)} style={[styles.chip, device === d && styles.chipActive]}>
                      <ThemedText>{d}</ThemedText>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            ) : null}

            {showCommand ? (
              <View style={styles.field}> 
                <ThemedText>Command</ThemedText>
                <View style={styles.wrapList}>
                  {commands.map((c) => (
                    <TouchableOpacity key={c} onPress={() => setCommand(c)} style={[styles.chip, command === c && styles.chipActive]}>
                      <ThemedText>{c}</ThemedText>
                    </TouchableOpacity>
                  ))}
                </View>
                <TextInput
                  style={[styles.input, theme === 'light' ? styles.inputLight : styles.inputDark, { color: textColor }]}
                  value={command}
                  onChangeText={setCommand}
                  placeholder="Or type custom command"
                  placeholderTextColor={placeholderColor}
                  selectionColor={textColor}
                  keyboardAppearance={theme === 'light' ? 'light' : 'dark'}
                />
              </View>
            ) : null}

            {showRepetitions ? (
              <View style={[styles.field, { gap: 6 }]}> 
                <ThemedText>Repeat count</ThemedText>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <TouchableOpacity
                    onPress={() => setRepetitions((r) => Math.max(1, (r ?? 1) - 1))}
                    style={styles.chip}
                  >
                    <ThemedText>-</ThemedText>
                  </TouchableOpacity>
                  <ThemedText type="defaultSemiBold">{repetitions ?? 1}</ThemedText>
                  <TouchableOpacity
                    onPress={() => setRepetitions((r) => Math.min(50, (r ?? 1) + 1))}
                    style={styles.chip}
                  >
                    <ThemedText>+</ThemedText>
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity onPress={save} style={styles.primaryBtn}><ThemedText>Save</ThemedText></TouchableOpacity>
              <TouchableOpacity onPress={onClose} style={styles.button}><ThemedText>Cancel</ThemedText></TouchableOpacity>
            </View>
          </ScrollView>
        </ThemedView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'flex-end' },
  sheet: { height: '70%', padding: 16, borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  closeBtn: { marginLeft: 'auto' },
  field: { gap: 6 },
  input: { borderWidth: StyleSheet.hairlineWidth, padding: 10, borderRadius: 8 },
  inputLight: { backgroundColor: 'rgba(0,0,0,0.03)', borderColor: 'rgba(0,0,0,0.2)' },
  inputDark: { backgroundColor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.18)' },
  button: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, backgroundColor: 'rgba(127,127,127,0.08)' },
  primaryBtn: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, backgroundColor: 'rgba(10,126,164,0.2)' },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, backgroundColor: 'rgba(127,127,127,0.12)' },
  chipActive: { backgroundColor: 'rgba(10,126,164,0.25)' },
  iconPick: { width: 36, height: 36, borderRadius: 8, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(127,127,127,0.12)' },
  iconPickActive: { backgroundColor: 'rgba(10,126,164,0.25)' },
  wrapList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
