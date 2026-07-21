/**
 * Extension popup: quick profile switch, one-click autofill, review,
 * recents, import/export, and links into the options dashboard.
 */
import { useEffect, useState } from 'react';
import type { Profile, RecentForm, DetectionSummary, Settings, SiteRuleMode, FillStats } from '@/shared/types';
import { getProfiles, getSettings, saveSettings, getRecentForms, getStats } from '@/services/storage';
import { getActiveTab, sendToTab } from '@/shared/messaging';
import { useTheme } from '@/ui/useTheme';
import { downloadBackup, pickAndImportBackup } from '@/ui/backup';

type Status = { kind: 'ok' | 'err'; text: string } | null;

type InjectResult = 'ok' | 'restricted' | 'needs-file-access';

/** Browser pages we can never run on. */
const RESTRICTED_URL =
  /^(chrome|edge|brave|opera|vivaldi|about|devtools|chrome-extension|moz-extension|view-source):/i;

/**
 * Make sure the content script is alive in the tab, injecting it on demand
 * (tabs opened before the extension was installed don't have it yet).
 */
async function ensureContentScript(tab: chrome.tabs.Tab | undefined): Promise<InjectResult> {
  if (!tab?.id || !tab.url) return 'restricted';
  if (
    RESTRICTED_URL.test(tab.url) ||
    tab.url.startsWith('https://chrome.google.com/webstore') ||
    tab.url.startsWith('https://chromewebstore.google.com')
  ) {
    return 'restricted';
  }

  if ((await sendToTab(tab.id, { type: 'PING' })).ok) return 'ok';

  if (tab.url.startsWith('file:')) {
    const allowed = await new Promise<boolean>((res) =>
      chrome.extension.isAllowedFileSchemeAccess((v) => res(v)),
    );
    if (!allowed) return 'needs-file-access';
  }

  // Inject the declared content script bundle manually, then re-ping.
  const files = chrome.runtime.getManifest().content_scripts?.[0]?.js ?? [];
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files });
  } catch {
    return 'restricted';
  }
  return (await sendToTab(tab.id, { type: 'PING' })).ok ? 'ok' : 'restricted';
}

const INJECT_ERRORS: Record<Exclude<InjectResult, 'ok'>, string> = {
  restricted: 'This page is restricted by the browser and cannot be autofilled.',
  'needs-file-access': 'Enable "Allow access to file URLs" for this extension in chrome://extensions to autofill local files.',
};

