/** Import/export helpers shared by popup and options. */
import { exportBackup, importBackup } from '@/services/storage';
import type { BackupPayload } from '@/shared/types';

export async function downloadBackup(): Promise<void> {
  const payload = await exportBackup();
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `autofill-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Opens a file picker and imports the chosen backup. Resolves true on success. */
export function pickAndImportBackup(): Promise<boolean> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return resolve(false);
      try {
        const payload = JSON.parse(await file.text()) as BackupPayload;
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
