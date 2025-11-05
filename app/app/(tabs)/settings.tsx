import ParallaxScrollView from '@/components/parallax-scroll-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { makeApi } from '@/lib/api';
import { useRemoteLayout } from '@/state/remoteLayout';
import { useSettings } from '@/state/settings';
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';

export default function SettingsScreen() {
  const { settings, setSettings } = useSettings();
  const { layout, setLayout } = useRemoteLayout();
  const [baseUrl, setBaseUrl] = useState(settings?.baseUrl ?? '');
  const [apiKey, setApiKey] = useState(settings?.apiKey ?? '');
  const api = useMemo(() => makeApi({ baseUrl, apiKey }), [baseUrl, apiKey]);
  const [devices, setDevices] = useState<string[]>([]);
  const theme = useColorScheme() ?? 'light';
  const placeholderColor = theme === 'light' ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.5)';
  const [deviceCommands, setDeviceCommands] = useState<Record<string, string[]>>({});

  useEffect(() => {
    if (settings) {
      setBaseUrl(settings.baseUrl ?? '');
      setApiKey(settings.apiKey ?? '');
    }
  }, [settings]);

  const save = async () => {
    await setSettings({ baseUrl, apiKey });
    Alert.alert('Saved', 'Settings saved');
  };

  const test = async () => {
    try {
      const health = await api.health();
      Alert.alert('OK', `Connected. IP: ${health.wifi?.ip ?? 'n/a'}`);
    } catch (e: any) {
      Alert.alert('Failed', e?.message ?? String(e));
    }
  };

  const refreshDevices = async () => {
    try {
      const list = await api.devices();
      const names = Object.keys(list);
      setDevices(names);
      // Fetch commands per device
      const entries = await Promise.all(
        names.map(async (name) => {
          try {
            const d = await api.getDevice(name);
            const keys = new Set<string>();
            if (d && typeof d === 'object') {
              for (const val of Object.values(d as Record<string, any>)) {
                if (val && typeof val === 'object' && val.commands && typeof val.commands === 'object') {
                  for (const k of Object.keys(val.commands)) keys.add(k);
                }
              }
            }
            return [name, Array.from(keys)] as const;
          } catch {
            return [name, []] as const;
          }
        })
      );
      setDeviceCommands(Object.fromEntries(entries));
    } catch (e: any) {
      Alert.alert('Failed', e?.message ?? String(e));
    }
  };

  const uploadUiConfig = async () => {
    try {
      const current = await api.getUiConfig().catch(() => ({}));
      const body = current && typeof current === 'object' && Array.isArray((current as any).sections)
        ? (layout ?? { sections: [] })
        : { ...(current && typeof current === 'object' ? current : {}), remoteLayout: layout ?? { sections: [] } };
      await api.putUiConfig(body);
      Alert.alert('Uploaded', 'UI config uploaded to device');
    } catch (e: any) {
      Alert.alert('Upload failed', e?.message ?? String(e));
    }
  };

  const downloadUiConfig = async () => {
    try {
      const cfg = await api.getUiConfig();
      let maybeLayout: any = null;
      if (cfg && typeof cfg === 'object' && Array.isArray((cfg as any).sections)) maybeLayout = cfg;
      else if (cfg && typeof cfg === 'object' && (cfg as any).remoteLayout && Array.isArray((cfg as any).remoteLayout.sections)) maybeLayout = (cfg as any).remoteLayout;
      if (maybeLayout) {
        setLayout(() => maybeLayout);
        Alert.alert('Downloaded', 'UI config downloaded from device');
      } else {
        Alert.alert('No layout', 'No remote layout found in UI config');
      }
    } catch (e: any) {
      Alert.alert('Download failed', e?.message ?? String(e));
    }
  };

  return (
    <ParallaxScrollView headerBackgroundColor={{ light: '#D0D0D0', dark: '#353636' }} headerImage={<ThemedView />}> 
      <ThemedText type="title">Settings</ThemedText>

      <View style={styles.field}> 
        <ThemedText>Base URL (e.g. http://192.168.1.50)</ThemedText>
        <TextInput
          style={[styles.input, theme === 'light' ? styles.inputLight : styles.inputDark, { color: theme === 'light' ? 'black' : 'white' }]}
          placeholder="http://<device-ip>"
          autoCapitalize="none"
          value={baseUrl}
          onChangeText={setBaseUrl}
          placeholderTextColor={placeholderColor}
          selectionColor={theme === 'light' ? 'black' : 'white'}
          keyboardAppearance={theme === 'light' ? 'light' : 'dark'}
        />
      </View>

      <View style={styles.field}> 
        <ThemedText>API Key</ThemedText>
        <TextInput
          style={[styles.input, theme === 'light' ? styles.inputLight : styles.inputDark, { color: theme === 'light' ? 'black' : 'white' }]}
          placeholder="API key"
          autoCapitalize="none"
          value={apiKey}
          onChangeText={setApiKey}
          placeholderTextColor={placeholderColor}
          selectionColor={theme === 'light' ? 'black' : 'white'}
          keyboardAppearance={theme === 'light' ? 'light' : 'dark'}
        />
      </View>

      <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>
        <TouchableOpacity onPress={save} style={styles.button}><ThemedText>Save</ThemedText></TouchableOpacity>
        <TouchableOpacity onPress={test} style={styles.button}><ThemedText>Test connection</ThemedText></TouchableOpacity>
        <TouchableOpacity onPress={refreshDevices} style={styles.button}><ThemedText>List devices</ThemedText></TouchableOpacity>
        <TouchableOpacity onPress={uploadUiConfig} style={styles.button}><ThemedText>Upload UI config</ThemedText></TouchableOpacity>
        <TouchableOpacity onPress={downloadUiConfig} style={styles.button}><ThemedText>Download UI config</ThemedText></TouchableOpacity>
      </View>

      {devices.length ? (
        <View style={{ marginTop: 12, gap: 8 }}>
          <ThemedText type="subtitle">Devices</ThemedText>
          {devices.map((d) => (
            <View key={d} style={{ gap: 4 }}>
              <ThemedText>• {d}</ThemedText>
              {deviceCommands[d]?.length ? (
                <View style={{ marginLeft: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {deviceCommands[d].map((c) => (
                    <View key={c} style={styles.commandChip}><ThemedText>{c}</ThemedText></View>
                  ))}
                </View>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}
    </ParallaxScrollView>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  input: { borderWidth: StyleSheet.hairlineWidth, padding: 12, borderRadius: 8 },
  inputLight: { backgroundColor: 'rgba(0,0,0,0.03)', borderColor: 'rgba(0,0,0,0.2)' },
  inputDark: { backgroundColor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.18)' },
  button: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, backgroundColor: 'rgba(127,127,127,0.08)' },
  commandChip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, backgroundColor: 'rgba(127,127,127,0.12)' },
});
