/** Options dashboard shell: tab navigation (hash-routed) + shared state. */
import { useEffect, useState } from 'react';
import { ProfilesTab } from './tabs/ProfilesTab';
import { SettingsTab } from './tabs/SettingsTab';
import { DataTab } from './tabs/DataTab';
import { ImportTab } from './tabs/ImportTab';
import { SearchTab } from './tabs/SearchTab';
import { useTheme } from '@/ui/useTheme';

type Tab = 'profiles' | 'import' | 'search' | 'settings' | 'data';

const TABS: Tab[] = ['profiles', 'import', 'search', 'settings', 'data'];

function tabFromHash(): Tab {
  const h = window.location.hash.replace('#', '') as Tab;
  return TABS.includes(h) ? h : 'profiles';
}

export function Options() {
  const [, setThemeMode] = useTheme();
  const [tab, setTab] = useState<Tab>(tabFromHash());

  useEffect(() => {
    const onHash = () => setTab(tabFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const go = (t: Tab) => {
    window.location.hash = t;
    setTab(t);
  };

  return (
    <div className="op">
      <div className="op-header">
        <span className="logo">⚡</span>
        <h1>Universal AI Autofill</h1>
        <span className="muted" style={{ fontSize: 12 }}>Local &amp; private — your data never leaves this device</span>
      </div>

      <div className="op-tabs">
        <button className={tab === 'profiles' ? 'active' : ''} onClick={() => go('profiles')}>👤 Profiles</button>
        <button className={tab === 'import' ? 'active' : ''} onClick={() => go('import')}>📄 Import</button>
        <button className={tab === 'search' ? 'active' : ''} onClick={() => go('search')}>🔎 Search</button>
        <button className={tab === 'settings' ? 'active' : ''} onClick={() => go('settings')}>⚙️ Settings</button>
        <button className={tab === 'data' ? 'active' : ''} onClick={() => go('data')}>🗄 Data</button>
      </div>

      {tab === 'profiles' && <ProfilesTab />}
      {tab === 'import' && <ImportTab />}
      {tab === 'search' && <SearchTab />}
      {tab === 'settings' && <SettingsTab onThemeChange={setThemeMode} />}
      {tab === 'data' && <DataTab />}
    </div>
  );
}
