/** Data tab: backup/restore, learned mappings, recents, wipe. */
import { useEffect, useState } from 'react';
import type { LearnedMapping, RecentForm } from '@/shared/types';
import { getLearnedMappings, clearLearnedMappings, getRecentForms } from '@/services/storage';
import { KIND_LABELS } from '@/shared/taxonomy';
import { downloadBackup, pickAndImportBackup } from '@/ui/backup';

export function DataTab() {
  const [learned, setLearned] = useState<LearnedMapping[]>([]);
  const [recents, setRecents] = useState<RecentForm[]>([]);
  const [msg, setMsg] = useState('');

  const load = async () => {
    setLearned(await getLearnedMappings());
    setRecents(await getRecentForms());
  };

  useEffect(() => {
    void load();
  }, []);

  const flash = (text: string) => {
    setMsg(text);
    setTimeout(() => setMsg(''), 2500);
  };

  const wipeAll = async () => {
    if (!confirm('Delete ALL extension data (profiles, settings, learned mappings)? Consider exporting a backup first.')) return;
    await chrome.storage.local.clear();
    flash('All data deleted.');
    await load();
  };

  return (
    <div className="op-data">
      {msg && <div className="badge" style={{ alignSelf: 'flex-start' }}>{msg}</div>}

      <div className="card">
        <h3>💾 Backup</h3>
        <p>Export everything (profiles, settings, learned mappings) as a JSON file. Note: the export file itself is unencrypted — store it safely.</p>
        <div className="row">
          <button className="primary" onClick={() => void downloadBackup().then(() => flash('Backup downloaded.'))}>Export backup</button>
          <button onClick={() => void pickAndImportBackup().then((ok) => { if (ok) { flash('Backup imported.'); void load(); } })}>
            Import backup
          </button>
        </div>
      </div>

      <div className="card">
        <h3>🧠 Learned field mappings ({learned.length})</h3>
        <p>Site-field corrections you've taught the extension. Highest-voted first.</p>
        {learned.length > 0 && (
          <div className="stack" style={{ maxHeight: 220, overflowY: 'auto', fontSize: 12.5 }}>
            {[...learned].sort((a, b) => b.votes - a.votes).slice(0, 50).map((m) => (
              <div className="row spread" key={m.signature}>
                <code style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%' }}>
                  {m.signature}
                </code>
                <span className="badge">{m.kind === 'custom' ? m.customKey : (KIND_LABELS[m.kind] ?? m.kind)}</span>
              </div>
            ))}
          </div>
        )}
        <div style={{ marginTop: 10 }}>
          <button
            disabled={!learned.length}
            onClick={() => void clearLearnedMappings().then(() => { flash('Learned mappings cleared.'); void load(); })}
          >
            Clear learned mappings
          </button>
        </div>
      </div>

      <div className="card">
        <h3>🕘 Recent forms ({recents.length})</h3>
        <p>Pages you've autofilled recently (stored locally, last 20).</p>
        <div className="stack" style={{ maxHeight: 200, overflowY: 'auto', fontSize: 12.5 }}>
          {recents.map((r) => (
            <div className="row spread" key={r.url + r.timestamp}>
              <span>{r.hostname}</span>
              <span className="muted">{r.filledCount} fields · {new Date(r.timestamp).toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h3>⚠️ Danger zone</h3>
        <p>Remove every piece of data this extension has stored on this device.</p>
        <button className="danger" onClick={() => void wipeAll()}>Delete all data</button>
      </div>
    </div>
  );
}
