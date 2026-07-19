/**
 * Background service worker (MV3).
 *
 * Responsibilities are deliberately thin — all form logic lives in the
 * content script; all data access goes through services/storage:
 *  - Register the right-click context menu.
 *  - Route keyboard commands to the active tab.
 *  - Seed a starter profile on first install.
 */
import { getProfiles, saveProfiles, getSettings, saveSettings } from '@/services/storage';
import { createEmptyProfile } from '@/services/profileService';
import { sendToTab } from '@/shared/messaging';
import type { RuntimeMessage } from '@/shared/types';

const MENU_AUTOFILL = 'uaf-autofill';
const MENU_REVIEW = 'uaf-review';

chrome.runtime.onInstalled.addListener(async (details) => {
  // Context menus must be (re)registered on every install/update.
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_AUTOFILL,
      title: '⚡ Autofill this form',
      contexts: ['page', 'editable', 'frame'],
    });
    chrome.contextMenus.create({
      id: MENU_REVIEW,
      title: 'Review detected fields…',
      contexts: ['page', 'editable', 'frame'],
    });
  });

  if (details.reason === 'install') {
    // First run: create a starter profile and open Options for setup.
    const profiles = await getProfiles();
    if (profiles.length === 0) {
      const starter = createEmptyProfile('Personal', '👤');
      await saveProfiles([starter]);
      const settings = await getSettings();
      settings.defaultProfileId = starter.id;
      await saveSettings(settings);
    }
    void chrome.runtime.openOptionsPage();
  }
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab?.id) return;
  const msg: RuntimeMessage =
    info.menuItemId === MENU_REVIEW ? { type: 'OPEN_REVIEW' } : { type: 'CONTEXT_AUTOFILL' };
  void sendToTab(tab.id, msg);
});

chrome.commands.onCommand.addListener(async (command, tab) => {
  const target = tab ?? (await chrome.tabs.query({ active: true, currentWindow: true }))[0];
  if (!target?.id) return;
  if (command === 'autofill-form') {
    void sendToTab(target.id, { type: 'AUTOFILL' });
  } else if (command === 'open-field-review') {
    void sendToTab(target.id, { type: 'OPEN_REVIEW' });
  }
});

// Generic relay so popup can reach content scripts without tabs permission
// beyond activeTab, and future features (cloud sync) can hook in here.
chrome.runtime.onMessage.addListener((msg: RuntimeMessage, _sender, sendResponse) => {
  if (msg.type === 'PING') {
    sendResponse({ ok: true });
    return;
  }
  return undefined;
});
