// Password hashing utilities using expo-crypto.
//
// IMPORTANT (security):
// - Voter credentials are stored in the `users` table. Passwords MUST be
//   salted + hashed before being persisted.
// - The `$` separator is used to mark the salted-hash format. Values written
//   before this utility was introduced may still be plain text; `verifyPassword`
//   degrades gracefully to a legacy plain-text comparison so existing accounts
//   keep working until they change their password.
import * as Crypto from 'expo-crypto';

const SEPARATOR = '$';
const ALGORITHM = Crypto.CryptoDigestAlgorithm.SHA256;

/**
 * Generates a salted SHA-256 hash for a plain-text password.
 * Returns `${salt}$${hash}`.
 */
export const hashPassword = async (plaintext: string): Promise<string> => {
  const salt = Crypto.randomUUID();
  const hash = await Crypto.digestStringAsync(ALGORITHM, `${salt}${SEPARATOR}${plaintext}`);
  return `${salt}${SEPARATOR}${hash}`;
};

/**
 * Verifies a plain-text password against a stored credential.
 * Supports both the new `salt$hash` format and legacy plain-text values.
 */
export const verifyPassword = async (stored: string, plaintext: string): Promise<boolean> => {
  if (!stored || !plaintext) return false;

  const parts = stored.split(SEPARATOR);
  if (parts.length === 2 && parts[0] && parts[1]) {
    const [salt, expectedHash] = parts;
    const actualHash = await Crypto.digestStringAsync(ALGORITHM, `${salt}${SEPARATOR}${plaintext}`);
    return actualHash === expectedHash;
  }

  // Legacy plain-text credential (pre-hashing). Still allow login so existing
  // voters are not locked out, but never store plain text going forward.
  return stored === plaintext;
};
