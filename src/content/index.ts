/**
 * Content script entry: orchestrates detection → mapping → UI → fill.
 *
 * Lifecycle:
 *  1. Initial scan at document_idle, re-scans debounced via MutationObserver
 *     (covers dynamically rendered and multi-step forms).
 *  2. When fillable fields are found, show the floating action button.
 *  3. Fill on: FAB click, keyboard command, context menu, popup button.
 *  4. Never submits forms.
 */
import { scanFields, findFieldById, countForms, type DetectedField } from './detector';
import { fillElement, flashElement } from './filler';
import { ContentUI } from './ui';
import { mapField, type MappingResult } from '@/services/mapping/mapper';
import { fieldSignature } from '@/services/mapping/signals';
import {
  getSettings, getLearnedMappings, saveLearnedMapping, addRecentForm, getProfiles, saveSettings,
  upsertProfile,
} from '@/services/storage';
import { pickProfile, resolveValue, customKeys } from '@/services/profileService';
import { FILL_CONFIDENCE_THRESHOLD, MUTATION_DEBOUNCE_MS } from '@/shared/constants';
import { KIND_LABELS } from '@/shared/taxonomy';
import type {
  RuntimeMessage, RuntimeResponse, DetectedFieldInfo, DetectionSummary, FieldKind, Profile,
} from '@/shared/types';

interface MappedField {
  detected: DetectedField;
  mapping: MappingResult;
  proposedValue: string;
}

class AutofillController {
  private ui: ContentUI;
  private mapped: MappedField[] = [];
  private activeProfile: Profile | undefined;
  private fabDismissed = false;
  private observer: MutationObserver | null = null;
  private scanTimer: number | undefined;
  private enabled = true;
  /** fieldId → value we filled, for smart-learning change detection. */
  private filledValues = new Map<string, { value: string; kind: FieldKind; label: string }>();
  private learningHooked = new WeakSet<Element>();

  constructor() {
    this.ui = new ContentUI({
      onFill: (ids, overrides, profileId) => void this.fill({ onlyFieldIds: ids, overrides, profileId }),
      onProfileChange: (profileId) => void this.switchProfile(profileId),
      onKindCorrected: (fieldId, kind) => void this.correctKind(fieldId, kind),
      onDismissFab: () => (this.fabDismissed = true),
    });
  }

  async init(): Promise<void> {
    const settings = await getSettings();
    const host = location.hostname;
    if (settings.ignoredHosts.some((h) => host === h || host.endsWith(`.${h}`))) {
      this.enabled = false;
      return;
    }

    chrome.runtime.onMessage.addListener(
      (msg: RuntimeMessage, _sender, sendResponse: (r: RuntimeResponse) => void) => {
        this.handleMessage(msg)
          .then(sendResponse)
          .catch((e: Error) => sendResponse({ ok: false, error: e.message }));
        return true; // async response
      },
    );

    await this.rescan();

    if (settings.autofillOnLoad && this.fillableCount() > 0) {
      if (settings.confirmBeforeFill) await this.openReview();
      else await this.fill({});
    }

    this.observe();
  }

  // ------------------------------------------------------------ scanning

