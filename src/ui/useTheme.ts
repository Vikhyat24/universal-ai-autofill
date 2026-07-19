/** Applies the user's theme setting to the document (popup/options). */
import { useEffect, useState } from 'react';
import { getSettings } from '@/services/storage';
import type { ThemeMode } from '@/shared/types';

export function applyTheme(mode: ThemeMode): void {
  const dark =
    mode === 'dark' ||
    (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
}

export function useTheme(): [ThemeMode, (m: ThemeMode) => void] {
  const [mode, setMode] = useState<ThemeMode>('system');

  useEffect(() => {
    void getSettings().then((s) => {
      setMode(s.theme);
      applyTheme(s.theme);
    });
  }, []);

  const update = (m: ThemeMode) => {
    setMode(m);
    applyTheme(m);
  };
  return [mode, update];
}
