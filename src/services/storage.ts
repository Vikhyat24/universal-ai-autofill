/**
 * Storage service: single gateway to chrome.storage.
 *
 * - Profiles + learned mappings are encrypted at rest (AES-GCM).
 * - Settings + recents are stored plain (non-sensitive, needed synchronously).
 * - The API is async and provider-agnostic: a future CloudSyncProvider can
 *   implement the same StorageBackend interface without touching callers.
 */
import { STORAGE_KEYS, DEFAULT_SETTINGS, MAX_RECENT_FORMS } from '@/shared/constants';
import type { Profile, Settings, LearnedMapping, RecentForm, BackupPayload } from '@/shared/types';
import { encryptJson, decryptJson } from './crypto';

// ---------------------------------------------------------------- profiles

export async function getProfiles(): Promise<Profile[]> {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.PROFILES);
  const raw = stored[STORAGE_KEYS.PROFILES];
  if (!raw) return [];
  if (typeof raw === 'string') {
    return (await decryptJson<Profile[]>(raw)) ?? [];
  }
  return raw as Profile[]; // legacy unencrypted array
}

export async function saveProfiles(profiles: Profile[]): Promise<void> {
  const payload = await encryptJson(profiles);
  await chrome.storage.local.set({ [STORAGE_KEYS.PROFILES]: payload });
}

export async function getProfile(id: string): Promise<Profile | undefined> {
  return (await getProfiles()).find((p) => p.id === id);
}

export async function upsertProfile(profile: Profile): Promise<void> {
  const profiles = await getProfiles();
  const i = profiles.findIndex((p) => p.id === profile.id);
  profile.updatedAt = Date.now();
  if (i >= 0) profiles[i] = profile;
  else profiles.push(profile);
  await saveProfiles(profiles);
}

export async function deleteProfile(id: string): Promise<void> {
  const profiles = (await getProfiles()).filter((p) => p.id !== id);
  await saveProfiles(profiles);
  const settings = await getSettings();
  if (settings.defaultProfileId === id) {
    settings.defaultProfileId = profiles[0]?.id ?? null;
    await saveSettings(settings);
  }
}

// ---------------------------------------------------------------- settings

export async function getSettings(): Promise<Settings> {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS);
  return { ...DEFAULT_SETTINGS, ...(stored[STORAGE_KEYS.SETTINGS] ?? {}) };
}

export async function saveSettings(settings: Settings): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: settings });
}

// ---------------------------------------------------------------- learning

export async function getLearnedMappings(): Promise<LearnedMapping[]> {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.LEARNED);
  const raw = stored[STORAGE_KEYS.LEARNED];
  if (!raw) return [];
  if (typeof raw === 'string') return (await decryptJson<LearnedMapping[]>(raw)) ?? [];
  return raw as LearnedMapping[];
}

export async function saveLearnedMapping(mapping: LearnedMapping): Promise<void> {
  const all = await getLearnedMappings();
  const i = all.findIndex((m) => m.signature === mapping.signature);
  if (i >= 0) {
    all[i] = { ...mapping, votes: all[i].votes + 1, updatedAt: Date.now() };
  } else {
    all.push({ ...mapping, votes: 1, updatedAt: Date.now() });
  }
  // Cap growth: keep the 500 most recently used.
  all.sort((a, b) => b.updatedAt - a.updatedAt);
  await chrome.storage.local.set({ [STORAGE_KEYS.LEARNED]: await encryptJson(all.slice(0, 500)) });
}

export async function clearLearnedMappings(): Promise<void> {
  await chrome.storage.local.remove(STORAGE_KEYS.LEARNED);
}

// ---------------------------------------------------------------- recents

export async function getRecentForms(): Promise<RecentForm[]> {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.RECENT_FORMS);
  return (stored[STORAGE_KEYS.RECENT_FORMS] as RecentForm[]) ?? [];
}

export async function addRecentForm(entry: RecentForm): Promise<void> {
  const all = await getRecentForms();
  const next = [entry, ...all.filter((r) => r.url !== entry.url)].slice(0, MAX_RECENT_FORMS);
  await chrome.storage.local.set({ [STORAGE_KEYS.RECENT_FORMS]: next });
}

// ---------------------------------------------------------------- backup

export async function exportBackup(): Promise<BackupPayload> {
  return {
    version: 1,
    exportedAt: Date.now(),
    profiles: await getProfiles(),
    settings: await getSettings(),
    learned: await getLearnedMappings(),
    recentForms: await getRecentForms(),
  };
}

export async function importBackup(payload: BackupPayload): Promise<void> {
  if (payload.version !== 1) throw new Error(`Unsupported backup version: ${payload.version}`);
  if (!Array.isArray(payload.profiles)) throw new Error('Invalid backup: missing profiles');
  await saveProfiles(payload.profiles);
  if (payload.settings) await saveSettings({ ...DEFAULT_SETTINGS, ...payload.settings });
  if (Array.isArray(payload.learned)) {
    await chrome.storage.local.set({ [STORAGE_KEYS.LEARNED]: await encryptJson(payload.learned) });
  }
  if (Array.isArray(payload.recentForms)) {
    await chrome.storage.local.set({ [STORAGE_KEYS.RECENT_FORMS]: payload.recentForms });
  }
}
