import React, { useCallback, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, Alert, Linking } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import { api } from '../api';
import { colors, spacing } from '../theme';

const TYPES = ['all', 'pdf', 'link', 'email', 'video', 'note', 'other'];

export default function VaultScreen() {
  const [items, setItems] = useState([]);
  const [type, setType] = useState('all');
  const [search, setSearch] = useState('');
  const [linkTitle, setLinkTitle] = useState('');
  const [linkValue, setLinkValue] = useState('');

  const load = useCallback(async () => {
    try {
      const params = {};
      if (type !== 'all') params.type = type;
      if (search) params.search = search;
      const data = await api.listVault(params);
      setItems(data.items);
    } catch (err) {
      Alert.alert('Could not load vault', err.message);
    }
  }, [type, search]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function pickAndUpload() {
    const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
    if (result.canceled) return;
    const file = result.assets[0];
    const formData = new FormData();
    formData.append('title', file.name);
    formData.append('itemType', file.mimeType?.includes('pdf') ? 'pdf' : file.mimeType?.includes('video') ? 'video' : 'other');
    formData.append('file', { uri: file.uri, name: file.name, type: file.mimeType || 'application/octet-stream' });
    try {
      await api.uploadVaultFile(formData);
      load();
    } catch (err) {
      Alert.alert('Upload failed', err.message);
    }
  }

  async function addLinkOrNote() {
    if (!linkTitle.trim() || !linkValue.trim()) {
      Alert.alert('Add a title and a value first');
      return;
    }
    try {
      await api.createVaultText({
        title: linkTitle.trim(),
        itemType: linkValue.startsWith('http') ? 'link' : 'note',
        textValue: linkValue.trim(),
      });
      setLinkTitle('');
      setLinkValue('');
      load();
    } catch (err) {
      Alert.alert('Could not save', err.message);
    }
  }

  async function removeItem(id) {
    try {
      await api.deleteVaultItem(id);
      load();
    } catch (err) {
      Alert.alert('Could not delete', err.message);
    }
  }

  function openItem(item) {
    if (item.file_path) {
      Linking.openURL(api.downloadUrl(item.id));
    } else if (item.text_value?.startsWith('http')) {
      Linking.openURL(item.text_value);
    } else {
      Alert.alert(item.title, item.text_value || 'No content');
    }
  }

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.searchInput}
        placeholder="Search your vault"
        placeholderTextColor={colors.textMuted}
        value={search}
        onChangeText={setSearch}
        onSubmitEditing={load}
      />
      <View style={styles.filterRow}>
        {TYPES.map((t) => (
          <TouchableOpacity
            key={t}
            onPress={() => setType(t)}
            style={[styles.filterPill, type === t && styles.filterPillActive]}
          >
            <Text style={[styles.filterText, type === t && styles.filterTextActive]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.itemRow} onPress={() => openItem(item)}>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemTitle}>{item.title}</Text>
              <Text style={styles.itemMeta}>{item.item_type}</Text>
            </View>
            <TouchableOpacity onPress={() => removeItem(item.id)}>
              <Text style={styles.deleteText}>Delete</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={styles.empty}>Nothing saved here yet.</Text>}
      />

      <View style={styles.addBox}>
        <TouchableOpacity style={styles.uploadButton} onPress={pickAndUpload}>
          <Text style={styles.uploadButtonText}>Upload a file (PDF, video, etc.)</Text>
        </TouchableOpacity>
        <TextInput
          style={styles.input}
          placeholder="Title (e.g. Gmail login link)"
          placeholderTextColor={colors.textMuted}
          value={linkTitle}
          onChangeText={setLinkTitle}
        />
        <TextInput
          style={styles.input}
          placeholder="Link, email, or note text"
          placeholderTextColor={colors.textMuted}
          value={linkValue}
          onChangeText={setLinkValue}
        />
        <TouchableOpacity style={styles.addButton} onPress={addLinkOrNote}>
          <Text style={styles.addButtonText}>Save</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg },
  searchInput: {
    backgroundColor: colors.card,
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: spacing.md },
  filterPill: { borderWidth: 0.5, borderColor: colors.border, borderRadius: 8, paddingVertical: 5, paddingHorizontal: 10 },
  filterPillActive: { borderColor: colors.goldBorder, backgroundColor: 'rgba(201,168,76,0.12)' },
  filterText: { color: colors.textMuted, fontSize: 11 },
  filterTextActive: { color: colors.gold },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  itemTitle: { color: colors.text, fontSize: 14 },
  itemMeta: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  deleteText: { color: colors.danger, fontSize: 12 },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: 30 },
  addBox: { backgroundColor: 'rgba(201,168,76,0.07)', borderRadius: 12, padding: 12, marginTop: spacing.sm },
  uploadButton: { borderWidth: 0.5, borderColor: colors.goldBorder, borderRadius: 8, padding: 10, alignItems: 'center', marginBottom: 8 },
  uploadButtonText: { color: colors.gold, fontSize: 13 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 10,
    color: colors.text,
    marginBottom: 8,
    fontSize: 13,
  },
  addButton: { backgroundColor: colors.gold, borderRadius: 8, padding: 10, alignItems: 'center' },
  addButtonText: { color: colors.bg, fontWeight: '600', fontSize: 13 },
});
