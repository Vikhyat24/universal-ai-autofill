/**
 * DOM field detector: finds fillable controls and extracts FieldSignals.
 *
 * Performance notes:
 *  - One querySelectorAll pass per scan; no per-field full-DOM walks.
 *  - Label lookup uses a prebuilt for→label map per scan.
 *  - Re-scans are debounced behind a MutationObserver (see index.ts).
 */
import type { FieldSignals } from '@/services/mapping/signals';

export type FillableElement = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

export interface DetectedField {
  element: FillableElement;
  signals: FieldSignals;
  fieldId: string;
}

const FILLABLE_SELECTOR = [
  'input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=reset]):not([type=image]):not([type=file])',
  'select',
  'textarea',
].join(',');

let fieldSeq = 0;
const FIELD_ID_ATTR = 'data-uaf-field-id';

function isVisible(el: HTMLElement): boolean {
  if (!el.isConnected) return false;
  if (el.getAttribute('aria-hidden') === 'true') return false;
  // offsetParent is null for display:none (and position:fixed — allow those).
  const style = getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden') return false;
  const rect = el.getBoundingClientRect();
  return rect.width > 1 && rect.height > 1;
}

function textOf(el: Element | null): string {
  return (el?.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 120);
}

/** Nearest heading or legend above/around the field (section context). */
function findSectionHeading(el: HTMLElement): string {
  const fieldset = el.closest('fieldset');
  const legend = fieldset?.querySelector('legend');
  if (legend) return textOf(legend);

  let node: HTMLElement | null = el;
  for (let depth = 0; node && depth < 5; depth++) {
    let sib: Element | null = node.previousElementSibling;
    let hops = 0;
    while (sib && hops < 6) {
      if (/^H[1-6]$/.test(sib.tagName)) return textOf(sib);
      const h = sib.querySelector?.('h1,h2,h3,h4,h5,h6');
      if (h) return textOf(h);
      sib = sib.previousElementSibling;
      hops++;
    }
    node = node.parentElement;
  }
  return '';
}

/** Text immediately preceding the field (table cells, div-label patterns). */
function findNearbyText(el: HTMLElement): string {
  // aria-labelledby / aria-describedby references
  const refIds = [el.getAttribute('aria-labelledby'), el.getAttribute('aria-describedby')]
    .filter(Boolean)
    .flatMap((s) => (s as string).split(/\s+/));
  for (const id of refIds) {
    const ref = document.getElementById(id);
    if (ref) {
      const t = textOf(ref);
      if (t) return t;
    }
  }

  // previous sibling text (common label-less pattern)
  let sib = el.previousElementSibling;
  let hops = 0;
  while (sib && hops < 3) {
    if (!(sib instanceof HTMLInputElement) && !(sib instanceof HTMLSelectElement)) {
      const t = textOf(sib);
      if (t && t.length < 80) return t;
    }
    sib = sib.previousElementSibling;
    hops++;
  }

  // parent cell / wrapper text minus our own value
  const parent = el.closest('td, li, .form-group, .field, .form-field, .input-group, [class*="field"], [class*="Field"]') ?? el.parentElement;
  if (parent && parent !== document.body) {
    const clone = parent.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('input,select,textarea,button,script,style').forEach((n) => n.remove());
    const t = textOf(clone);
    if (t && t.length < 100) return t;
  }
  return '';
}

/** Extract signals for one control, using the prebuilt label map. */
function extractSignals(el: FillableElement, labelMap: Map<string, HTMLLabelElement>): FieldSignals {
  // <label for=...> or wrapping <label>
  let labelText = '';
  if (el.id && labelMap.has(el.id)) {
    labelText = textOf(labelMap.get(el.id)!);
  }
  if (!labelText) {
    const wrapping = el.closest('label');
    if (wrapping) {
      const clone = wrapping.cloneNode(true) as HTMLElement;
      clone.querySelectorAll('input,select,textarea').forEach((n) => n.remove());
      labelText = textOf(clone);
    }
  }

  const inputType =
    el instanceof HTMLSelectElement ? 'select'
    : el instanceof HTMLTextAreaElement ? 'textarea'
    : (el.type || 'text').toLowerCase();

  const dataAttrs = Array.from(el.attributes)
    .filter((a) => a.name.startsWith('data-') && !a.name.startsWith('data-uaf'))
    .map((a) => `${a.name} ${a.value}`)
    .join(' ')
    .slice(0, 160);

  let options: string[] | undefined;
  if (el instanceof HTMLSelectElement) {
    options = Array.from(el.options).map((o) => o.text.trim());
  }

  return {
    label: labelText,
    placeholder: el.getAttribute('placeholder') ?? '',
    name: el.getAttribute('name') ?? '',
    id: el.id ?? '',
    ariaLabel: el.getAttribute('aria-label') ?? '',
    autocomplete: el.getAttribute('autocomplete') ?? '',
    inputType,
    nearbyText: labelText ? '' : findNearbyText(el),
    sectionHeading: findSectionHeading(el),
    className: (typeof el.className === 'string' ? el.className : '').slice(0, 120),
    dataAttrs,
    options,
    maxLength: el instanceof HTMLInputElement ? (el.maxLength > 0 ? el.maxLength : undefined) : undefined,
    required: el.required,
  };
}

/** Scan the document (and same-origin shadow roots) for fillable fields. */
export function scanFields(root: ParentNode = document): DetectedField[] {
  const labelMap = new Map<string, HTMLLabelElement>();
  document.querySelectorAll('label[for]').forEach((l) => {
    const forId = l.getAttribute('for');
    if (forId && !labelMap.has(forId)) labelMap.set(forId, l as HTMLLabelElement);
  });

  const elements: FillableElement[] = [];
  const collect = (node: ParentNode) => {
    node.querySelectorAll<FillableElement>(FILLABLE_SELECTOR).forEach((el) => elements.push(el));
    // Recurse into open shadow roots (many component libraries use them).
    node.querySelectorAll('*').forEach((el) => {
      const sr = (el as HTMLElement).shadowRoot;
      if (sr) collect(sr);
    });
  };
  collect(root);

  const results: DetectedField[] = [];
  for (const el of elements) {
    if (!isVisible(el)) continue;
    if (el.disabled) continue;
    if (!(el instanceof HTMLSelectElement) && el.readOnly) continue;

    let fieldId = el.getAttribute(FIELD_ID_ATTR);
    if (!fieldId) {
      fieldId = `f${++fieldSeq}`;
      el.setAttribute(FIELD_ID_ATTR, fieldId);
    }
    results.push({ element: el, signals: extractSignals(el, labelMap), fieldId });
  }
  return results;
}

export function findFieldById(fieldId: string): FillableElement | null {
  const el = document.querySelector(`[${FIELD_ID_ATTR}="${fieldId}"]`);
  return (el as FillableElement) ?? null;
}

/** Number of distinct forms containing detected fields (0 = formless page). */
export function countForms(fields: DetectedField[]): number {
  const forms = new Set<HTMLFormElement | null>();
  fields.forEach((f) => forms.add(f.element.closest('form')));
  return Array.from(forms).filter(Boolean).length || (fields.length ? 1 : 0);
}
