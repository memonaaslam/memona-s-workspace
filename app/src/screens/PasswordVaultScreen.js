import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, Alert } from 'react-native';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import { colors, spacing } from '../theme';

export default function PasswordVaultScreen() {
  const { masterPasswordSet, setMasterPasswordSet } = useAuth();
  const [unlocked, setUnlocked] = useState(false);
  const [masterPassword, setMasterPassword] = useState('');
  const [setupPassword, setSetupPassword] = useState('');
  const [items, setItems] = useState([]);
  const [revealed, setRevealed] = useState({});

  const [newTitle, setNewTitle] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');

  async function setupMaster() {
    if (setupPassword.length < 8) {
      Alert.alert('Master password too short', 'Use at least 8 characters.');
      return;
    }
    try {
      await api.setupMasterPassword(setupPassword);
      setMasterPasswordSet(true);
      Alert.alert('Master password set', 'Use it to unlock your vault any time.');
    } catch (err) {
      Alert.alert('Could not set master password', err.message);
    }
  }

  async function unlock() {
    if (!masterPassword) return;
    try {
      const data = await api.listPasswords(masterPassword);
      setItems(data.items);
      setUnlocked(true);
    } catch (err) {
      Alert.alert('Could not unlock vault', err.message);
    }
  }

  async function addPassword() {
    if (!newTitle.trim() || !newPassword) {
      Alert.alert('Add a title and password first');
      return;
    }
    try {
      await api.createPassword({ title: newTitle.trim(), username: newUsername.trim(), password: newPassword }, masterPassword);
      setNewTitle('');
      setNewUsername('');
      setNewPassword('');
      const data = await api.listPasswords(masterPassword);
      setItems(data.items);
    } catch (err) {
      Alert.alert('Could not save', err.message);
    }
  }

  async function removePassword(id) {
    try {
      await api.deletePassword(id);
      const data = await api.listPasswords(masterPassword);
      setItems(data.items);
    } catch (err) {
      Alert.alert('Could not delete', err.message);
    }
  }

  if (!masterPasswordSet) {
    return (
      <View style={styles.container}>
        <Text style={styles.lockTitle}>Set up your password vault</Text>
        <Text style={styles.lockSubtitle}>
          This master password encrypts everything stored here. It is never saved anywhere — if you forget it,
          even Memona's Workspace cannot recover your saved passwords.
        </Text>
        <TextInput
          style={styles.input}
          placeholder="Choose a master password"
          placeholderTextColor={colors.textMuted}
          secureTextEntry
          value={setupPassword}
          onChangeText={setSetupPassword}
        />
        <TouchableOpacity style={styles.unlockButton} onPress={setupMaster}>
          <Text style={styles.unlockButtonText}>Create master password</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!unlocked) {
    return (
      <View style={styles.container}>
        <Text style={styles.lockTitle}>Vault locked</Text>
        <Text style={styles.lockSubtitle}>Enter your master password to view saved logins.</Text>
        <TextInput
          style={styles.input}
          placeholder="Master password"
          placeholderTextColor={colors.textMuted}
          secureTextEntry
          value={masterPassword}
          onChangeText={setMasterPassword}
        />
        <TouchableOpacity style={styles.unlockButton} onPress={unlock}>
          <Text style={styles.unlockButtonText}>Unlock</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.itemRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemTitle}>{item.title}</Text>
              {item.username ? <Text style={styles.itemMeta}>{item.username}</Text> : null}
              <Text style={styles.password}>
                {revealed[item.id] ? item.password : '••••••••••'}
              </Text>
            </View>
            <TouchableOpacity onPress={() => setRevealed((r) => ({ ...r, [item.id]: !r[item.id] }))}>
              <Text style={styles.linkText}>{revealed[item.id] ? 'Hide' : 'Show'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => removePassword(item.id)} style={{ marginLeft: 12 }}>
              <Text style={styles.deleteText}>Delete</Text>
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No saved logins yet.</Text>}
      />

      <View style={styles.addBox}>
        <TextInput style={styles.input} placeholder="Title (e.g. Gmail)" placeholderTextColor={colors.textMuted} value={newTitle} onChangeText={setNewTitle} />
        <TextInput style={styles.input} placeholder="Username / email" placeholderTextColor={colors.textMuted} value={newUsername} onChangeText={setNewUsername} />
        <TextInput style={styles.input} placeholder="Password" placeholderTextColor={colors.textMuted} secureTextEntry value={newPassword} onChangeText={setNewPassword} />
        <TouchableOpacity style={styles.addButton} onPress={addPassword}>
          <Text style={styles.addButtonText}>Save login</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg },
  lockTitle: { color: colors.gold, fontSize: 18, fontWeight: '600', marginTop: 40, textAlign: 'center' },
  lockSubtitle: { color: colors.textMuted, fontSize: 13, textAlign: 'center', marginVertical: 14, paddingHorizontal: 10 },
  input: {
    backgroundColor: colors.card,
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    color: colors.text,
    marginBottom: 10,
  },
  unlockButton: { backgroundColor: colors.gold, borderRadius: 10, padding: 14, alignItems: 'center' },
  unlockButtonText: { color: colors.bg, fontWeight: '600' },
  itemRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: 10, padding: 12, marginBottom: 8 },
  itemTitle: { color: colors.text, fontSize: 14 },
  itemMeta: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  password: { color: colors.gold, fontSize: 13, marginTop: 4, fontFamily: 'monospace' },
  linkText: { color: colors.gold, fontSize: 12 },
  deleteText: { color: colors.danger, fontSize: 12 },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: 30 },
  addBox: { backgroundColor: 'rgba(201,168,76,0.07)', borderRadius: 12, padding: 12, marginTop: spacing.sm },
  addButton: { backgroundColor: colors.gold, borderRadius: 8, padding: 10, alignItems: 'center' },
  addButtonText: { color: colors.bg, fontWeight: '600', fontSize: 13 },
});
