/**
 * Password-protected backup encryption (PBKDF2 → AES-GCM 256), offline.
 *
 * Unlike services/crypto.ts (at-rest obfuscation with a stored key), this
 * derives the key from a user password that is never stored, so an exported
 * file is safe to keep anywhere. Used by ui/backup.ts for encrypted export.
 */
import type { BackupPayload, EncryptedBackup } from '@/shared/types';

const enc = new TextEncoder();
const dec = new TextDecoder();
const ITERATIONS = 210_000;

function b64(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function unb64(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function deriveKey(password: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptBackup(payload: BackupPayload, password: string): Promise<EncryptedBackup> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt, ITERATIONS);
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(JSON.stringify(payload)),
  );
  return {
    format: 'uaf-encrypted',
    v: 1,
    salt: b64(salt),
    iv: b64(iv),
    iterations: ITERATIONS,
    data: b64(new Uint8Array(ct)),
  };
}

export async function decryptBackup(envelope: EncryptedBackup, password: string): Promise<BackupPayload> {
  const key = await deriveKey(password, unb64(envelope.salt), envelope.iterations);
  try {
    const pt = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: unb64(envelope.iv) },
      key,
      unb64(envelope.data),
    );
    return JSON.parse(dec.decode(pt)) as BackupPayload;
  } catch {
    throw new Error('Wrong password or corrupted file.');
  }
}

export function isEncryptedBackup(value: unknown): value is EncryptedBackup {
  return !!value && typeof value === 'object' && (value as { format?: string }).format === 'uaf-encrypted';
}
