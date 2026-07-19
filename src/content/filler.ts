/**
 * Fill engine: writes values into controls so that ALL frameworks notice.
 *
 * React/Vue/Angular attach their own value tracking; a plain `el.value = x`
 * is invisible to them. We use the native property setter from the element
 * prototype and dispatch input/change events, which reliably triggers
 * framework state updates.
 *
 * The engine NEVER submits forms or clicks buttons.
 */
import type { FillableElement } from './detector';
import { bestOptionIndex } from '@/services/mapping/mapper';

function setNativeValue(el: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const proto = el instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype
    : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  if (setter) setter.call(el, value);
  else el.value = value;
}

function fireEvents(el: HTMLElement): void {
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  el.dispatchEvent(new Event('blur', { bubbles: true }));
}

/** Normalize a date value to what the control expects. */
function coerceDateValue(el: HTMLInputElement, value: string): string {
  if (el.type !== 'date') return value;
  // Accept "1998-04-12", "12/04/1998", "04/12/1998", "April 12, 1998" best-effort.
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parsed = new Date(value);
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return value;
}

const TRUTHY = new Set(['yes', 'true', 'y', '1', 'on', 'checked', 'agree']);

/**
 * Fill a single element with a value. Returns true if a change was applied.
 */
export function fillElement(el: FillableElement, value: string): boolean {
  if (!value) return false;

  try {
    if (el instanceof HTMLSelectElement) {
      const labels = Array.from(el.options).map((o) => o.text.trim());
      let idx = bestOptionIndex(labels, value);
      if (idx < 0) {
        // Also try matching option values ("US" vs "United States").
        const values = Array.from(el.options).map((o) => o.value);
        idx = bestOptionIndex(values, value);
      }
      if (idx < 0) return false;
      if (el.selectedIndex === idx) return false;
      el.selectedIndex = idx;
      fireEvents(el);
      return true;
    }

    if (el instanceof HTMLInputElement) {
      const type = (el.type || 'text').toLowerCase();

      if (type === 'checkbox') {
        const shouldCheck = TRUTHY.has(value.trim().toLowerCase());
        if (el.checked === shouldCheck) return false;
        el.checked = shouldCheck;
        fireEvents(el);
        return true;
      }

      if (type === 'radio') {
        // Match against this radio's own label/value.
        const ownLabel = el.labels?.[0]?.textContent?.trim() ?? el.value;
        const idx = bestOptionIndex([ownLabel, el.value], value);
        if (idx < 0 || el.checked) return false;
        el.checked = true;
        fireEvents(el);
        return true;
      }

      const coerced = type === 'date' ? coerceDateValue(el, value) : value;
      if (el.value === coerced) return false;
      // Simulate focus so sites listening for focus-based validation behave.
      el.dispatchEvent(new FocusEvent('focus', { bubbles: true }));
      setNativeValue(el, coerced);
      fireEvents(el);
      return true;
    }

    // textarea
    if (el.value === value) return false;
    el.dispatchEvent(new FocusEvent('focus', { bubbles: true }));
    setNativeValue(el, value);
    fireEvents(el);
    return true;
  } catch {
    return false;
  }
}

/** Brief highlight so the user sees what changed. */
export function flashElement(el: HTMLElement): void {
  const prevOutline = el.style.outline;
  const prevTransition = el.style.transition;
  el.style.transition = 'outline 0.15s ease';
  el.style.outline = '2px solid #91e63e';
  setTimeout(() => {
    el.style.outline = prevOutline;
    setTimeout(() => (el.style.transition = prevTransition), 200);
  }, 900);
}
