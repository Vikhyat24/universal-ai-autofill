/** Import tab: build a profile from a résumé (PDF / DOCX / TXT / pasted text). */
import { useState } from 'react';
import type { Profile, FieldKind } from '@/shared/types';
import { PROFILE_SECTIONS, KIND_LABELS } from '@/shared/taxonomy';
import { getProfiles, upsertProfile } from '@/services/storage';
import { createEmptyProfile } from '@/services/profileService';
import { readResumeText, ACCEPTED_FILE_TYPES, type ResumeSource } from '@/services/resume/readers';
import { extractResume } from '@/services/resume/extract';

type Extracted = Partial<Record<FieldKind, string>>;

/** Apply extracted values onto a profile (in place). */
function applyFields(profile: Profile, fields: Extracted, overwrite: boolean): number {
  let applied = 0;
  for (const [k, value] of Object.entries(fields) as [FieldKind, string][]) {
    if (!value) continue;
    const existing = profile.fields.find((f) => f.kind === k);
    if (existing) {
      if (overwrite || !existing.value) {
        existing.value = value;
        applied++;
      }
    } else {
      profile.fields.push({ kind: k, value });
      applied++;
    }
  }
  return applied;
}

export function ImportTab() {
  const [pasted, setPasted] = useState('');
  const [fileName, setFileName] = useState('');
  const [busy, setBusy] = useState(false);
  const [raw, setRaw] = useState('');
  const [showRaw, setShowRaw] = useState(false);
  const [extracted, setExtracted] = useState<Extracted | null>(null);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [dragOver, setDragOver] = useState(false);

  // merge controls
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [mergeTarget, setMergeTarget] = useState('');
  const [overwrite, setOverwrite] = useState(false);

  const flash = (kind: 'ok' | 'err', text: string) => {
    setMsg({ kind, text });
    if (kind === 'ok') setTimeout(() => setMsg(null), 4000);
  };

  const runExtract = async (src: ResumeSource) => {
    setBusy(true);
    setMsg(null);
    setExtracted(null);
    try {
      const text = await readResumeText(src);
      if (!text.trim()) throw new Error('No text found. If this is a scanned PDF, paste the text instead.');
      const result = extractResume(text);
      const found = Object.keys(result.fields).length;
      if (!found) throw new Error('Could not recognize any fields. Try pasting the text, then edit below.');
      setRaw(result.raw);
      setExtracted(result.fields);
      setProfiles(await getProfiles());
      flash('ok', `Extracted ${found} field${found === 1 ? '' : 's'} — review, then create or merge.`);
    } catch (e) {
      flash('err', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setFileName(file.name);
    setPasted('');
    await runExtract({ kind: 'file', file });
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    void onFile(e.dataTransfer.files?.[0]);
  };

  const editValue = (kind: FieldKind, value: string) => {
    setExtracted((prev) => ({ ...prev, [kind]: value }));
  };

  const cleaned = (): Extracted => {
    const out: Extracted = {};
    for (const [k, v] of Object.entries(extracted ?? {}) as [FieldKind, string][]) {
      if (v && v.trim()) out[k] = v.trim();
    }
    return out;
  };

  const createNew = async () => {
    const fields = cleaned();
    const suggested = fields.fullName ?? 'Imported Résumé';
    const name = prompt('Name for the new profile:', suggested);
    if (!name) return;
    const profile = createEmptyProfile(name, '📄');
    applyFields(profile, fields, true);
    await upsertProfile(profile);
    flash('ok', `Created profile “${name}”. Open the Profiles tab to review it.`);
    setExtracted(null);
    setRaw('');
    setFileName('');
  };

  const mergeInto = async () => {
    if (!mergeTarget) return flash('err', 'Pick a profile to merge into.');
    const all = await getProfiles();
    const target = all.find((p) => p.id === mergeTarget);
    if (!target) return flash('err', 'That profile no longer exists.');
    const applied = applyFields(target, cleaned(), overwrite);
    await upsertProfile(target);
    flash('ok', `Merged ${applied} field${applied === 1 ? '' : 's'} into “${target.name}”.`);
    setExtracted(null);
  };

  // group extracted fields by section for the review grid
  const sectionsWithData = PROFILE_SECTIONS
    .map((s) => ({ title: s.title, kinds: s.kinds.filter((k) => extracted && k in extracted) }))
    .filter((s) => s.kinds.length > 0);

  return (
    <div className="op-import">
      {msg && <div className={`imp-msg ${msg.kind}`}>{msg.text}</div>}

      <div className="card imp-intro">
        <h3>📄 Import from résumé</h3>
        <p>
          Drop a <b>PDF</b>, <b>DOCX</b> or <b>TXT</b> résumé, or paste its text. Everything is
          parsed on your device — nothing is uploaded. Review the extracted fields, then create a
          new profile or merge them into an existing one.
        </p>

        <label
          className={`imp-drop ${dragOver ? 'over' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
        >
          <input
            type="file"
            accept={ACCEPTED_FILE_TYPES}
            onChange={(e) => void onFile(e.target.files?.[0] ?? undefined)}
            hidden
          />
          <span className="imp-drop-icon">⬆</span>
          <span>{busy ? 'Reading…' : fileName || 'Click to choose a file or drag it here'}</span>
          <span className="muted" style={{ fontSize: 11 }}>PDF · DOCX · TXT</span>
        </label>

        <div className="imp-or">or paste text</div>
        <textarea
          className="imp-paste"
          value={pasted}
          onChange={(e) => setPasted(e.target.value)}
          placeholder="Paste the full text of your résumé here…"
        />
        <button
          className="primary"
          disabled={busy || !pasted.trim()}
          onClick={() => void runExtract({ kind: 'text', text: pasted })}
          style={{ alignSelf: 'flex-start' }}
        >
          {busy ? 'Extracting…' : 'Extract fields'}
        </button>
      </div>

      {extracted && (
        <div className="card imp-review">
          <h3>Review extracted fields</h3>
          {sectionsWithData.map((section) => (
            <div className="op-section" key={section.title}>
              <h4 className="op-section-title">{section.title}</h4>
              <div className="op-fields">
                {section.kinds.map((kind) => (
                  <div className="op-field" key={kind}>
                    <label>{KIND_LABELS[kind] ?? kind}</label>
                    <input
                      value={extracted[kind] ?? ''}
                      onChange={(e) => editValue(kind, e.target.value)}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}

          {raw && (
            <div className="imp-rawtoggle">
              <button className="ghost" onClick={() => setShowRaw((v) => !v)}>
                {showRaw ? 'Hide' : 'Show'} extracted text
              </button>
              {showRaw && <pre className="imp-raw">{raw}</pre>}
            </div>
          )}

          <div className="imp-actions">
            <button className="primary" onClick={() => void createNew()}>＋ Create new profile</button>
            <span className="muted">or</span>
            <select value={mergeTarget} onChange={(e) => setMergeTarget(e.target.value)}>
              <option value="">Merge into…</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>{p.emoji ?? '👤'} {p.name}</option>
              ))}
            </select>
            <label className="imp-overwrite">
              <input type="checkbox" checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} />
              overwrite existing
            </label>
            <button disabled={!mergeTarget} onClick={() => void mergeInto()}>Merge</button>
          </div>
        </div>
      )}
    </div>
  );
}
