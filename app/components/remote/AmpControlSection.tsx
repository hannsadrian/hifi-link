import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { PressRepeatButton } from './PressRepeatButton';
import { RemoteButton } from './RemoteButton';

export type QuickButton = { icon: string; onPress: () => void | Promise<void> };
export type GridButton = { title: string; onPress: () => void | Promise<void>; active?: boolean };
export type ControlPair = {
  left: { icon?: string; title?: string; onPress: () => void | Promise<void>; repeat?: boolean };
  label: string;
  right: { icon?: string; title?: string; onPress: () => void | Promise<void>; repeat?: boolean };
};

export type AmpControlSectionProps = {
  title: string;
  collapsed?: boolean;
  onToggle?: () => void;
  quickButtons?: QuickButton[]; // 0-3
  gridButtons: GridButton[]; // 3-9
  controlPairs: ControlPair[]; // expect 2
  editToolbar?: React.ReactNode;
  editMode?: boolean;
  onEditTitle?: () => void;
  onDelete?: () => void;
  onStartDrag?: () => void;
  onEditQuickAt?: (idx: number) => void;
  onEditGridAt?: (idx: number) => void;
  onEditControl?: (pairIndex: number, side: 'left' | 'right' | 'label') => void;
};

export function AmpControlSection({ title, collapsed = false, onToggle, quickButtons = [], gridButtons, controlPairs, editToolbar, editMode, onEditTitle, onDelete, onStartDrag, onEditQuickAt, onEditGridAt, onEditControl }: AmpControlSectionProps) {
  const theme = useColorScheme() ?? 'light';

  const rows: GridButton[][] = [];
  const cols = 3;
  for (let i = 0; i < gridButtons.length; i += cols) rows.push(gridButtons.slice(i, i + cols));

  return (
    <ThemedView style={styles.card}>
      <View style={styles.headerRow}>
        <TouchableOpacity onLongPress={onStartDrag} onPress={onToggle} activeOpacity={0.8} style={styles.headerLeft}>
          <IconSymbol
            name="chevron.right"
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
        <View style={styles.quickRow}>
          {(editMode ? [0,1,2] : quickButtons.map((_,i)=>i)).map((i) => {
            const btn = quickButtons[i];
            if (!btn && !editMode) return null;
            const handlePress = editMode ? () => onEditQuickAt?.(i) : (btn?.onPress ?? (() => {}));
            return (
              <TouchableOpacity key={i} onPress={handlePress} style={[styles.quickButton, !btn && editMode && styles.placeholder]}>
                {/* @ts-ignore */}
                {btn ? <IconSymbol name={btn.icon as any} size={18} color={theme === 'light' ? Colors.light.text : Colors.dark.text} /> : <ThemedText>+</ThemedText>}
              </TouchableOpacity>
            );
          })}
        </View>
        {editMode ? (
          <TouchableOpacity onPress={onDelete} style={[styles.iconBtn, styles.trash]}>
            {/* @ts-ignore */}
            <IconSymbol name={'trash.fill' as any} size={16} color={'#c53030'} />
          </TouchableOpacity>
        ) : null}
      </View>

      {!collapsed ? (
        <View style={styles.body}>
          {editToolbar ? <View style={styles.editToolbar}>{editToolbar}</View> : null}
          {/* Grid */}
          <View style={styles.grid}>
            {rows.map((row, rIdx) => (
              <View key={`row-${rIdx}`} style={styles.gridRow}>
                {row.map((btn, cIdx) => {
                  const idx = rIdx * cols + cIdx;
                  return (
                    <View key={`cell-${rIdx}-${cIdx}`} style={styles.gridCell}>
                      <RemoteButton title={btn.title} onPress={btn.onPress} editMode={editMode} onEdit={() => onEditGridAt?.(idx)} />
                    </View>
                  );
                })}
                {row.length < 3 && Array.from({ length: 3 - row.length }, (_, k) => (
                  <View key={`pad-${k}`} style={styles.gridCell} />
                ))}
              </View>
            ))}
          </View>

          {/* Control pairs */}
          <View style={styles.controlsRow}>
            {controlPairs[0] ? (
              <View style={styles.controlPair}>
                {controlPairs[0].left.repeat ? (
                  <PressRepeatButton onActivate={editMode ? () => onEditControl?.(0, 'left') : controlPairs[0].left.onPress} style={styles.controlBtn}>
                    {/* @ts-ignore */}
                    <IconSymbol name={(controlPairs[0].left.icon ?? 'chevron.left') as any} size={18} color={theme === 'light' ? Colors.light.text : Colors.dark.text} />
                  </PressRepeatButton>
                ) : (
                  <TouchableOpacity onPress={editMode ? () => onEditControl?.(0, 'left') : controlPairs[0].left.onPress} style={styles.controlBtn}>
                    {/* @ts-ignore */}
                    <IconSymbol name={(controlPairs[0].left.icon ?? 'chevron.left') as any} size={18} color={theme === 'light' ? Colors.light.text : Colors.dark.text} />
                  </TouchableOpacity>
                )}
                {editMode ? (
                  <TouchableOpacity onPress={() => onEditControl?.(0, 'label')}>
                    <ThemedText style={styles.controlLabel}>{controlPairs[0].label}</ThemedText>
                  </TouchableOpacity>
                ) : (
                  <ThemedText style={styles.controlLabel}>{controlPairs[0].label}</ThemedText>
                )}
                {controlPairs[0].right.repeat ? (
                  <PressRepeatButton onActivate={editMode ? () => onEditControl?.(0, 'right') : controlPairs[0].right.onPress} style={styles.controlBtn}>
                    {/* @ts-ignore */}
                    <IconSymbol name={(controlPairs[0].right.icon ?? 'chevron.right') as any} size={18} color={theme === 'light' ? Colors.light.text : Colors.dark.text} />
                  </PressRepeatButton>
                ) : (
                  <TouchableOpacity onPress={editMode ? () => onEditControl?.(0, 'right') : controlPairs[0].right.onPress} style={styles.controlBtn}>
                    {/* @ts-ignore */}
                    <IconSymbol name={(controlPairs[0].right.icon ?? 'chevron.right') as any} size={18} color={theme === 'light' ? Colors.light.text : Colors.dark.text} />
                  </TouchableOpacity>
                )}
              </View>
            ) : null}

            <View style={{ flex: 1 }} />

            {controlPairs[1] ? (
              <View style={styles.controlPair}>
                {controlPairs[1].left.repeat ? (
                  <PressRepeatButton onActivate={editMode ? () => onEditControl?.(1, 'left') : controlPairs[1].left.onPress} style={styles.controlBtn}>
                    {/* @ts-ignore */}
                    <IconSymbol name={(controlPairs[1].left.icon ?? 'minus') as any} size={18} color={theme === 'light' ? Colors.light.text : Colors.dark.text} />
                  </PressRepeatButton>
                ) : (
                  <TouchableOpacity onPress={editMode ? () => onEditControl?.(1, 'left') : controlPairs[1].left.onPress} style={styles.controlBtn}>
                    {/* @ts-ignore */}
                    <IconSymbol name={(controlPairs[1].left.icon ?? 'minus') as any} size={18} color={theme === 'light' ? Colors.light.text : Colors.dark.text} />
                  </TouchableOpacity>
                )}
                {editMode ? (
                  <TouchableOpacity onPress={() => onEditControl?.(1, 'label')}>
                    <ThemedText style={styles.controlLabel}>{controlPairs[1].label}</ThemedText>
                  </TouchableOpacity>
                ) : (
                  <ThemedText style={styles.controlLabel}>{controlPairs[1].label}</ThemedText>
                )}
                {controlPairs[1].right.repeat ? (
                  <PressRepeatButton onActivate={editMode ? () => onEditControl?.(1, 'right') : controlPairs[1].right.onPress} style={styles.controlBtn}>
                    {/* @ts-ignore */}
                    <IconSymbol name={(controlPairs[1].right.icon ?? 'plus') as any} size={18} color={theme === 'light' ? Colors.light.text : Colors.dark.text} />
                  </PressRepeatButton>
                ) : (
                  <TouchableOpacity onPress={editMode ? () => onEditControl?.(1, 'right') : controlPairs[1].right.onPress} style={styles.controlBtn}>
                    {/* @ts-ignore */}
                    <IconSymbol name={(controlPairs[1].right.icon ?? 'plus') as any} size={18} color={theme === 'light' ? Colors.light.text : Colors.dark.text} />
                  </TouchableOpacity>
                )}
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
    paddingBottom: 16,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 12 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 18 },
  quickRow: { marginLeft: 'auto', flexDirection: 'row', gap: 6 },
  iconBtn: { marginLeft: 6, padding: 6, borderRadius: 6 },
  trash: { marginLeft: 8 },
  quickButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(127,127,127,0.12)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(127,127,127,0.25)'
  },
  placeholder: { backgroundColor: 'rgba(127,127,127,0.06)', borderStyle: 'dashed' as any },
  body: { paddingHorizontal: 12, paddingTop: 12 },
  editToolbar: { marginBottom: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  grid: { gap: 12 },
  gridRow: { flexDirection: 'row', gap: 12 },
  gridCell: { flex: 1 },
  controlsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  controlPair: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  controlBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(127,127,127,0.12)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(127,127,127,0.25)'
  },
  controlLabel: { fontSize: 15, fontWeight: '500' },
});
