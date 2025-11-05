import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { GridSection } from '@/state/remoteLayout';
import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { ButtonGrid } from './ButtonGrid';

export type RemoteSectionProps = {
  section: GridSection;
  onToggleCollapsed: () => void;
  onPressButton: (idx: number) => void | Promise<void>;
  editMode?: boolean;
  onEditButton?: (idx: number) => void;
  onRename?: () => void;
  onChangeLayout?: () => void;
  onStartDrag?: () => void;
  onDelete?: () => void;
};

export function RemoteSection({
  section,
  onToggleCollapsed,
  onPressButton,
  editMode,
  onEditButton,
  onRename,
  onChangeLayout,
  onStartDrag,
  onDelete,
}: RemoteSectionProps) {
  const theme = useColorScheme() ?? 'light';
  const chevron = (
    <IconSymbol
      name="chevron.right"
      size={18}
      color={theme === 'light' ? Colors.light.icon : Colors.dark.icon}
      style={{ transform: [{ rotate: section.collapsed ? '0deg' : '90deg' }] }}
    />
  );

  return (
    <ThemedView style={styles.container}>
      <TouchableOpacity style={styles.heading} onLongPress={onStartDrag} onPress={onToggleCollapsed} activeOpacity={0.8}>
        {chevron}
        <ThemedText type="defaultSemiBold">{section.title}</ThemedText>
        {editMode ? (
          <TouchableOpacity onPress={onRename} style={styles.iconBtn}>
            {/* @ts-ignore */}
            <IconSymbol name={'pencil' as any} size={16} color={theme === 'light' ? Colors.light.icon : Colors.dark.icon} />
          </TouchableOpacity>
        ) : null}
        {editMode ? (
          <View style={styles.rowActions}>
            <TouchableOpacity onPress={onChangeLayout} style={styles.actionBtn}>
              <ThemedText>Layout</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => onDelete?.()} style={[styles.actionBtn, styles.danger]}>
              {/* @ts-ignore */}
              <IconSymbol name={'trash.fill' as any} size={16} color={'#c53030'} />
            </TouchableOpacity>
          </View>
        ) : null}
      </TouchableOpacity>
      {!section.collapsed ? (
        <ThemedView style={styles.content}>
          {section.layout.type === 'grid' ? (
            <ButtonGrid
              layout={section.layout}
              buttons={section.buttons}
              editMode={editMode}
              onPressAt={onPressButton}
              onEditAt={onEditButton}
            />
          ) : null}
        </ThemedView>
      ) : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 12, marginRight: 16 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  content: { marginTop: 8, marginLeft: 0 },
  rowActions: { marginLeft: 'auto', flexDirection: 'row', gap: 8 },
  iconBtn: { marginLeft: 6, padding: 6, borderRadius: 6 },
  actionBtn: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: 'rgba(127,127,127,0.08)' },
  danger: { backgroundColor: 'rgba(197,48,48,0.1)' },
});
