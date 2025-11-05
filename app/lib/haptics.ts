import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

// Fire-and-forget haptic that safely no-ops when unsupported or on simulator.
export async function safeSelectionAsync() {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return;
  try {
    await Haptics.selectionAsync();
  } catch {
    // Silently ignore haptic errors (e.g., simulator/CoreHaptics not available)
  }
}
