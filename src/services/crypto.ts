/**
 * At-rest encryption for profile data using WebCrypto (AES-GCM 256).
 *
 * Threat model: protects against casual reads of the extension's storage
 * (e.g. another local user copying the LevelDB files). The key itself is
 * stored in chrome.storage.local, so this is obfuscation-at-rest rather
 * than protection from a fully compromised machine — that would require a
 * user passphrase (planned; the API below already supports swapping the key
 * source without changing callers).
 *
 * All functions are no-network and run in any extension context.
 */
import { STORAGE_KEYS } from '@/shared/constants';

interface CryptoMeta {
  /** Base64 raw AES key. */
  k: string;
  v: 1;
}

const enc = new TextEncoder();
const dec = new TextDecoder();

function b64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
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

let cachedKey: CryptoKey | null = null;

/** Get (or lazily create) the AES-GCM key. */
async function getKey(): Promise<CryptoKey> {
  if (cachedKey) return cachedKey;

  const stored = await chrome.storage.local.get(STORAGE_KEYS.CRYPTO_META);
  const meta = stored[STORAGE_KEYS.CRYPTO_META] as CryptoMeta | undefined;

  if (meta?.k) {
    cachedKey = await crypto.subtle.importKey(
      'raw', unb64(meta.k).buffer as ArrayBuffer, { name: 'AES-GCM' }, true, ['encrypt', 'decrypt'],
    );
    return cachedKey;
  }

  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
    'encrypt',
    'decrypt',
  ]);
  const raw = await crypto.subtle.exportKey('raw', key);
  const newMeta: CryptoMeta = { k: b64(raw), v: 1 };
  await chrome.storage.local.set({ [STORAGE_KEYS.CRYPTO_META]: newMeta });
  cachedKey = key;
  return key;
}

/** Encrypt any JSON-serializable value → "enc:v1:<iv>:<ciphertext>" string. */
export async function encryptJson(value: unknown): Promise<string> {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = enc.encode(JSON.stringify(value));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);
  return `enc:v1:${b64(iv)}:${b64(ct)}`;
}

/** Decrypt a string produced by encryptJson. Passes through plain JSON. */
export async function decryptJson<T>(payload: string): Promise<T | null> {
  try {
    if (!payload.startsWith('enc:v1:')) {
      // Backwards compatibility: unencrypted JSON (pre-encryption installs).
      return JSON.parse(payload) as T;
    }
    const [, , ivB64, ctB64] = payload.split(':');
    const key = await getKey();
    const pt = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: unb64(ivB64) },
      key,
      unb64(ctB64).buffer as ArrayBuffer,
    );
    return JSON.parse(dec.decode(pt)) as T;
  } catch {
    return null;
  }
}
