/**
 * Profile domain logic: creation, value lookup with derivation, and the
 * profile→value resolver used by the autofill engine.
 */
import type { Profile, ProfileField, FieldKind } from '@/shared/types';
import { deriveValue, DEFAULT_PROFILE_KINDS } from '@/shared/taxonomy';
import { getProfiles, getSettings } from './storage';

export function createEmptyProfile(name: string, emoji = '👤'): Profile {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    name,
    emoji,
    fields: DEFAULT_PROFILE_KINDS.map((kind): ProfileField => ({ kind, value: '' })),
    createdAt: now,
    updatedAt: now,
  };
}

/** Raw value for a kind (no derivation). */
export function getFieldValue(profile: Profile, kind: FieldKind, customKey?: string): string | undefined {
  const f = profile.fields.find((x) =>
    kind === 'custom'
      ? x.kind === 'custom' && x.customKey?.toLowerCase() === customKey?.toLowerCase()
      : x.kind === kind,
  );
  return f?.value || undefined;
}

/** Value for a kind, deriving from related fields when missing. */
export function resolveValue(profile: Profile, kind: FieldKind, customKey?: string): string | undefined {
  if (kind === 'custom') return getFieldValue(profile, 'custom', customKey);
  return deriveValue(kind, (k) => getFieldValue(profile, k));
}

/** All custom field keys defined in a profile (for the mapper). */
export function customKeys(profile: Profile): string[] {
  return profile.fields
    .filter((f) => f.kind === 'custom' && f.customKey && f.value)
    .map((f) => f.customKey as string);
}

/**
 * Pick the active profile for a hostname:
 *  site preference → explicit id → default profile → first profile.
 */
export async function pickProfile(hostname?: string, explicitId?: string): Promise<Profile | undefined> {
  const [profiles, settings] = await Promise.all([getProfiles(), getSettings()]);
  if (!profiles.length) return undefined;
  if (explicitId) {
    const p = profiles.find((x) => x.id === explicitId);
    if (p) return p;
  }
  if (hostname && settings.siteProfiles[hostname]) {
    const p = profiles.find((x) => x.id === settings.siteProfiles[hostname]);
    if (p) return p;
  }
  if (settings.defaultProfileId) {
    const p = profiles.find((x) => x.id === settings.defaultProfileId);
    if (p) return p;
  }
  return profiles[0];
}
