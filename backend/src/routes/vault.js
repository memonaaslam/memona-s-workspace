const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { randomUUID: uuid } = require('crypto');
const { query } = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => cb(null, `${uuid()}-${file.originalname}`),
});
const upload = multer({ storage, limits: { fileSize: 200 * 1024 * 1024 } });

const VALID_TYPES = ['pdf', 'link', 'email', 'video', 'note', 'other'];

router.get('/', async (req, res, next) => {
  try {
    const { type, search } = req.query;
    const result = await query(
      'SELECT * FROM vault_items WHERE user_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC',
      [req.userId]
    );
    let rows = result.rows;

    if (type && VALID_TYPES.includes(type)) {
      rows = rows.filter((r) => r.item_type === type);
    }
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          (r.text_value && r.text_value.toLowerCase().includes(q)) ||
          (r.tags && r.tags.toLowerCase().includes(q))
      );
    }
    res.json({ items: rows });
  } catch (err) {
    next(err);
  }
});

router.post('/file', upload.single('file'), async (req, res, next) => {
  try {
    const { title, itemType, tags } = req.body;
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const id = uuid();
    const now = new Date().toISOString();
    const finalType = VALID_TYPES.includes(itemType) ? itemType : 'other';
    await query(
      `INSERT INTO vault_items
       (id, user_id, item_type, title, file_path, file_name, mime_type, file_size, tags, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        id,
        req.userId,
        finalType,
        title || req.file.originalname,
        req.file.path,
        req.file.originalname,
        req.file.mimetype,
        req.file.size,
        tags || null,
        now,
        now,
      ]
    );
    const result = await query('SELECT * FROM vault_items WHERE id = $1', [id]);
    res.status(201).json({ item: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

router.post('/text', async (req, res, next) => {
  try {
    const { title, itemType, textValue, tags } = req.body;
    if (!title || !textValue) return res.status(400).json({ error: 'Title and content are required' });
    if (!VALID_TYPES.includes(itemType)) return res.status(400).json({ error: 'Invalid item type' });

    const id = uuid();
    const now = new Date().toISOString();
    await query(
      `INSERT INTO vault_items (id, user_id, item_type, title, text_value, tags, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [id, req.userId, itemType, title, textValue, tags || null, now, now]
    );
    const result = await query('SELECT * FROM vault_items WHERE id = $1', [id]);
    res.status(201).json({ item: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

router.get('/:id/download', async (req, res, next) => {
  try {
    const result = await query(
      'SELECT * FROM vault_items WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL',
      [req.params.id, req.userId]
    );
    const item = result.rows[0];
    if (!item) return res.status(404).json({ error: 'Item not found' });
    if (!item.file_path || !fs.existsSync(item.file_path)) {
      return res.status(404).json({ error: 'No file attached to this item' });
    }
    res.download(item.file_path, item.file_name);
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const existing = await query(
      'SELECT * FROM vault_items WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL',
      [req.params.id, req.userId]
    );
    const item = existing.rows[0];
    if (!item) return res.status(404).json({ error: 'Item not found' });

    const { title, textValue, tags } = req.body;
    await query('UPDATE vault_items SET title = $1, text_value = $2, tags = $3, updated_at = $4 WHERE id = $5', [
      title ?? item.title,
      textValue ?? item.text_value,
      tags ?? item.tags,
      new Date().toISOString(),
      req.params.id,
    ]);
    const updated = await query('SELECT * FROM vault_items WHERE id = $1', [req.params.id]);
    res.json({ item: updated.rows[0] });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const existing = await query(
      'SELECT * FROM vault_items WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL',
      [req.params.id, req.userId]
    );
    if (!existing.rows[0]) return res.status(404).json({ error: 'Item not found' });

    await query('UPDATE vault_items SET deleted_at = $1 WHERE id = $2', [new Date().toISOString(), req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
