// HA-Hub v1.11 — symmetric encryption for stored Home Assistant long-lived tokens.
//
// A Home Assistant long-lived access token is a full-admin credential for that
// client's home. It must never sit in the database as plain text, never be sent
// to the browser, and never appear in a log line or an export.
//
// Key material: TOKEN_ENCRYPTION_KEY if set, otherwise JWT_SECRET (which the
// server already guarantees exists and is >= 32 chars). Deriving from JWT_SECRET
// means existing installs get encryption with no .env edit — install.sh preserves
// an existing .env, so a mandatory new variable would break every upgrade.
//
// Consequence worth knowing: rotating JWT_SECRET makes stored tokens
// undecryptable. That is handled as DECRYPT_FAILED, not as a crash — the client
// falls back to unauthenticated polling and the UI asks for the token again.

const crypto = require('crypto');

const ALGO = 'aes-256-gcm';
const KDF_SALT = 'ha-hub.token-encryption.v1';
const PREFIX = 'v1';

let cachedKey = null;

function getKey() {
  if (cachedKey) return cachedKey;
  const material = process.env.TOKEN_ENCRYPTION_KEY || process.env.JWT_SECRET;
  if (!material) throw new Error('No key material available for token encryption');
  cachedKey = crypto.scryptSync(material, KDF_SALT, 32);
  return cachedKey;
}

/**
 * Encrypt a secret for storage. Returns a self-describing string:
 *   v1.<iv>.<authTag>.<ciphertext>   (all base64url)
 */
function encryptSecret(plain) {
  if (plain === null || plain === undefined || plain === '') return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    PREFIX,
    iv.toString('base64url'),
    tag.toString('base64url'),
    enc.toString('base64url'),
  ].join('.');
}

/**
 * Decrypt a stored secret. Returns null on any failure (wrong key, tampering,
 * corrupt value) rather than throwing — callers treat null as "no usable token".
 */
function decryptSecret(blob) {
  if (!blob) return null;
  try {
    const parts = String(blob).split('.');
    if (parts.length !== 4 || parts[0] !== PREFIX) return null;
    const [, ivB64, tagB64, dataB64] = parts;
    const decipher = crypto.createDecipheriv(ALGO, getKey(), Buffer.from(ivB64, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64url'));
    const out = Buffer.concat([
      decipher.update(Buffer.from(dataB64, 'base64url')),
      decipher.final(),
    ]);
    return out.toString('utf8');
  } catch (_) {
    return null;
  }
}

/**
 * Last 6 characters of a token, stored in plain text purely so the UI can show
 * the operator which token is on file without decrypting anything. Six trailing
 * characters of a JWT signature are not usable material on their own.
 */
function tokenHint(plain) {
  if (!plain) return null;
  const s = String(plain).trim();
  return s.length <= 6 ? '••••••' : s.slice(-6);
}

/** Shape a hint for display: ••••••a1b2c3 */
function maskFromHint(hint) {
  return hint ? `••••••${hint}` : null;
}

module.exports = { encryptSecret, decryptSecret, tokenHint, maskFromHint };
