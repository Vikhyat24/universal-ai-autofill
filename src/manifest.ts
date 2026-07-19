import { defineManifest } from '@crxjs/vite-plugin';
import pkg from '../package.json';

/**
 * Manifest V3 definition.
 *
 * Permissions are intentionally minimal (privacy-first):
 *  - storage:      persist encrypted profiles/settings locally.
 *  - activeTab:    act on the tab the user explicitly interacts with.
 *  - scripting:    inject the autofill runtime on demand where needed.
 *  - contextMenus: right-click "Autofill" entry.
 *
 * No `host_permissions: <all_urls>` background access, no network permissions.
 * The content script is declared with a broad match so autofill works on any
 * site, but it never phones home — all logic runs locally.
 */
export default defineManifest({
  manifest_version: 3,
  name: 'Universal AI Autofill',
  version: pkg.version,
  description:
    'Fills any web form in seconds with your saved profiles. Smart offline field matching, privacy-first — your data never leaves you.',

  icons: {
    16: 'icons/icon-16.png',
    32: 'icons/icon-32.png',
    48: 'icons/icon-48.png',
    128: 'icons/icon-128.png',
  },

  action: {
    default_popup: 'src/popup/index.html',
    default_title: 'Universal AI Autofill',
    default_icon: {
      16: 'icons/icon-16.png',
      32: 'icons/icon-32.png',
      48: 'icons/icon-48.png',
    },
  },

  options_page: 'src/options/index.html',

  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },

  content_scripts: [
    {
      matches: ['<all_urls>'],
      js: ['src/content/index.ts'],
      run_at: 'document_idle',
      all_frames: false,
    },
  ],

  permissions: ['storage', 'activeTab', 'scripting', 'contextMenus'],

  commands: {
    'autofill-form': {
      suggested_key: {
        default: 'Alt+Shift+F',
        mac: 'Alt+Shift+F',
      },
      description: 'Autofill the current form',
    },
    'open-field-review': {
      suggested_key: {
        default: 'Alt+Shift+R',
        mac: 'Alt+Shift+R',
      },
      description: 'Review detected fields before filling',
    },
  },

  web_accessible_resources: [
    {
      resources: ['icons/*'],
      matches: ['<all_urls>'],
    },
  ],
});
