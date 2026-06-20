const express = require('express');
const bcrypt = require('bcryptjs');
const { randomUUID: uuid } = require('crypto');
const { query } = require('../db');
const { signToken, authMiddleware } = require('../middleware/auth');
const { generateSalt, makeVerifier, checkMasterPassword } = require('../utils/crypto');

const router = express.Router();

router.post('/signup', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

    const existing = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length) return res.status(409).json({ error: 'An account with this email already exists' });

    const id = uuid();
    const passwordHash = bcrypt.hashSync(password, 10);
    await query('INSERT INTO users (id, email, password_hash, created_at) VALUES ($1, $2, $3, $4)', [
      id,
      email.toLowerCase(),
      passwordHash,
      new Date().toISOString(),
    ]);

    const token = signToken(id);
    res.json({ token, userId: id, masterPasswordSet: false });
  } catch (err) {
    next(err);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const result = await query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });

    const ok = bcrypt.compareSync(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid email or password' });

    const token = signToken(user.id);
    res.json({ token, userId: user.id, masterPasswordSet: !!user.master_salt });
  } catch (err) {
    next(err);
  }
});

router.post('/master-password/setup', authMiddleware, async (req, res, next) => {
  try {
    const { masterPassword } = req.body;
    if (!masterPassword || masterPassword.length < 8) {
      return res.status(400).json({ error: 'Master password must be at least 8 characters' });
    }
    const result = await query('SELECT * FROM users WHERE id = $1', [req.userId]);
    const user = result.rows[0];
    if (user.master_salt) return res.status(409).json({ error: 'Master password already set' });

    const salt = generateSalt();
    const verifier = makeVerifier(masterPassword, salt);
    await query('UPDATE users SET master_salt = $1, master_verifier = $2 WHERE id = $3', [
      salt,
      verifier,
      req.userId,
    ]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.post('/master-password/unlock', authMiddleware, async (req, res, next) => {
  try {
    const { masterPassword } = req.body;
    const result = await query('SELECT * FROM users WHERE id = $1', [req.userId]);
    const user = result.rows[0];
    if (!user.master_salt) return res.status(400).json({ error: 'Master password not set up yet' });

    const valid = checkMasterPassword(masterPassword, user.master_salt, user.master_verifier);
    if (!valid) return res.status(401).json({ error: 'Incorrect master password' });

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
