import { Alert, Platform } from 'react-native';

export function prompt(title: string, defaultValue = ''): Promise<string | null> {
  if (Platform.OS === 'ios') {
    return new Promise((resolve) => {
      // @ts-ignore: Alert.prompt exists on iOS
      Alert.prompt(title, undefined, [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
        { text: 'OK', onPress: (value?: string) => resolve(value ?? null) },
      ], 'plain-text', defaultValue);
    });
  }
  if (Platform.OS === 'web') {
    // @ts-ignore window may not be in RN type defs
    const v = (globalThis as any).window?.prompt ? (globalThis as any).window.prompt(title, defaultValue) : null;
    return Promise.resolve(v ?? null);
  }
  // Android fallback - not ideal, but avoids crashing
  return Promise.resolve(defaultValue);
}
