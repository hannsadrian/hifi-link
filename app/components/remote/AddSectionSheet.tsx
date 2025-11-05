import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import React from 'react';
import { Modal, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';

export type AddSectionSheetProps = {
  visible: boolean;
  onClose: () => void;
  onAddAmp: () => void;
  onAddGrid: (rows: number, cols: number) => void;
  onAddCd?: () => void;
};

export function AddSectionSheet({ visible, onClose, onAddAmp, onAddGrid, onAddCd }: AddSectionSheetProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <ThemedView style={styles.sheet}>
          <View style={styles.headerRow}>
            <ThemedText type="subtitle">Add a section</ThemedText>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}><ThemedText>Close</ThemedText></TouchableOpacity>
          </View>

          <ThemedText type="defaultSemiBold">Examples</ThemedText>
          <ScrollView contentContainerStyle={{ gap: 10 }}>
            <TouchableOpacity onPress={onAddCd} style={[styles.option, styles.optionRow]}> 
              <ThemedText>CD Player</ThemedText>
              <View style={styles.previewCard}>
                <View style={[styles.previewRow, { gap: 6 }]}>
                  <View style={styles.previewCircle} />
                  <View style={styles.previewCircle} />
                  <View style={styles.previewCircle} />
                  <View style={styles.previewCircle} />
                  <View style={styles.previewCircle} />
                </View>
              </View>
            </TouchableOpacity>

            <TouchableOpacity onPress={onAddAmp} style={[styles.option, styles.optionRow]}>
              <ThemedText>Amp (atelier R4 preset)</ThemedText>
              <View style={styles.previewCard}>
                <View style={[styles.previewRow, { marginBottom: 4 }]}>
                  <View style={styles.previewChevron} />
                  <View style={styles.previewTitle} />
                  <View style={{ flexDirection: 'row', gap: 4, marginLeft: 'auto' }}>
                    <View style={styles.previewDot} />
                    <View style={styles.previewDot} />
                    <View style={styles.previewDot} />
                  </View>
                </View>
                <View style={styles.previewGrid}>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <View key={i} style={styles.previewCell} />
                  ))}
                </View>
                <View style={[styles.previewRow, { marginTop: 6 }]}>
                  <View style={styles.previewBtn} />
                  <View style={styles.previewLabel} />
                  <View style={styles.previewBtn} />
                </View>
              </View>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => onAddGrid(2, 3)} style={[styles.option, styles.optionRow]}>
              <ThemedText>Grid 2 x 3</ThemedText>
              <View style={styles.previewCard}>
                <View style={styles.previewGrid}>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <View key={i} style={styles.previewCell} />
                  ))}
                </View>
              </View>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => onAddGrid(3, 3)} style={[styles.option, styles.optionRow]}>
              <ThemedText>Grid 3 x 3</ThemedText>
              <View style={styles.previewCard}>
                <View style={styles.previewGrid}>
                  {Array.from({ length: 9 }).map((_, i) => (
                    <View key={i} style={styles.previewCell} />
                  ))}
                </View>
              </View>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => onAddGrid(1, 3)} style={[styles.option, styles.optionRow]}>
              <ThemedText>Grid 1 x 3</ThemedText>
              <View style={styles.previewCard}>
                <View style={styles.previewGrid}>
                  {Array.from({ length: 3 }).map((_, i) => (
                    <View key={i} style={styles.previewCell} />
                  ))}
                </View>
              </View>
            </TouchableOpacity>
          </ScrollView>
        </ThemedView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'flex-end' },
  sheet: { height: '60%', padding: 16, borderTopLeftRadius: 16, borderTopRightRadius: 16, gap: 12 },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  closeBtn: { marginLeft: 'auto' },
  option: { padding: 12, borderRadius: 10, backgroundColor: 'rgba(127,127,127,0.12)' },
  optionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  previewCard: { padding: 6, borderRadius: 8, backgroundColor: 'rgba(127,127,127,0.06)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(127,127,127,0.25)' },
  previewRow: { flexDirection: 'row', alignItems: 'center' },
  previewChevron: { width: 8, height: 8, borderLeftWidth: 1, borderBottomWidth: 1, borderColor: 'rgba(127,127,127,0.6)', transform: [{ rotate: '315deg' }], marginRight: 4 },
  previewTitle: { width: 28, height: 8, borderRadius: 2, backgroundColor: 'rgba(127,127,127,0.35)' },
  previewDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(127,127,127,0.35)' },
  previewGrid: { width: 72, flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
  previewCell: { width: 20, height: 14, borderRadius: 3, backgroundColor: 'rgba(127,127,127,0.25)' },
  previewBtn: { width: 16, height: 16, borderRadius: 8, backgroundColor: 'rgba(127,127,127,0.25)' },
  previewLabel: { width: 28, height: 10, borderRadius: 2, backgroundColor: 'rgba(127,127,127,0.35)', marginHorizontal: 6 },
  previewCircle: { width: 16, height: 16, borderRadius: 8, backgroundColor: 'rgba(127,127,127,0.25)' },
});
