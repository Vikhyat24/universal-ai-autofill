/**
 * Thin, typed wrappers around chrome runtime/tabs messaging.
 * Keeps the RuntimeMessage protocol in one place and normalizes errors.
 */
import type { RuntimeMessage, RuntimeResponse } from './types';

/** Send a message to the background service worker. */
export async function sendToBackground<T = unknown>(
  msg: RuntimeMessage,
): Promise<RuntimeResponse<T>> {
  try {
    const res = await chrome.runtime.sendMessage(msg);
    return res ?? { ok: false, error: 'No response' };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Send a message to the content script of a specific tab. */
export async function sendToTab<T = unknown>(
  tabId: number,
  msg: RuntimeMessage,
): Promise<RuntimeResponse<T>> {
  try {
    const res = await chrome.tabs.sendMessage(tabId, msg);
    return res ?? { ok: false, error: 'No response' };
  } catch (e) {
    // Content script may not be injected (chrome:// pages, store, etc.)
    return { ok: false, error: (e as Error).message };
  }
}

/** Get the currently active tab in the focused window. */
export async function getActiveTab(): Promise<chrome.tabs.Tab | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}
