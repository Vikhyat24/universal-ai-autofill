/** Import/export helpers shared by popup and options. */
import { exportBackup, importBackup } from '@/services/storage';
import { encryptBackup, decryptBackup, isEncryptedBackup } from '@/services/backupCrypto';
import type { BackupPayload } from '@/shared/types';

function saveJson(obj: unknown, suffix: string): void {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `autofill-backup-${new Date().toISOString().slice(0, 10)}${suffix}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function downloadBackup(): Promise<void> {
  saveJson(await exportBackup(), '');
}

/** Export a password-protected (PBKDF2 + AES-GCM) backup file. */
export async function downloadEncryptedBackup(password: string): Promise<void> {
  const envelope = await encryptBackup(await exportBackup(), password);
  saveJson(envelope, '-encrypted');
}

/**
 * Opens a file picker and imports the chosen backup. Plain and password-
 * protected files are both accepted (encrypted ones prompt for the password).
 * Resolves true on success.
 */
export function pickAndImportBackup(): Promise<boolean> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return resolve(false);
      try {
        const parsed = JSON.parse(await file.text()) as unknown;
        let payload: BackupPayload;
        if (isEncryptedBackup(parsed)) {
          const password = prompt('This backup is password-protected. Enter its password:');
          if (!password) return resolve(false);
          payload = await decryptBackup(parsed, password);
        } else {
          payload = parsed as BackupPayload;
        }
        await importBackup(payload);
        resolve(true);
      } catch (e) {
        alert(`Import failed: ${(e as Error).message}`);
        resolve(false);
      }
    };
    input.click();
  });
}
