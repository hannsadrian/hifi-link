import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

export type CdPlayerButton = { title?: string; icon?: string; onPress?: () => void | Promise<void> };

export type CdPlayerSectionProps = {
  title: string;
  collapsed?: boolean;
  onToggle?: () => void;
  buttons: CdPlayerButton[];
  editMode?: boolean;
  onEditTitle?: () => void;
  onDelete?: () => void;
  onStartDrag?: () => void;
  onEditButtonAt?: (idx: number) => void;
};

export function CdPlayerSection({ title, collapsed = false, onToggle, buttons, editMode, onEditTitle, onDelete, onStartDrag, onEditButtonAt }: CdPlayerSectionProps) {
  const theme = useColorScheme() ?? 'light';
  const textColor = theme === 'light' ? Colors.light.text : Colors.dark.text;

  const btns = [...buttons];
  // In edit mode, render one extra "+" placeholder to add a new button
  const showAdd = editMode !== undefined ? editMode : false;

  return (
    <ThemedView style={styles.card}>
      <View style={styles.headerRow}>
        <TouchableOpacity onLongPress={onStartDrag} onPress={onToggle} activeOpacity={0.8} style={styles.headerLeft}>
          <IconSymbol
            // @ts-ignore
            name={'chevron.right' as any}
            size={18}
            color={theme === 'light' ? Colors.light.icon : Colors.dark.icon}
            style={{ transform: [{ rotate: collapsed ? '0deg' : '90deg' }] }}
          />
          <ThemedText type="defaultSemiBold" style={styles.title}>{title}</ThemedText>
          {editMode ? (
            <TouchableOpacity onPress={onEditTitle} style={styles.iconBtn}>
              {/* @ts-ignore */}
              <IconSymbol name={'pencil' as any} size={16} color={theme === 'light' ? Colors.light.icon : Colors.dark.icon} />
            </TouchableOpacity>
          ) : null}
        </TouchableOpacity>
        {editMode ? (
          <TouchableOpacity onPress={onDelete} style={[styles.iconBtn, styles.trash]}>
            {/* @ts-ignore */}
            <IconSymbol name={'trash.fill' as any} size={16} color={'#c53030'} />
          </TouchableOpacity>
        ) : null}
      </View>

      {!collapsed ? (
        <View style={styles.body}>
          <View style={styles.row}>
            {btns.map((b, i) => (
              <View key={`cd-btn-${i}`} style={styles.cell}>
                <TouchableOpacity onPress={editMode ? () => onEditButtonAt?.(i) : (b.onPress ?? (() => {}))} style={styles.circleBtn}>
                  {/* @ts-ignore */}
                  {b.icon ? <IconSymbol name={b.icon as any} size={20} color={textColor} /> : <ThemedText>{b.title ?? ''}</ThemedText>}
                </TouchableOpacity>
                {b.title ? <ThemedText style={styles.caption}>{b.title}</ThemedText> : null}
              </View>
            ))}
            {showAdd ? (
              <View key={'cd-btn-add'} style={styles.cell}>
                <TouchableOpacity onPress={() => onEditButtonAt?.(btns.length)} style={[styles.circleBtn, styles.placeholder]}>
                  <ThemedText>+</ThemedText>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        </View>
      ) : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    backgroundColor: 'rgba(127,127,127,0.06)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(127,127,127,0.25)',
    paddingBottom: 12,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 12 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 18 },
  iconBtn: { marginLeft: 6, padding: 6, borderRadius: 6 },
  trash: { marginLeft: 'auto' },
  body: { paddingHorizontal: 12, paddingTop: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cell: { alignItems: 'center' },
  circleBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(127,127,127,0.12)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(127,127,127,0.25)'
  },
  placeholder: { backgroundColor: 'rgba(127,127,127,0.06)', borderStyle: 'dashed' as any },
  caption: { fontSize: 12, marginTop: 4, opacity: 0.8 },
});
