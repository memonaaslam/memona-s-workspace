const express = require('express');
const { randomUUID: uuid } = require('crypto');
const { query } = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

async function buildBackupPayload(userId) {
  const userResult = await query('SELECT email, created_at, master_salt FROM users WHERE id = $1', [userId]);
  const user = userResult.rows[0];

  const tasksResult = await query('SELECT * FROM tasks WHERE user_id = $1 AND deleted_at IS NULL', [userId]);
  const vaultResult = await query(
    'SELECT id, item_type, title, text_value, file_name, mime_type, tags, created_at FROM vault_items WHERE user_id = $1 AND deleted_at IS NULL',
    [userId]
  );
  const pwdResult = await query(
    'SELECT id, title, username, url, notes, enc_password, enc_iv, enc_tag, created_at FROM password_items WHERE user_id = $1 AND deleted_at IS NULL',
    [userId]
  );

  return {
    exportedAt: new Date().toISOString(),
    app: 'Memonas Workspace',
    version: 1,
    user: { email: user.email },
    tasks: tasksResult.rows,
    vaultItems: vaultResult.rows,
    encryptedPasswords: pwdResult.rows,
  };
}

router.get('/export', async (req, res, next) => {
  try {
    const payload = await buildBackupPayload(req.userId);
    res.setHeader('Content-Disposition', 'attachment; filename="memonas-workspace-backup.json"');
    res.json(payload);
  } catch (err) {
    next(err);
  }
});

router.post('/drive/upload', async (req, res, next) => {
  try {
    const { accessToken } = req.body;
    if (!accessToken) return res.status(400).json({ error: 'Google Drive access token is required' });

    const payload = await buildBackupPayload(req.userId);
    const fileName = `memonas-workspace-backup-${Date.now()}.json`;
    const boundary = uuid();
    const metadata = { name: fileName, mimeType: 'application/json' };

    const body =
      `--${boundary}\r\n` +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      `${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\n` +
      'Content-Type: application/json\r\n\r\n' +
      `${JSON.stringify(payload)}\r\n` +
      `--${boundary}--`;

    const driveRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    });
    const driveData = await driveRes.json();
    if (!driveRes.ok) {
      return res.status(driveRes.status).json({ error: driveData.error?.message || 'Google Drive upload failed' });
    }

    const id = uuid();
    await query(
      'INSERT INTO backups (id, user_id, provider, remote_file_id, status, created_at) VALUES ($1, $2, $3, $4, $5, $6)',
      [id, req.userId, 'google_drive', driveData.id, 'success', new Date().toISOString()]
    );

    res.json({ ok: true, driveFileId: driveData.id });
  } catch (err) {
    if (err.message && err.message.includes('fetch')) {
      return res.status(500).json({ error: 'Could not reach Google Drive', detail: err.message });
    }
    next(err);
  }
});

router.get('/history', async (req, res, next) => {
  try {
    const result = await query('SELECT * FROM backups WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20', [
      req.userId,
    ]);
    res.json({ backups: result.rows });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
