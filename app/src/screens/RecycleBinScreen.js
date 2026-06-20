import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api';
import { colors, spacing } from '../theme';

const TYPE_LABEL = { task: 'Task', vault_item: 'Vault item', password: 'Saved login' };

export default function RecycleBinScreen() {
  const [items, setItems] = useState([]);

  const load = useCallback(async () => {
    try {
      const data = await api.recycleBin();
      setItems(data.items);
    } catch (err) {
      Alert.alert('Could not load recycle bin', err.message);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function restore(item) {
    try {
      await api.restoreFromRecycleBin(item.type, item.id);
      load();
    } catch (err) {
      Alert.alert('Could not restore', err.message);
    }
  }

  async function deleteForever(item) {
    Alert.alert('Delete permanently?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete forever',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.permanentlyDelete(item.type, item.id);
            load();
          } catch (err) {
            Alert.alert('Could not delete', err.message);
          }
        },
      },
    ]);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.note}>Items here are auto-deleted forever after 30 days.</Text>
      <FlatList
        data={items}
        keyExtractor={(item) => `${item.type}-${item.id}`}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.meta}>{TYPE_LABEL[item.type]}</Text>
            </View>
            <TouchableOpacity onPress={() => restore(item)}>
              <Text style={styles.restoreText}>Restore</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => deleteForever(item)} style={{ marginLeft: 14 }}>
              <Text style={styles.deleteText}>Delete forever</Text>
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>Recycle bin is empty.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg },
  note: { color: colors.textMuted, fontSize: 12, marginBottom: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: 10, padding: 12, marginBottom: 8 },
  title: { color: colors.text, fontSize: 14 },
  meta: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  restoreText: { color: colors.gold, fontSize: 12 },
  deleteText: { color: colors.danger, fontSize: 12 },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: 30 },
});
