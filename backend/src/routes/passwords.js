const express = require('express');
const { randomUUID: uuid } = require('crypto');
const { query } = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { deriveKey, checkMasterPassword, encrypt, decrypt } = require('../utils/crypto');

const router = express.Router();
router.use(authMiddleware);

async function getKeyOrFail(req, res) {
  const masterPassword = req.body.masterPassword !== undefined ? req.body.masterPassword : req.query.masterPassword;
  const result = await query('SELECT * FROM users WHERE id = $1', [req.userId]);
  const user = result.rows[0];
  if (!user.master_salt) {
    res.status(400).json({ error: 'Set up your master password first' });
    return null;
  }
  if (!masterPassword) {
    res.status(401).json({ error: 'Master password required to access the vault' });
    return null;
  }
  if (!checkMasterPassword(masterPassword, user.master_salt, user.master_verifier)) {
    res.status(401).json({ error: 'Incorrect master password' });
    return null;
  }
  return deriveKey(masterPassword, user.master_salt);
}

router.post('/list', async (req, res, next) => {
  try {
    const key = await getKeyOrFail(req, res);
    if (!key) return;

    const result = await query(
      'SELECT * FROM password_items WHERE user_id = $1 AND deleted_at IS NULL ORDER BY title ASC',
      [req.userId]
    );

    const items = result.rows.map((r) => ({
      id: r.id,
      title: r.title,
      username: r.username,
      url: r.url,
      notes: r.notes,
      password: decrypt(r.enc_password, r.enc_iv, r.enc_tag, key),
      createdAt: r.created_at,
    }));
    res.json({ items });
  } catch (err) {
    next(err);
  }
});

router.post('/create', async (req, res, next) => {
  try {
    const { title, username, url, notes, password } = req.body;
    if (!title || !password) return res.status(400).json({ error: 'Title and password are required' });

    const key = await getKeyOrFail(req, res);
    if (!key) return;

    const { ciphertext, iv, tag } = encrypt(password, key);
    const id = uuid();
    const now = new Date().toISOString();
    await query(
      `INSERT INTO password_items
       (id, user_id, title, username, url, notes, enc_password, enc_iv, enc_tag, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [id, req.userId, title, username || null, url || null, notes || null, ciphertext, iv, tag, now, now]
    );
    res.status(201).json({ id });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/update', async (req, res, next) => {
  try {
    const existing = await query(
      'SELECT * FROM password_items WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL',
      [req.params.id, req.userId]
    );
    const item = existing.rows[0];
    if (!item) return res.status(404).json({ error: 'Item not found' });

    const key = await getKeyOrFail(req, res);
    if (!key) return;

    const { title, username, url, notes, password } = req.body;
    let encPassword = item.enc_password,
      encIv = item.enc_iv,
      encTag = item.enc_tag;
    if (password) {
      const enc = encrypt(password, key);
      encPassword = enc.ciphertext;
      encIv = enc.iv;
      encTag = enc.tag;
    }
    await query(
      `UPDATE password_items SET title=$1, username=$2, url=$3, notes=$4, enc_password=$5, enc_iv=$6, enc_tag=$7, updated_at=$8
       WHERE id = $9`,
      [
        title ?? item.title,
        username ?? item.username,
        url ?? item.url,
        notes ?? item.notes,
        encPassword,
        encIv,
        encTag,
        new Date().toISOString(),
        req.params.id,
      ]
    );
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/delete', async (req, res, next) => {
  try {
    const existing = await query(
      'SELECT * FROM password_items WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL',
      [req.params.id, req.userId]
    );
    if (!existing.rows[0]) return res.status(404).json({ error: 'Item not found' });

    await query('UPDATE password_items SET deleted_at = $1 WHERE id = $2', [
      new Date().toISOString(),
      req.params.id,
    ]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
