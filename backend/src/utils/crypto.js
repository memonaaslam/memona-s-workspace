const crypto = require('crypto');

const ALGO = 'aes-256-gcm';

function deriveKey(masterPassword, saltHex) {
  const salt = Buffer.from(saltHex, 'hex');
  return crypto.pbkdf2Sync(masterPassword, salt, 210000, 32, 'sha256');
}

function generateSalt() {
  return crypto.randomBytes(16).toString('hex');
}

function makeVerifier(masterPassword, saltHex) {
  const key = deriveKey(masterPassword, saltHex);
  return crypto.createHash('sha256').update(key).digest('hex');
}

function checkMasterPassword(masterPassword, saltHex, verifierHex) {
  return makeVerifier(masterPassword, saltHex) === verifierHex;
}

function encrypt(plainText, key) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    ciphertext: encrypted.toString('hex'),
    iv: iv.toString('hex'),
    tag: tag.toString('hex'),
  };
}

function decrypt(ciphertextHex, ivHex, tagHex, key) {
  const decipher = crypto.createDecipheriv(ALGO, key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(ciphertextHex, 'hex')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}

module.exports = { deriveKey, generateSalt, makeVerifier, checkMasterPassword, encrypt, decrypt };