  private observe(): void {
    this.observer = new MutationObserver((muts) => {
      // Ignore mutations from our own UI.
      if (muts.every((m) => (m.target as HTMLElement)?.closest?.('[data-uaf-ui]'))) return;
      const relevant = muts.some(
        (m) =>
          m.type === 'childList' &&
          (Array.from(m.addedNodes).some((n) => n.nodeType === 1) ||
            Array.from(m.removedNodes).some((n) => n.nodeType === 1)),
      );
      if (!relevant) return;
      clearTimeout(this.scanTimer);
      this.scanTimer = window.setTimeout(() => void this.rescan(), MUTATION_DEBOUNCE_MS);
    });
    this.observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  private async rescan(): Promise<void> {
    if (!this.enabled) return;
    const [settings, learned] = await Promise.all([getSettings(), getLearnedMappings()]);
    this.activeProfile = await pickProfile(location.hostname);

    const detected = scanFields();
    const keys = this.activeProfile ? customKeys(this.activeProfile) : [];

    this.mapped = detected.map((d) => {
      const mapping = mapField(d.signals, {
        learned,
        customKeys: keys,
        semantic: settings.aiMappingEnabled,
      });
      const proposedValue =
        this.activeProfile && mapping.kind !== 'unknown' && mapping.kind !== 'password'
          ? (resolveValue(this.activeProfile, mapping.kind, mapping.customKey) ?? '')
          : '';
      return { detected: d, mapping, proposedValue };
    });

    this.updateFab(settings.showFloatingButton, settings.confirmBeforeFill);
  }

  private fillableCount(): number {
    return this.mapped.filter(
      (m) => m.proposedValue && m.mapping.confidence >= FILL_CONFIDENCE_THRESHOLD,
    ).length;
  }

  private updateFab(show: boolean, confirmBeforeFill: boolean): void {
    const count = this.fillableCount();
    if (!show || this.fabDismissed || count < 1) {
      this.ui.hideFab();
      return;
    }
    this.ui.showFab(count, () => {
      if (confirmBeforeFill) void this.openReview();
      else void this.fill({});
    });
  }

  // ------------------------------------------------------------ actions

  private toInfo(m: MappedField): DetectedFieldInfo {
    return {
      fieldId: m.detected.fieldId,
      label:
        m.detected.signals.label ||
        m.detected.signals.ariaLabel ||
        m.detected.signals.placeholder ||
        m.detected.signals.nearbyText ||
        m.detected.signals.name ||
        m.detected.signals.id,
      elementType: m.detected.signals.inputType,
      kind: m.mapping.kind,
      customKey: m.mapping.customKey,
      confidence: m.mapping.confidence,
      proposedValue: m.proposedValue,
      currentValue: m.detected.element.value ?? '',
      signature: m.mapping.signature,
    };
  }

  private summary(): DetectionSummary {
    return {
      url: location.href,
      hostname: location.hostname,
      formCount: countForms(this.mapped.map((m) => m.detected)),
      fields: this.mapped.map((m) => this.toInfo(m)),
    };
  }

  private async openReview(): Promise<void> {
    await this.rescan();
    const profiles = await getProfiles();
    this.ui.showReviewPanel(
      this.mapped
        .filter((m) => m.mapping.confidence >= FILL_CONFIDENCE_THRESHOLD || m.proposedValue)
        .map((m) => this.toInfo(m)),
      profiles,
      this.activeProfile?.id ?? '',
    );
  }

  private async switchProfile(profileId: string): Promise<void> {
    const settings = await getSettings();
    settings.siteProfiles[location.hostname] = profileId;
    await saveSettings(settings);
    await this.rescan();
    await this.openReview();
  }

  private async correctKind(fieldId: string, kind: FieldKind): Promise<void> {
    const m = this.mapped.find((x) => x.detected.fieldId === fieldId);
    if (!m) return;
    await saveLearnedMapping({
      signature: fieldSignature(m.detected.signals),
      kind,
      votes: 1,
      updatedAt: Date.now(),
    });
    await this.rescan();
    await this.openReview();
  }

  private async fill(opts: {
    profileId?: string;
    onlyFieldIds?: string[];
    overrides?: Record<string, string>;
  }): Promise<{ filled: number; total: number }> {
    if (opts.profileId) {
      this.activeProfile = await pickProfile(location.hostname, opts.profileId);
      await this.rescan();
    }
    if (!this.activeProfile) {
      this.ui.toast('No profile yet — open the extension popup to create one.');
      return { filled: 0, total: 0 };
    }

    let filled = 0;
    const targets = this.mapped.filter((m) => {
      if (opts.onlyFieldIds) return opts.onlyFieldIds.includes(m.detected.fieldId);
      return m.proposedValue && m.mapping.confidence >= FILL_CONFIDENCE_THRESHOLD;
    });

    for (const m of targets) {
      const value = opts.overrides?.[m.detected.fieldId] ?? m.proposedValue;
      if (!value) continue;
      const el = findFieldById(m.detected.fieldId) ?? m.detected.element;
      if (fillElement(el, value)) {
        filled++;
        flashElement(el);
        this.filledValues.set(m.detected.fieldId, {
          value,
          kind: m.mapping.kind,
          label: this.toInfo(m).label,
        });
        this.hookLearning(el, m);
      }
    }

    if (filled > 0) {
      this.ui.toast(`Filled ${filled} field${filled === 1 ? '' : 's'} — review before submitting.`, 'Review', () => void this.openReview());
      await addRecentForm({
        hostname: location.hostname,
        url: location.href.split('#')[0].slice(0, 300),
        filledCount: filled,
        profileId: this.activeProfile.id,
        timestamp: Date.now(),
      });
    } else {
      this.ui.toast('Nothing to fill — no confident matches on this page.', 'Review fields', () => void this.openReview());
    }
    return { filled, total: targets.length };
  }

  // ------------------------------------------------------------ learning

  /** After we fill a field, watch for the user changing it → offer to learn. */
  private hookLearning(el: Element, m: MappedField): void {
    if (this.learningHooked.has(el)) return;
    this.learningHooked.add(el);
    el.addEventListener('change', async () => {
      const settings = await getSettings();
      if (!settings.smartLearning || !this.activeProfile) return;
      const record = this.filledValues.get(m.detected.fieldId);
      const current = (el as HTMLInputElement).value;
      if (!record || !current || current === record.value) return;
      if (record.kind === 'unknown' || record.kind === 'password') return;

      const kindLabel =
        record.kind === 'custom' ? (m.mapping.customKey ?? 'custom field') : (KIND_LABELS[record.kind] ?? record.kind);
      this.ui.toast(`Remember "${current.slice(0, 40)}" as your ${kindLabel}?`, 'Save', async () => {
        const profile = this.activeProfile!;
        const existing = profile.fields.find((f) =>
          record.kind === 'custom'
            ? f.kind === 'custom' && f.customKey === m.mapping.customKey
            : f.kind === record.kind,
        );
        if (existing) existing.value = current;
        else profile.fields.push({ kind: record.kind, customKey: m.mapping.customKey, value: current });
        await upsertProfile(profile);
        this.ui.toast('Saved to your profile.');
      }, 8000);
    });
  }

  // ------------------------------------------------------------ messaging

  private async handleMessage(msg: RuntimeMessage): Promise<RuntimeResponse> {
    switch (msg.type) {
      case 'PING':
        return { ok: true };
      case 'DETECT_FIELDS': {
        if (msg.profileId) this.activeProfile = await pickProfile(location.hostname, msg.profileId);
        await this.rescan();
        return { ok: true, data: this.summary() };
      }
      case 'AUTOFILL': {
        const settings = await getSettings();
        if (settings.confirmBeforeFill && !msg.onlyFieldIds) {
          await this.openReview();
          return { ok: true, data: { filled: 0, total: 0, reviewOpened: true } };
        }
        const res = await this.fill({
          profileId: msg.profileId,
          onlyFieldIds: msg.onlyFieldIds,
          overrides: msg.overrides,
        });
        return { ok: true, data: res };
      }
      case 'OPEN_REVIEW':
        await this.openReview();
        return { ok: true };
      case 'CONTEXT_AUTOFILL': {
        const res = await this.fill({});
        return { ok: true, data: res };
      }
      default:
        return { ok: false, error: `Unhandled message: ${(msg as { type: string }).type}` };
    }
  }
}

// Guard against double-injection (SPA navigations, manual re-injection).
declare global {
  interface Window {
    __uafInjected?: boolean;
  }
}
if (!window.__uafInjected) {
  window.__uafInjected = true;
  const controller = new AutofillController();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => void controller.init(), { once: true });
  } else {
    void controller.init();
  }
}
