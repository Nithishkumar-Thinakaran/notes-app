const crypto = require('crypto');
const bcrypt = require('bcryptjs');

/**
 * Generate a secure URL-safe token
 * Uses crypto.randomBytes for cryptographic security
 */
const generateToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Generate a human-readable access key for password-protected links
 * Format: XXXX-XXXX-XXXX (alphanumeric, easy to type)
 */
const generateAccessKey = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed confusing chars: O,0,I,1
  const segment = () =>
    Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `${segment()}-${segment()}-${segment()}`;
};

/**
 * Hash an access key/password for storage
 */
const hashPassword = async (password) => {
  return bcrypt.hash(password, 12);
};

/**
 * Compare an access key/password against its hash
 */
const comparePassword = async (password, hash) => {
  return bcrypt.compare(password, hash);
};

/**
 * Check if a share token is valid (not expired, not revoked, not used)
 * Returns { valid: bool, reason: string }
 */
const validateShareToken = (shareToken) => {
  if (!shareToken) {
    return { valid: false, reason: 'invalid_token' };
  }

  if (shareToken.isRevoked) {
    return { valid: false, reason: 'revoked' };
  }

  if (new Date() > new Date(shareToken.expiresAt)) {
    return { valid: false, reason: 'expired' };
  }

  if (shareToken.shareType === 'one-time' && shareToken.isUsed) {
    return { valid: false, reason: 'already_used' };
  }

  return { valid: true, reason: null };
};

module.exports = {
  generateToken,
  generateAccessKey,
  hashPassword,
  comparePassword,
  validateShareToken
};
