/** Data tab: backup/restore, stats, learned mappings, recents, wipe. */
import { useEffect, useState } from 'react';
import type { LearnedMapping, RecentForm, FillStats } from '@/shared/types';
import {
  getLearnedMappings, clearLearnedMappings, getRecentForms, getStats, clearStats,
} from '@/services/storage';
import { KIND_LABELS } from '@/shared/taxonomy';
import { downloadBackup, downloadEncryptedBackup, pickAndImportBackup } from '@/ui/backup';

export function DataTab() {
  const [learned, setLearned] = useState<LearnedMapping[]>([]);
  const [recents, setRecents] = useState<RecentForm[]>([]);
  const [stats, setStats] = useState<FillStats | null>(null);
  const [encryptPw, setEncryptPw] = useState('');
  const [msg, setMsg] = useState('');

  const load = async () => {
    setLearned(await getLearnedMappings());
    setRecents(await getRecentForms());
    setStats(await getStats());
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
        <p>Export everything (profiles, settings, learned mappings, stats) as a JSON file, or protect it with a password using AES-GCM encryption. Import accepts either format.</p>
        <div className="row">
          <button className="primary" onClick={() => void downloadBackup().then(() => flash('Backup downloaded.'))}>Export backup</button>
          <button onClick={() => void pickAndImportBackup().then((ok) => { if (ok) { flash('Backup imported.'); void load(); } })}>
            Import backup
          </button>
        </div>
        <div className="row" style={{ marginTop: 10 }}>
          <input
            type="password"
            placeholder="Password to encrypt export…"
            value={encryptPw}
            onChange={(e) => setEncryptPw(e.target.value)}
            style={{ maxWidth: 260 }}
          />
          <button
            disabled={encryptPw.length < 4}
            onClick={() => void downloadEncryptedBackup(encryptPw).then(() => { flash('Encrypted backup downloaded.'); setEncryptPw(''); })}
          >
            Export encrypted
          </button>
        </div>
      </div>

      <div className="card">
        <h3>📊 Usage stats</h3>
        <p>Counted locally on this device — never uploaded.</p>
        {stats && stats.totalFilled > 0 ? (
          <>
            <div className="row spread"><span>Fields filled (all-time)</span><span className="badge">{stats.totalFilled.toLocaleString()}</span></div>
            <div className="row spread"><span>Forms filled</span><span className="badge">{stats.totalForms.toLocaleString()}</span></div>
            {Object.keys(stats.perHost).length > 0 && (
              <div className="stack" style={{ maxHeight: 160, overflowY: 'auto', fontSize: 12.5, marginTop: 8 }}>
                {Object.entries(stats.perHost).sort((a, b) => b[1] - a[1]).slice(0, 20).map(([host, n]) => (
                  <div className="row spread" key={host}><span>{host}</span><span className="muted">{n} fields</span></div>
                ))}
              </div>
            )}
            <div style={{ marginTop: 10 }}>
              <button onClick={() => void clearStats().then(() => { flash('Stats reset.'); void load(); })}>Reset stats</button>
            </div>
          </>
        ) : (
          <p className="muted">No fills recorded yet.</p>
        )}
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
