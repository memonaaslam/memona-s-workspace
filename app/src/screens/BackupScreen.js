import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useAuth } from '../AuthContext';
import { api } from '../api';
import { colors, spacing } from '../theme';
import { useGoogleDriveAuth } from '../useGoogleDriveAuth';

export default function BackupScreen() {
  const { logout } = useAuth();
  const { promptAsync } = useGoogleDriveAuth();
  const [backingUp, setBackingUp] = useState(false);
  const [lastBackup, setLastBackup] = useState(null);

  async function connectAndBackup() {
    setBackingUp(true);
    try {
      const accessToken = await promptAsync();
      if (!accessToken) {
        setBackingUp(false);
        return;
      }
      const result = await api.uploadToDrive(accessToken);
      setLastBackup(new Date().toLocaleString());
      Alert.alert('Backup complete', 'Your data has been saved to memonaaslam00@gmail.com on Google Drive.');
    } catch (err) {
      Alert.alert('Backup failed', err.message);
    } finally {
      setBackingUp(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Backup to Google Drive</Text>
      <Text style={styles.body}>
        Backs up your tasks, vault items, and encrypted password vault to memonaaslam00@gmail.com on
        Google Drive. Your passwords stay encrypted in the backup file — Google never sees them in
        plain text.
      </Text>
      <TouchableOpacity style={styles.button} disabled={backingUp} onPress={connectAndBackup}>
        <Text style={styles.buttonText}>{backingUp ? 'Backing up…' : 'Connect & back up now'}</Text>
      </TouchableOpacity>
      {lastBackup ? <Text style={styles.lastBackup}>Last backup: {lastBackup}</Text> : null}

      <View style={styles.divider} />

      <Text style={styles.heading}>Account</Text>
      <TouchableOpacity style={styles.logoutButton} onPress={logout}>
        <Text style={styles.logoutText}>Log out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.xl },
  heading: { color: colors.gold, fontSize: 16, fontWeight: '600', marginBottom: 8 },
  body: { color: colors.textMuted, fontSize: 13, lineHeight: 19, marginBottom: spacing.lg },
  button: { backgroundColor: colors.gold, borderRadius: 10, padding: 14, alignItems: 'center' },
  buttonText: { color: colors.bg, fontWeight: '600' },
  lastBackup: { color: colors.textMuted, fontSize: 12, textAlign: 'center', marginTop: 10 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.xl },
  logoutButton: { borderWidth: 0.5, borderColor: colors.danger, borderRadius: 10, padding: 14, alignItems: 'center' },
  logoutText: { color: colors.danger, fontWeight: '600' },
});
