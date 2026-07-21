/** Settings tab: behavior toggles, theme, default profile, per-site rules. */
import { useEffect, useState } from 'react';
import type { Settings, Profile, ThemeMode, SiteRuleMode } from '@/shared/types';
import { getSettings, saveSettings, getProfiles } from '@/services/storage';

const SITE_RULE_LABELS: Record<SiteRuleMode, string> = {
  auto: 'Auto-fill',
  review: 'Always review',
  off: 'Disabled',
};

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="switch">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="track" />
    </label>
  );
}

export function SettingsTab({ onThemeChange }: { onThemeChange: (m: ThemeMode) => void }) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [ignoredText, setIgnoredText] = useState('');

  useEffect(() => {
    void (async () => {
      const [s, p] = await Promise.all([getSettings(), getProfiles()]);
      setSettings(s);
      setProfiles(p);
      setIgnoredText(s.ignoredHosts.join('\n'));
    })();
  }, []);

  if (!settings) return null;

  const update = (patch: Partial<Settings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    void saveSettings(next);
  };

  const saveIgnored = () => {
    const hosts = ignoredText
      .split(/\n+/)
      .map((s) => s.trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0])
      .filter(Boolean);
    update({ ignoredHosts: Array.from(new Set(hosts)) });
  };

  const setSiteRule = (host: string, mode: SiteRuleMode) => {
    update({ siteRules: { ...settings!.siteRules, [host]: mode } });
  };

  const removeSiteRule = (host: string) => {
    const next = { ...settings!.siteRules };
    delete next[host];
    update({ siteRules: next });
  };

  const siteRuleEntries = Object.entries(settings.siteRules ?? {});

  return (
    <div className="op-settings">
      <div className="op-set card">
        <div className="info">
          <b>AI field mapping</b>
          <span>Semantic + fuzzy matching for unusual field names (candidate_mail → Email). Runs fully offline.</span>
        </div>
        <Toggle checked={settings.aiMappingEnabled} onChange={(v) => update({ aiMappingEnabled: v })} />
      </div>

      <div className="op-set card">
        <div className="info">
          <b>Theme</b>
          <span>Popup and options appearance.</span>
        </div>
        <select
          value={settings.theme}
          onChange={(e) => {
            const theme = e.target.value as ThemeMode;
            update({ theme });
            onThemeChange(theme);
          }}
        >
          <option value="system">System</option>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </div>

      <div className="op-set card">
        <div className="info">
          <b>Default profile</b>
          <span>Used when a site has no remembered profile.</span>
        </div>
        <select
          value={settings.defaultProfileId ?? ''}
          onChange={(e) => update({ defaultProfileId: e.target.value || null })}
        >
          <option value="">— none —</option>
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>{p.emoji ?? '👤'} {p.name}</option>
          ))}
        </select>
      </div>

      <div className="op-set card">
        <div className="info">
          <b>Floating autofill button</b>
          <span>Show the ⚡ button when a fillable form is detected.</span>
        </div>
        <Toggle checked={settings.showFloatingButton} onChange={(v) => update({ showFloatingButton: v })} />
      </div>

      <div className="op-set card">
        <div className="info">
          <b>Confirm before filling</b>
          <span>Always open the review panel instead of filling instantly.</span>
        </div>
        <Toggle checked={settings.confirmBeforeFill} onChange={(v) => update({ confirmBeforeFill: v })} />
      </div>

      <div className="op-set card">
        <div className="info">
          <b>Autofill on page load</b>
          <span>Fill forms automatically when a page finishes loading. Combine with confirmation for safety.</span>
        </div>
        <Toggle checked={settings.autofillOnLoad} onChange={(v) => update({ autofillOnLoad: v })} />
      </div>

      <div className="op-set card">
        <div className="info">
          <b>Smart learning</b>
          <span>When you correct a filled value, offer to remember it; learn field-type corrections per site.</span>
        </div>
        <Toggle checked={settings.smartLearning} onChange={(v) => update({ smartLearning: v })} />
      </div>

      <div className="op-set card">
        <div className="info">
          <b>Encrypt stored data</b>
          <span>AES-GCM encryption of profiles at rest (recommended, on by default).</span>
        </div>
        <Toggle checked={settings.encryptionEnabled} onChange={(v) => update({ encryptionEnabled: v })} />
      </div>

      <div className="op-set card col">
        <div className="info">
          <b>Per-site rules</b>
          <span>Overrides for specific sites (set from the popup on each site). These take priority over the global behavior above.</span>
        </div>
        {siteRuleEntries.length === 0 ? (
          <p className="muted" style={{ fontSize: 12.5 }}>No per-site rules yet. Open the popup on a site to add one.</p>
        ) : (
          <div className="stack" style={{ maxHeight: 220, overflowY: 'auto' }}>
            {siteRuleEntries.map(([host, mode]) => (
              <div className="row spread" key={host}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '45%' }}>{host}</span>
                <div className="row" style={{ gap: 8 }}>
                  <select
                    value={mode}
                    onChange={(e) => setSiteRule(host, e.target.value as SiteRuleMode)}
                    style={{ width: 'auto', minWidth: 140 }}
                  >
                    {(Object.keys(SITE_RULE_LABELS) as SiteRuleMode[]).map((m) => (
                      <option key={m} value={m}>{SITE_RULE_LABELS[m]}</option>
                    ))}
                  </select>
                  <button className="ghost" title="Remove" onClick={() => removeSiteRule(host)}>🗑</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="op-set card col">
        <div className="info">
          <b>Ignored websites</b>
          <span>One hostname per line (e.g. mybank.com). The extension stays completely inactive there.</span>
        </div>
        <textarea
          value={ignoredText}
          onChange={(e) => setIgnoredText(e.target.value)}
          onBlur={saveIgnored}
          placeholder={'example.com\ninternal.company.com'}
        />
      </div>

      <div className="op-set card">
        <div className="info">
          <b>Keyboard shortcuts</b>
          <span>Alt+Shift+F autofill · Alt+Shift+R review. Change them on the browser's shortcuts page.</span>
        </div>
        <button onClick={() => void chrome.tabs.create({ url: 'chrome://extensions/shortcuts' })}>
          Open shortcuts
        </button>
      </div>
    </div>
  );
}
