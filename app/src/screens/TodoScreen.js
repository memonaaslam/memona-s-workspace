import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import { api } from '../api';
import { colors, spacing } from '../theme';

const FILTERS = ['all', 'today', 'overdue', 'done'];

export default function TodoScreen() {
  const [tasks, setTasks] = useState([]);
  const [filter, setFilter] = useState('all');
  const [title, setTitle] = useState('');
  const [projectTag, setProjectTag] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await api.listTasks(filter === 'all' ? undefined : filter);
      setTasks(data.tasks);
    } catch (err) {
      Alert.alert('Could not load tasks', err.message);
    }
  }, [filter]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function scheduleReminder(task) {
    if (!task.due_date || !task.push_enabled) return;
    const trigger = new Date(task.due_date).getTime() - task.remind_minutes_before * 60 * 1000;
    if (trigger <= Date.now()) return;
    try {
      await Notifications.scheduleNotificationAsync({
        content: { title: 'Task reminder', body: task.title },
        trigger: new Date(trigger),
      });
    } catch {
      // Notifications may be unavailable in some environments (e.g. web) — fail silently.
    }
  }

  async function addTask() {
    if (!title.trim()) {
      Alert.alert('Add a task name first');
      return;
    }
    try {
      const { task } = await api.createTask({
        title: title.trim(),
        projectTag: projectTag.trim() || undefined,
        dueDate: undefined,
      });
      setTitle('');
      setProjectTag('');
      await scheduleReminder(task);
      load();
    } catch (err) {
      Alert.alert('Could not add task', err.message);
    }
  }

  async function toggleComplete(task) {
    try {
      await api.updateTask(task.id, { completed: !task.completed });
      load();
    } catch (err) {
      Alert.alert('Could not update task', err.message);
    }
  }

  async function removeTask(id) {
    try {
      await api.deleteTask(id);
      load();
    } catch (err) {
      Alert.alert('Could not delete task', err.message);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f}
            onPress={() => setFilter(f)}
            style={[styles.filterPill, filter === f && styles.filterPillActive]}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={tasks}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.taskRow}>
            <TouchableOpacity
              style={[styles.checkbox, item.completed ? styles.checkboxDone : null]}
              onPress={() => toggleComplete(item)}
            />
            <View style={{ flex: 1 }}>
              <Text style={[styles.taskTitle, item.completed && styles.taskTitleDone]}>{item.title}</Text>
              {item.project_tag ? <Text style={styles.taskMeta}>{item.project_tag}</Text> : null}
            </View>
            <TouchableOpacity onPress={() => removeTask(item.id)}>
              <Text style={styles.deleteText}>Delete</Text>
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No tasks here yet.</Text>}
      />

      <View style={styles.addBox}>
        <TextInput
          style={styles.input}
          placeholder="Task name"
          placeholderTextColor={colors.textMuted}
          value={title}
          onChangeText={setTitle}
        />
        <TextInput
          style={styles.input}
          placeholder="Project tag (optional)"
          placeholderTextColor={colors.textMuted}
          value={projectTag}
          onChangeText={setProjectTag}
        />
        <TouchableOpacity style={styles.addButton} onPress={addTask}>
          <Text style={styles.addButtonText}>Add task</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg },
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: spacing.md },
  filterPill: { borderWidth: 0.5, borderColor: colors.border, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 12 },
  filterPillActive: { borderColor: colors.goldBorder, backgroundColor: 'rgba(201,168,76,0.12)' },
  filterText: { color: colors.textMuted, fontSize: 12 },
  filterTextActive: { color: colors.gold },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.card,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  checkbox: { width: 18, height: 18, borderRadius: 5, borderWidth: 1.5, borderColor: colors.gold },
  checkboxDone: { backgroundColor: colors.gold },
  taskTitle: { color: colors.text, fontSize: 14 },
  taskTitleDone: { color: colors.textMuted, textDecorationLine: 'line-through' },
  taskMeta: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  deleteText: { color: colors.danger, fontSize: 12 },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: 30 },
  addBox: { backgroundColor: 'rgba(201,168,76,0.07)', borderRadius: 12, padding: 12, marginTop: spacing.sm },
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
