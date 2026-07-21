/** Storage keys — single source of truth for chrome.storage layout. */
export const STORAGE_KEYS = {
  PROFILES: 'uaf_profiles',
  SETTINGS: 'uaf_settings',
  LEARNED: 'uaf_learned',
  RECENT_FORMS: 'uaf_recent_forms',
  STATS: 'uaf_stats',
  CRYPTO_META: 'uaf_crypto_meta',
} as const;

import type { Settings } from './types';

export const DEFAULT_SETTINGS: Settings = {
  aiMappingEnabled: true,
  theme: 'system',
  defaultProfileId: null,
  ignoredHosts: [],
  autofillOnLoad: false,
  confirmBeforeFill: false,
  showFloatingButton: true,
  smartLearning: true,
  siteProfiles: {},
  siteRules: {},
  encryptionEnabled: true,
};

/** Minimum confidence (0..1) to auto-fill a field without review. */
export const FILL_CONFIDENCE_THRESHOLD = 0.45;

/** Max recent-form entries kept. */
export const MAX_RECENT_FORMS = 20;

/** Debounce (ms) for MutationObserver re-scans. */
export const MUTATION_DEBOUNCE_MS = 400;

export const EXT_PREFIX = 'uaf'; // css/dom namespace for injected UI