export function Popup() {
  useTheme();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [activeProfileId, setActiveProfileId] = useState('');
  const [recents, setRecents] = useState<RecentForm[]>([]);
  const [stats, setStats] = useState<FillStats | null>(null);
  const [detected, setDetected] = useState<number | null>(null);
  const [hostname, setHostname] = useState('');
  const [status, setStatus] = useState<Status>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      const [p, s, r, st, tab] = await Promise.all([
        getProfiles(), getSettings(), getRecentForms(), getStats(), getActiveTab(),
      ]);
      setProfiles(p);
      setSettings(s);
      setRecents(r);
      setStats(st);
      let host = '';
      if (tab?.url) {
        try { host = new URL(tab.url).hostname; } catch { /* chrome:// etc. */ }
      }
      setHostname(host);
      const preferred = (host && s.siteProfiles[host]) || s.defaultProfileId || p[0]?.id || '';
      setActiveProfileId(preferred);

      // Probe the page for detected fields, injecting the script if needed.
      if (tab?.id && (await ensureContentScript(tab)) === 'ok') {
        const res = await sendToTab<DetectionSummary>(tab.id, { type: 'DETECT_FIELDS' });
        if (res.ok && res.data) {
          setDetected(res.data.fields.filter((f) => f.proposedValue).length);
        }
      }
    })();
  }, []);

  const changeProfile = async (id: string) => {
    setActiveProfileId(id);
    if (!settings) return;
    const next = { ...settings };
    if (hostname) next.siteProfiles = { ...next.siteProfiles, [hostname]: id };
    else next.defaultProfileId = id;
    setSettings(next);
    await saveSettings(next);
  };

  const setSiteRule = async (mode: SiteRuleMode | '') => {
    if (!settings || !hostname) return;
    const siteRules = { ...settings.siteRules };
    if (mode) siteRules[hostname] = mode;
    else delete siteRules[hostname];
    const next = { ...settings, siteRules };
    setSettings(next);
    await saveSettings(next);
  };

  const autofill = async () => {
    setBusy(true);
    setStatus(null);
    const tab = await getActiveTab();
    const inject = await ensureContentScript(tab);
    if (inject !== 'ok') {
      setBusy(false);
      setStatus({ kind: 'err', text: INJECT_ERRORS[inject] });
      return;
    }
    const res = await sendToTab<{ filled: number; total: number; reviewOpened?: boolean }>(tab!.id!, {
      type: 'AUTOFILL',
      profileId: activeProfileId,
    });
    setBusy(false);
    if (!res.ok) {
      setStatus({ kind: 'err', text: 'The page did not respond — reload it and try again.' });
    } else if (res.data?.reviewOpened) {
      setStatus({ kind: 'ok', text: 'Review panel opened on the page.' });
      window.close();
    } else {
      setStatus({ kind: 'ok', text: `Filled ${res.data?.filled ?? 0} fields ✓` });
    }
  };

  const review = async () => {
    const tab = await getActiveTab();
    const inject = await ensureContentScript(tab);
    if (inject !== 'ok') {
      setStatus({ kind: 'err', text: INJECT_ERRORS[inject] });
      return;
    }
    const res = await sendToTab(tab!.id!, { type: 'OPEN_REVIEW' });
    if (res.ok) window.close();
    else setStatus({ kind: 'err', text: 'The page did not respond — reload it and try again.' });
  };

  const openOptions = (hash = '') => {
    void chrome.tabs.create({ url: chrome.runtime.getURL(`src/options/index.html${hash}`) });
  };

  const timeAgo = (ts: number) => {
    const m = Math.floor((Date.now() - ts) / 60000);
    if (m < 1) return 'now';
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h`;
    return `${Math.floor(h / 24)}d`;
  };

  return (
    <div className="pp">
      <div className="pp-header">
        <span className="logo">⚡</span>
        <h1>AI Autofill</h1>
        {detected !== null && <span className="badge">{detected} matched</span>}
        <button className="gear" title="Settings" onClick={() => openOptions('#settings')}>⚙️</button>
      </div>

      {profiles.length > 0 ? (
        <div className="pp-profile card">
          <label>Profile{hostname ? ` · ${hostname}` : ''}</label>
          <select value={activeProfileId} onChange={(e) => void changeProfile(e.target.value)}>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.emoji ?? '👤'} {p.name}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div className="pp-empty card">
          No profiles yet.
          <br />
          <button className="primary" style={{ marginTop: 8 }} onClick={() => openOptions('#profiles')}>
            Create your first profile
          </button>
        </div>
      )}

      {hostname && settings && (
        <div className="pp-siterule">
          <span className="muted">On {hostname}:</span>
          <select
            value={settings.siteRules?.[hostname] ?? ''}
            onChange={(e) => void setSiteRule(e.target.value as SiteRuleMode | '')}
          >
            <option value="">Default behavior</option>
            <option value="auto">Auto-fill (skip review)</option>
            <option value="review">Always review first</option>
            <option value="off">Disable here</option>
          </select>
        </div>
      )}

      <div className="pp-actions">
        <button className="big primary" disabled={busy || !profiles.length} onClick={() => void autofill()}>
          ⚡ Autofill Current Page
        </button>
        <div className="duo">
          <button onClick={() => void review()} disabled={!profiles.length}>👁 Review first</button>
          <button onClick={() => openOptions('#profiles')}>✏️ Quick edit</button>
        </div>
      </div>

      {status && <div className={`pp-status ${status.kind}`}>{status.text}</div>}

      {stats && stats.totalFilled > 0 && (
        <div className="pp-stats" title="Counted locally on this device">
          ⚡ <b>{stats.totalFilled.toLocaleString()}</b> fields filled across{' '}
          <b>{stats.totalForms.toLocaleString()}</b> forms
        </div>
      )}

      {recents.length > 0 && (
        <div className="pp-section">
          <h2>Recent forms</h2>
          <div className="pp-recent">
            {recents.slice(0, 6).map((r) => (
              <div className="item" key={r.url + r.timestamp}>
                <span className="host" title={r.url}>{r.hostname}</span>
                <span className="muted">{r.filledCount}✓ · {timeAgo(r.timestamp)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="pp-foot">
        <button onClick={() => openOptions('#profiles')}>Profiles</button>
        <button onClick={() => void downloadBackup()}>Export</button>
        <button onClick={() => void pickAndImportBackup().then((ok) => ok && window.location.reload())}>
          Import
        </button>
      </div>
    </div>
  );
}
