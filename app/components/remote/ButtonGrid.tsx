import { ButtonConfig, LayoutPreset } from '@/state/remoteLayout';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { RemoteButton } from './RemoteButton';

export type ButtonGridProps = {
  layout: Extract<LayoutPreset, { type: 'grid' }>;
  buttons: ButtonConfig[];
  onPressAt: (idx: number) => void | Promise<void>;
  editMode?: boolean;
  onEditAt?: (idx: number) => void;
};

export function ButtonGrid({ layout, buttons, onPressAt, editMode, onEditAt }: ButtonGridProps) {
  const total = layout.rows * layout.cols;
  const padded = [...buttons];
  for (let i = padded.length; i < total; i++) {
    // placeholder with empty title; '+' is shown only in edit mode
    padded.push({ id: `empty-${i}`, title: '', device: '', command: '' });
  }

  const rows = Array.from({ length: layout.rows }, (_, r) =>
    padded.slice(r * layout.cols, r * layout.cols + layout.cols)
  );

  return (
    <View style={styles.grid}>
      {rows.map((row, rIdx) => (
        <View key={`row-${rIdx}`} style={styles.row}>
          {row.map((btn, cIdx) => {
            const idx = rIdx * layout.cols + cIdx;
            return (
              <View key={btn.id} style={[styles.cell, { flexBasis: `${100 / layout.cols}%` }]}> 
                <RemoteButton
                  title={btn.title || (editMode ? '+' : '')}
                  icon={btn.icon}
                  editMode={editMode}
                  onPress={() => onPressAt(idx)}
                  onEdit={() => onEditAt?.(idx)}
                />
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { gap: 8 },
  row: { flexDirection: 'row', gap: 8 },
  cell: { flexGrow: 1 },
});
