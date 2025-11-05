import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { safeSelectionAsync } from '@/lib/haptics';
import React from 'react';
import { Pressable, StyleSheet } from 'react-native';

export type RemoteButtonProps = {
  title: string;
  icon?: string; // IconSymbol key, optional
  onPress?: () => Promise<void> | void;
  editMode?: boolean;
  onEdit?: () => void;
};

export function RemoteButton({ title, icon, onPress, editMode, onEdit }: RemoteButtonProps) {
  const allowedIcons = new Set([
    'house.fill',
    'paperplane.fill',
    'chevron.left.forwardslash.chevron.right',
    'chevron.right',
    'chevron.left',
    'plus',
    'minus',
    'speaker.slash.fill',
    // Media controls
    'play.fill',
    'pause.fill',
    'stop.fill',
    'backward.fill',
    'forward.fill',
    'backward.end.fill',
    'forward.end.fill',
    'eject.fill',
  ]);
  const handlePress = async () => {
    if (editMode) return onEdit?.();
    await safeSelectionAsync();
    await onPress?.();
  };

  return (
    <Pressable onPress={handlePress} style={({ pressed }) => [styles.button, pressed && styles.pressed]}> 
      <ThemedView style={styles.inner}>
        {icon && allowedIcons.has(icon) ? (
          // @ts-ignore mapping icon string is limited in IconSymbol typings
          <IconSymbol name={icon as any} size={22} color={Colors.light.text} style={{ marginBottom: 4 }} />
        ) : null}
        <ThemedText style={styles.title}>{title || (editMode ? '+' : '')}</ThemedText>
        {editMode ? <ThemedText style={styles.editHint}>Edit</ThemedText> : null}
      </ThemedView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: 'rgba(127,127,127,0.08)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(127,127,127,0.25)',
  },
  pressed: { opacity: 0.7 },
  inner: { paddingVertical: 12, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center' },
  title: { fontWeight: '600' },
  editHint: { fontSize: 12, opacity: 0.6, marginTop: 4 },
});
