/** Search tab: find anything across profiles, learned mappings and history. */
import { useEffect, useMemo, useState } from 'react';
import type { Profile, LearnedMapping, RecentForm } from '@/shared/types';
import { getProfiles, getLearnedMappings, getRecentForms } from '@/services/storage';
import { KIND_LABELS } from '@/shared/taxonomy';

interface ProfileHit {
  profile: string;
  emoji: string;
  label: string;
  value: string;
}

export function SearchTab() {
  const [query, setQuery] = useState('');
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [learned, setLearned] = useState<LearnedMapping[]>([]);
  const [recents, setRecents] = useState<RecentForm[]>([]);

  useEffect(() => {
    void (async () => {
      const [p, l, r] = await Promise.all([getProfiles(), getLearnedMappings(), getRecentForms()]);
      setProfiles(p);
      setLearned(l);
      setRecents(r);
    })();
  }, []);

  const q = query.trim().toLowerCase();

  const results = useMemo(() => {
    if (q.length < 2) return null;
    const profileHits: ProfileHit[] = [];
    for (const p of profiles) {
      for (const f of p.fields) {
        if (!f.value) continue;
        const label = f.kind === 'custom' ? (f.customKey ?? 'Custom') : (KIND_LABELS[f.kind] ?? f.kind);
        if (
          f.value.toLowerCase().includes(q) ||
          label.toLowerCase().includes(q) ||
          p.name.toLowerCase().includes(q)
        ) {
          profileHits.push({ profile: p.name, emoji: p.emoji ?? '👤', label, value: f.value });
        }
      }
    }
    const learnedHits = learned.filter(
      (m) => m.signature.toLowerCase().includes(q) || (m.kind ?? '').toLowerCase().includes(q) || (m.customKey ?? '').toLowerCase().includes(q),
    );
    const recentHits = recents.filter((r) => r.hostname.toLowerCase().includes(q) || r.url.toLowerCase().includes(q));
    return { profileHits, learnedHits, recentHits };
  }, [q, profiles, learned, recents]);

  const total = results
    ? results.profileHits.length + results.learnedHits.length + results.recentHits.length
    : 0;

  return (
    <div className="op-search">
      <input
        className="op-search-input"
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search profiles, learned mappings, history…"
      />

      {q.length >= 2 && (
        <div className="op-search-count muted">{total} result{total === 1 ? '' : 's'} for “{query.trim()}”</div>
      )}

      {results && results.profileHits.length > 0 && (
        <div className="card">
          <h3>👤 Profile fields ({results.profileHits.length})</h3>
          <div className="stack">
            {results.profileHits.map((h, i) => (
              <div className="row spread" key={i}>
                <span><span className="muted">{h.emoji} {h.profile} · </span>{h.label}</span>
                <code style={{ maxWidth: '55%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.value}</code>
              </div>
            ))}
          </div>
        </div>
      )}

      {results && results.learnedHits.length > 0 && (
        <div className="card">
          <h3>🧠 Learned mappings ({results.learnedHits.length})</h3>
          <div className="stack" style={{ fontSize: 12.5 }}>
            {results.learnedHits.slice(0, 50).map((m) => (
              <div className="row spread" key={m.signature}>
                <code style={{ maxWidth: '60%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.signature}</code>
                <span className="badge">{m.kind === 'custom' ? m.customKey : (KIND_LABELS[m.kind] ?? m.kind)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {results && results.recentHits.length > 0 && (
        <div className="card">
          <h3>🕘 History ({results.recentHits.length})</h3>
          <div className="stack" style={{ fontSize: 12.5 }}>
            {results.recentHits.map((r) => (
              <div className="row spread" key={r.url + r.timestamp}>
                <span>{r.hostname}</span>
                <span className="muted">{r.filledCount}✓ · {new Date(r.timestamp).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {q.length >= 2 && total === 0 && (
        <div className="card" style={{ padding: 30, textAlign: 'center' }}>
          <p className="muted">No matches.</p>
        </div>
      )}
    </div>
  );
}
