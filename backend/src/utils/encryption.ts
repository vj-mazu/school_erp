import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-32-char-key-for-encryption'; // Must be 32 bytes
const IV_LENGTH = 16; // For AES, this is always 16

export function encrypt(text: string): string {
  if (!text) return '';
  // Ensure key is exactly 32 bytes
  const key = crypto.createHash('sha256').update(String(ENCRYPTION_KEY)).digest();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

export function decrypt(text: string): string {
  if (!text) return '';
  const key = crypto.createHash('sha256').update(String(ENCRYPTION_KEY)).digest();
  const textParts = text.split(':');
  const ivPart = textParts.shift();
  if (!ivPart) return '';
  const iv = Buffer.from(ivPart, 'hex');
  const encryptedText = Buffer.from(textParts.join(':'), 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}

export function maskAadhaar(aadhaar: string): string {
  if (!aadhaar || aadhaar.length < 4) return 'XXXXXXXX';
  return 'XXXXXXXX' + aadhaar.slice(-4);
}
