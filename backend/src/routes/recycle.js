const express = require('express');
const fs = require('fs');
const { query } = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

const TABLES = { task: 'tasks', vault_item: 'vault_items', password: 'password_items' };

router.get('/', async (req, res, next) => {
  try {
    const taskRows = await query(
      'SELECT id, title, deleted_at FROM tasks WHERE user_id = $1 AND deleted_at IS NOT NULL',
      [req.userId]
    );
    const vaultRows = await query(
      'SELECT id, title, deleted_at FROM vault_items WHERE user_id = $1 AND deleted_at IS NOT NULL',
      [req.userId]
    );
    const pwdRows = await query(
      'SELECT id, title, deleted_at FROM password_items WHERE user_id = $1 AND deleted_at IS NOT NULL',
      [req.userId]
    );

    const all = [
      ...taskRows.rows.map((t) => ({ ...t, type: 'task' })),
      ...vaultRows.rows.map((v) => ({ ...v, type: 'vault_item' })),
      ...pwdRows.rows.map((p) => ({ ...p, type: 'password' })),
    ].sort((a, b) => new Date(b.deleted_at) - new Date(a.deleted_at));

    res.json({ items: all });
  } catch (err) {
    next(err);
  }
});

router.post('/:type/:id/restore', async (req, res, next) => {
  try {
    const table = TABLES[req.params.type];
    if (!table) return res.status(400).json({ error: 'Invalid item type' });

    const existing = await query(
      `SELECT * FROM ${table} WHERE id = $1 AND user_id = $2 AND deleted_at IS NOT NULL`,
      [req.params.id, req.userId]
    );
    if (!existing.rows[0]) return res.status(404).json({ error: 'Item not found in recycle bin' });

    await query(`UPDATE ${table} SET deleted_at = NULL WHERE id = $1`, [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.delete('/:type/:id', async (req, res, next) => {
  try {
    const table = TABLES[req.params.type];
    if (!table) return res.status(400).json({ error: 'Invalid item type' });

    const existing = await query(
      `SELECT * FROM ${table} WHERE id = $1 AND user_id = $2 AND deleted_at IS NOT NULL`,
      [req.params.id, req.userId]
    );
    const row = existing.rows[0];
    if (!row) return res.status(404).json({ error: 'Item not found in recycle bin' });

    if (table === 'vault_items' && row.file_path && fs.existsSync(row.file_path)) {
      fs.unlinkSync(row.file_path);
    }
    await query(`DELETE FROM ${table} WHERE id = $1`, [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

async function purgeOldItems(daysOld = 30) {
  const cutoff = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000).toISOString();
  for (const table of Object.values(TABLES)) {
    const result = await query(`SELECT * FROM ${table} WHERE deleted_at IS NOT NULL AND deleted_at < $1`, [
      cutoff,
    ]);
    for (const row of result.rows) {
      if (table === 'vault_items' && row.file_path && fs.existsSync(row.file_path)) {
        fs.unlinkSync(row.file_path);
      }
      await query(`DELETE FROM ${table} WHERE id = $1`, [row.id]);
    }
  }
}

module.exports = { router, purgeOldItems };
