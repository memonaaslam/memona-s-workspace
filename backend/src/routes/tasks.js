const express = require('express');
const { randomUUID: uuid } = require('crypto');
const { query } = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

router.get('/', async (req, res, next) => {
  try {
    const { filter } = req.query;
    const result = await query(
      'SELECT * FROM tasks WHERE user_id = $1 AND deleted_at IS NULL ORDER BY due_date ASC NULLS LAST',
      [req.userId]
    );
    let rows = result.rows;

    const now = new Date();
    if (filter === 'today') {
      rows = rows.filter((t) => t.due_date && isSameDay(new Date(t.due_date), now));
    } else if (filter === 'overdue') {
      rows = rows.filter((t) => t.due_date && new Date(t.due_date) < now && !t.completed);
    } else if (filter === 'done') {
      rows = rows.filter((t) => t.completed);
    }
    res.json({ tasks: rows });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { title, dueDate, projectTag, remindMinutesBefore, pushEnabled } = req.body;
    if (!title || !title.trim()) return res.status(400).json({ error: 'Task title is required' });

    const id = uuid();
    const now = new Date().toISOString();
    await query(
      `INSERT INTO tasks (id, user_id, title, project_tag, due_date, remind_minutes_before, push_enabled, completed, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, FALSE, $8)`,
      [
        id,
        req.userId,
        title.trim(),
        projectTag || null,
        dueDate || null,
        remindMinutesBefore ?? 30,
        pushEnabled === false ? false : true,
        now,
      ]
    );
    const result = await query('SELECT * FROM tasks WHERE id = $1', [id]);
    res.status(201).json({ task: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const existing = await query(
      'SELECT * FROM tasks WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL',
      [req.params.id, req.userId]
    );
    const task = existing.rows[0];
    if (!task) return res.status(404).json({ error: 'Task not found' });

    const { title, dueDate, projectTag, remindMinutesBefore, pushEnabled, completed } = req.body;
    const newCompleted = completed === undefined ? task.completed : !!completed;
    const completedAt =
      completed === true ? new Date().toISOString() : completed === false ? null : task.completed_at;

    await query(
      `UPDATE tasks SET
         title = $1, due_date = $2, project_tag = $3, remind_minutes_before = $4,
         push_enabled = $5, completed = $6, completed_at = $7
       WHERE id = $8`,
      [
        title ?? task.title,
        dueDate ?? task.due_date,
        projectTag ?? task.project_tag,
        remindMinutesBefore ?? task.remind_minutes_before,
        pushEnabled === undefined ? task.push_enabled : !!pushEnabled,
        newCompleted,
        completedAt,
        req.params.id,
      ]
    );
    const updated = await query('SELECT * FROM tasks WHERE id = $1', [req.params.id]);
    res.json({ task: updated.rows[0] });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const existing = await query(
      'SELECT * FROM tasks WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL',
      [req.params.id, req.userId]
    );
    if (!existing.rows[0]) return res.status(404).json({ error: 'Task not found' });

    await query('UPDATE tasks SET deleted_at = $1 WHERE id = $2', [new Date().toISOString(), req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

module.exports = router;
