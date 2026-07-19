/** Profiles tab: list, create, edit, delete profiles; manage custom fields. */
import { useEffect, useState } from 'react';
import type { Profile, ProfileField, FieldKind } from '@/shared/types';
import { DEFAULT_PROFILE_KINDS, KIND_LABELS, TAXONOMY } from '@/shared/taxonomy';
import { getProfiles, upsertProfile, deleteProfile } from '@/services/storage';
import { createEmptyProfile } from '@/services/profileService';

const EXAMPLES: Record<string, string> = Object.fromEntries(
  TAXONOMY.map((t) => [t.kind, t.example ?? '']),
);

export function ProfilesTab() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [draft, setDraft] = useState<Profile | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);

  const load = async () => {
    const p = await getProfiles();
    setProfiles(p);
    if (p.length && !p.find((x) => x.id === selectedId)) {
      setSelectedId(p[0].id);
      setDraft(structuredClone(p[0]));
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const select = (p: Profile) => {
    setSelectedId(p.id);
    setDraft(structuredClone(p));
  };

  const addProfile = async () => {
    const name = prompt('Profile name (e.g. Personal, Job Applications):', 'New Profile');
    if (!name) return;
    const p = createEmptyProfile(name);
    await upsertProfile(p);
    await load();
    select(p);
  };

  const removeProfile = async () => {
    if (!draft) return;
    if (!confirm(`Delete profile "${draft.name}"? This cannot be undone.`)) return;
    await deleteProfile(draft.id);
    setDraft(null);
    setSelectedId('');
    await load();
  };

  const save = async () => {
    if (!draft) return;
    await upsertProfile(draft);
    await load();
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1800);
  };

  const setField = (kind: FieldKind, value: string, customKey?: string) => {
    if (!draft) return;
    const next = structuredClone(draft);
    const f = next.fields.find((x) =>
      kind === 'custom' ? x.kind === 'custom' && x.customKey === customKey : x.kind === kind,
    );
    if (f) f.value = value;
    else next.fields.push({ kind, customKey, value });
    setDraft(next);
  };

  const setCustomKey = (index: number, key: string) => {
    if (!draft) return;
    const next = structuredClone(draft);
    const customs = next.fields.filter((f) => f.kind === 'custom');
    if (customs[index]) customs[index].customKey = key;
    setDraft(next);
  };

  const addCustom = () => {
    if (!draft) return;
    const next = structuredClone(draft);
    next.fields.push({ kind: 'custom', customKey: '', value: '' });
    setDraft(next);
  };

  const removeCustom = (index: number) => {
    if (!draft) return;
    const next = structuredClone(draft);
    let seen = -1;
    next.fields = next.fields.filter((f) => {
      if (f.kind !== 'custom') return true;
      seen++;
      return seen !== index;
    });
    setDraft(next);
  };

  const valueOf = (kind: FieldKind): string =>
    draft?.fields.find((f) => f.kind === kind)?.value ?? '';

  const customs: ProfileField[] = draft?.fields.filter((f) => f.kind === 'custom') ?? [];

  return (
    <div className="op-grid">
      <div className="op-plist card" style={{ padding: 12 }}>
        {profiles.map((p) => (
          <button key={p.id} className={`pitem ${p.id === selectedId ? 'active' : ''}`} onClick={() => select(p)}>
            <span>{p.emoji ?? '👤'}</span>
            <span>{p.name}</span>
          </button>
        ))}
        <button className="add primary" onClick={() => void addProfile()}>＋ New profile</button>
      </div>

      {draft ? (
        <div className="op-editor card">
          <div className="head">
            <input
              className="emoji"
              value={draft.emoji ?? '👤'}
              onChange={(e) => setDraft({ ...draft, emoji: e.target.value })}
              maxLength={4}
              title="Emoji"
            />
            <input
              className="name"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="Profile name"
            />
            <button className="danger" onClick={() => void removeProfile()}>Delete</button>
          </div>

          <div className="op-fields">
            {DEFAULT_PROFILE_KINDS.map((kind) => (
              <div className="op-field" key={kind}>
                <label>{KIND_LABELS[kind] ?? kind}</label>
                <input
                  value={valueOf(kind)}
                  placeholder={EXAMPLES[kind] || ''}
                  onChange={(e) => setField(kind, e.target.value)}
                />
              </div>
            ))}

            <div className="op-field wide">
              <label>Custom fields — matched to forms by name (e.g. “Passport Number”)</label>
              <div className="stack">
                {customs.map((f, i) => (
                  <div className="customrow" key={i}>
                    <input
                      className="key"
                      value={f.customKey ?? ''}
                      placeholder="Field name"
                      onChange={(e) => setCustomKey(i, e.target.value)}
                    />
                    <input
                      value={f.value}
                      placeholder="Value"
                      onChange={(e) => setField('custom', e.target.value, f.customKey)}
                    />
                    <button className="del ghost" title="Remove" onClick={() => removeCustom(i)}>🗑</button>
                  </div>
                ))}
                <button onClick={addCustom} style={{ alignSelf: 'flex-start' }}>＋ Add custom field</button>
              </div>
            </div>
          </div>

          <div className="op-save">
            {savedFlash && <span className="saved">✓ Saved</span>}
            <button className="primary" onClick={() => void save()}>Save profile</button>
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding: 40, textAlign: 'center' }}>
          <p className="muted">Create a profile to get started.</p>
        </div>
      )}
    </div>
  );
}
