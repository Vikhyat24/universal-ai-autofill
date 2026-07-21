/**
 * In-page UI, rendered inside a closed shadow root for full style isolation.
 * Components: floating action button, review/edit panel, toasts, and the
 * smart-learning prompt. Plain DOM (no React) to keep the content bundle
 * small and fast.
 */
import { EXT_PREFIX } from '@/shared/constants';
import { TAXONOMY } from '@/shared/taxonomy';
import type { DetectedFieldInfo, Profile, FieldKind } from '@/shared/types';

const CSS = `
:host { all: initial; }
* { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
.${EXT_PREFIX}-fab {
  position: fixed; z-index: 2147483646; right: 18px; bottom: 18px;
  display: flex; align-items: center; gap: 8px;
  background: #1c1b22; color: #fff; border: 1px solid #3a3846;
  border-radius: 999px; padding: 10px 16px; cursor: pointer;
  font-size: 13.5px; font-weight: 600; letter-spacing: .01em;
  box-shadow: 0 4px 18px rgba(0,0,0,.28); user-select: none;
  transition: transform .12s ease, box-shadow .12s ease;
}
.${EXT_PREFIX}-fab:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,.34); }
.${EXT_PREFIX}-fab .zap { color: #91e63e; font-size: 15px; }
.${EXT_PREFIX}-fab .count {
  background: #91e63e; color: #0d0d0d; border-radius: 999px; font-size: 11px;
  padding: 2px 7px; font-weight: 700;
}
.${EXT_PREFIX}-fab .close {
  margin-left: 2px; opacity: .55; font-size: 15px; padding: 0 2px;
}
.${EXT_PREFIX}-fab .close:hover { opacity: 1; }

.${EXT_PREFIX}-panel {
  position: fixed; z-index: 2147483647; right: 18px; bottom: 18px;
  width: 380px; max-width: calc(100vw - 36px); max-height: min(72vh, 640px);
  background: #17161d; color: #e8e6f0; border: 1px solid #34323f;
  border-radius: 14px; box-shadow: 0 12px 48px rgba(0,0,0,.5);
  display: flex; flex-direction: column; overflow: hidden;
}
.${EXT_PREFIX}-panel header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 13px 16px; border-bottom: 1px solid #2b2936;
}
.${EXT_PREFIX}-panel header b { font-size: 14px; }
.${EXT_PREFIX}-panel header .x { cursor: pointer; opacity: .6; font-size: 17px; background: none; border: none; color: inherit; }
.${EXT_PREFIX}-panel header .x:hover { opacity: 1; }
.${EXT_PREFIX}-profilebar { padding: 10px 16px; border-bottom: 1px solid #2b2936; display: flex; gap: 8px; align-items: center; }
.${EXT_PREFIX}-profilebar select {
  flex: 1; background: #23212c; color: #e8e6f0; border: 1px solid #3a3846;
  border-radius: 8px; padding: 6px 8px; font-size: 12.5px;
}
.${EXT_PREFIX}-toolbar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 16px; border-bottom: 1px solid #2b2936; font-size: 12px; color: #918da4;
}
.${EXT_PREFIX}-toolbar .sel { display: flex; gap: 10px; }
.${EXT_PREFIX}-toolbar .sel button {
  background: none; border: none; color: #91e63e; cursor: pointer; font-size: 12px; padding: 0;
}
.${EXT_PREFIX}-toolbar .sel button:hover { text-decoration: underline; }
.${EXT_PREFIX}-fields { overflow-y: auto; padding: 8px 10px; flex: 1; }
.${EXT_PREFIX}-group { font-size: 10px; text-transform: uppercase; letter-spacing: .06em;
  color: #6f6b80; font-weight: 700; padding: 8px 6px 3px; }
.${EXT_PREFIX}-row {
  display: grid; grid-template-columns: 18px 1fr; gap: 8px;
  padding: 8px 6px; border-radius: 9px; align-items: start;
}
.${EXT_PREFIX}-row:hover { background: #201e29; }
.${EXT_PREFIX}-row input[type=checkbox] { margin-top: 5px; accent-color: #91e63e; }
.${EXT_PREFIX}-row .meta { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; flex-wrap: wrap; }
.${EXT_PREFIX}-row .lbl { font-size: 12px; font-weight: 600; color: #cfcbe0; flex: 1; }
.${EXT_PREFIX}-row select.kind {
  font-size: 10px; background: #2c2a38; color: #91e63e; padding: 2px 6px;
  border-radius: 999px; border: 1px solid #3a3846; cursor: pointer; max-width: 130px;
}
.${EXT_PREFIX}-row select.kind.conf-low { color: #f0b35f; border-color: #6b5a30; }
.${EXT_PREFIX}-row .save {
  background: none; border: none; color: #918da4; cursor: pointer; font-size: 13px;
  padding: 0 2px; opacity: .7;
}
.${EXT_PREFIX}-row .save:hover { opacity: 1; color: #91e63e; }
.${EXT_PREFIX}-row input[type=text] {
  width: 100%; background: #23212c; color: #f0eef8; border: 1px solid #3a3846;
  border-radius: 8px; padding: 6px 9px; font-size: 12.5px;
}
.${EXT_PREFIX}-row input[type=text]:focus { outline: 2px solid #91e63e55; border-color: #91e63e; }
.${EXT_PREFIX}-panel footer {
  padding: 12px 16px; border-top: 1px solid #2b2936; display: flex; gap: 10px;
}
.${EXT_PREFIX}-btn {
  flex: 1; border: none; border-radius: 9px; padding: 9px 12px; font-size: 13px;
  font-weight: 700; cursor: pointer; transition: filter .1s ease;
}
.${EXT_PREFIX}-btn:hover { filter: brightness(1.12); }
.${EXT_PREFIX}-btn.primary { background: #91e63e; color: #0d0d0d; }
.${EXT_PREFIX}-btn.ghost { background: #262430; color: #cfcbe0; flex: 0 0 auto; }
.${EXT_PREFIX}-toast {
  position: fixed; z-index: 2147483647; right: 18px; bottom: 84px;
  background: #17161d; color: #e8e6f0; border: 1px solid #34323f;
  border-radius: 11px; padding: 11px 16px; font-size: 13px;
  box-shadow: 0 8px 30px rgba(0,0,0,.4); display: flex; gap: 10px; align-items: center;
  animation: ${EXT_PREFIX}-in .18s ease;
}
@keyframes ${EXT_PREFIX}-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
.${EXT_PREFIX}-toast .ok { color: #7ee2a8; }
.${EXT_PREFIX}-toast button {
  background: #2c2a38; border: none; color: #91e63e; border-radius: 7px;
  padding: 5px 10px; font-size: 12px; font-weight: 600; cursor: pointer;
}
.${EXT_PREFIX}-note { padding: 20px 16px; font-size: 12.5px; color: #918da4; text-align: center; }
`;

export interface UICallbacks {
  onFill: (fieldIds: string[], overrides: Record<string, string>, profileId: string) => void;
  onProfileChange: (profileId: string) => void;
  onKindCorrected: (fieldId: string, kind: FieldKind) => void;
  onSaveField: (kind: FieldKind, customKey: string | undefined, value: string) => void;
  onDismissFab: () => void;
}

export class ContentUI {
  private host: HTMLDivElement;
  private root: ShadowRoot;
  private fab: HTMLDivElement | null = null;
  private panel: HTMLDivElement | null = null;
  private toastEl: HTMLDivElement | null = null;
  private toastTimer: number | undefined;

  constructor(private cb: UICallbacks) {
    this.host = document.createElement('div');
    this.host.setAttribute('data-uaf-ui', '');
    this.root = this.host.attachShadow({ mode: 'closed' });
    const style = document.createElement('style');
    style.textContent = CSS;
    this.root.appendChild(style);
    document.documentElement.appendChild(this.host);
  }

  // ------------------------------------------------------------ FAB

  showFab(fieldCount: number, onClick: () => void): void {
    this.hideFab();
    const fab = document.createElement('div');
    fab.className = `${EXT_PREFIX}-fab`;
    fab.innerHTML = `<span class="zap">⚡</span><span>Autofill Form</span><span class="count">${fieldCount}</span><span class="close" title="Hide">×</span>`;
    fab.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).classList.contains('close')) {
        this.hideFab();
        this.cb.onDismissFab();
        return;
      }
      onClick();
    });
    this.root.appendChild(fab);
    this.fab = fab;
  }

  hideFab(): void {
    this.fab?.remove();
    this.fab = null;
  }

  // ------------------------------------------------------------ review panel

  showReviewPanel(fields: DetectedFieldInfo[], profiles: Profile[], activeProfileId: string): void {
    this.closePanel();
    const panel = document.createElement('div');
    panel.className = `${EXT_PREFIX}-panel`;

    const fillable = fields.filter((f) => f.proposedValue);
    const header = document.createElement('header');
    header.innerHTML = `<b>⚡ Review &amp; Fill (${fillable.length})</b>`;
    const closeBtn = document.createElement('button');
    closeBtn.className = 'x';
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', () => this.closePanel());
    header.appendChild(closeBtn);
    panel.appendChild(header);

    // profile picker
    if (profiles.length > 0) {
      const bar = document.createElement('div');
      bar.className = `${EXT_PREFIX}-profilebar`;
      const sel = document.createElement('select');
      profiles.forEach((p) => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = `${p.emoji ?? '👤'} ${p.name}`;
        if (p.id === activeProfileId) opt.selected = true;
        sel.appendChild(opt);
      });
      sel.addEventListener('change', () => this.cb.onProfileChange(sel.value));
      bar.appendChild(sel);
      panel.appendChild(bar);
    }

    const inputs = new Map<string, { check: HTMLInputElement; value: HTMLInputElement }>();

    // Select all / none toolbar.
    if (fillable.length) {
      const toolbar = document.createElement('div');
      toolbar.className = `${EXT_PREFIX}-toolbar`;
      const count = document.createElement('span');
      count.textContent = `${fillable.length} field${fillable.length === 1 ? '' : 's'} ready`;
      const sel = document.createElement('div');
      sel.className = 'sel';
      const all = document.createElement('button');
      all.textContent = 'Select all';
      all.addEventListener('click', () => inputs.forEach((v) => (v.check.checked = true)));
      const none = document.createElement('button');
      none.textContent = 'None';
      none.addEventListener('click', () => inputs.forEach((v) => (v.check.checked = false)));
      sel.append(all, none);
      toolbar.append(count, sel);
      panel.appendChild(toolbar);
    }

    const list = document.createElement('div');
    list.className = `${EXT_PREFIX}-fields`;

    if (!fillable.length) {
      const note = document.createElement('div');
      note.className = `${EXT_PREFIX}-note`;
      note.textContent = profiles.length
        ? 'No matching data for the detected fields. Add more info to your profile in Options.'
        : 'No profile yet — open the extension popup to create one.';
      list.appendChild(note);
    }

    // Group rows under their section headings (falls back to "Fields").
    const groups = new Map<string, DetectedFieldInfo[]>();
    for (const f of fillable) {
      const key = (f.section && f.section.trim()) || 'Fields';
      (groups.get(key) ?? groups.set(key, []).get(key)!).push(f);
    }
    const showGroups = groups.size > 1;

    for (const [groupName, groupFields] of groups) {
      if (showGroups) {
        const gh = document.createElement('div');
        gh.className = `${EXT_PREFIX}-group`;
        gh.textContent = groupName;
        list.appendChild(gh);
      }
      for (const f of groupFields) {
        list.appendChild(this.buildRow(f, inputs));
      }
    }
    panel.appendChild(list);

    const footer = document.createElement('footer');
    const cancel = document.createElement('button');
    cancel.className = `${EXT_PREFIX}-btn ghost`;
    cancel.textContent = 'Cancel';
    cancel.addEventListener('click', () => this.closePanel());
    const fill = document.createElement('button');
    fill.className = `${EXT_PREFIX}-btn primary`;
    fill.textContent = `Fill ${fillable.length} field${fillable.length === 1 ? '' : 's'}`;
    fill.disabled = !fillable.length;
    fill.addEventListener('click', () => {
      const ids: string[] = [];
      const overrides: Record<string, string> = {};
      inputs.forEach((v, id) => {
        if (v.check.checked && v.value.value) {
          ids.push(id);
          overrides[id] = v.value.value;
        }
      });
      this.closePanel();
      const sel = panel.querySelector('select');
      this.cb.onFill(ids, overrides, sel?.value ?? activeProfileId);
    });
    footer.append(cancel, fill);
    panel.appendChild(footer);

    this.root.appendChild(panel);
    this.panel = panel;
    this.hideFab();
  }

  /** Build one review row (checkbox, label, type dropdown, save, value input). */
  private buildRow(
    f: DetectedFieldInfo,
    inputs: Map<string, { check: HTMLInputElement; value: HTMLInputElement }>,
  ): HTMLDivElement {
    const row = document.createElement('div');
    row.className = `${EXT_PREFIX}-row`;

    const check = document.createElement('input');
    check.type = 'checkbox';
    check.checked = true;

    const body = document.createElement('div');
    const meta = document.createElement('div');
    meta.className = 'meta';
    const lbl = document.createElement('span');
    lbl.className = 'lbl';
    lbl.textContent = f.label || f.signature || '(unnamed field)';

    // Inline field-type dropdown (replaces the old prompt-based correction).
    const kindSel = document.createElement('select');
    kindSel.className = 'kind' + (f.confidence < 0.6 ? ' conf-low' : '');
    kindSel.title = 'Field type — change it to correct the match (the extension learns).';
    if (f.kind === 'custom') {
      const opt = document.createElement('option');
      opt.value = 'custom';
      opt.textContent = f.customKey ?? 'custom';
      opt.selected = true;
      kindSel.appendChild(opt);
    }
    for (const t of TAXONOMY) {
      const opt = document.createElement('option');
      opt.value = t.kind;
      opt.textContent = t.label;
      if (f.kind === t.kind) opt.selected = true;
      kindSel.appendChild(opt);
    }
    kindSel.addEventListener('change', () => {
      if (kindSel.value && kindSel.value !== 'custom') {
        this.cb.onKindCorrected(f.fieldId, kindSel.value as FieldKind);
      }
    });

    const valueInput = document.createElement('input');
    valueInput.type = 'text';
    valueInput.value = f.proposedValue;

    const save = document.createElement('button');
    save.className = 'save';
    save.title = 'Save this value to your profile';
    save.textContent = '💾';
    save.addEventListener('click', () => {
      const v = valueInput.value.trim();
      if (v) this.cb.onSaveField(f.kind, f.customKey, v);
    });

    meta.append(lbl, kindSel, save);
    body.append(meta, valueInput);
    row.append(check, body);
    inputs.set(f.fieldId, { check, value: valueInput });
    return row;
  }

  closePanel(): void {
    this.panel?.remove();
    this.panel = null;
  }

  // ------------------------------------------------------------ toast

  toast(message: string, actionLabel?: string, onAction?: () => void, ms = 4200): void {
    this.clearToast();
    const t = document.createElement('div');
    t.className = `${EXT_PREFIX}-toast`;
    const txt = document.createElement('span');
    txt.innerHTML = `<span class="ok">✓</span> `;
    txt.append(message);
    t.appendChild(txt);
    if (actionLabel && onAction) {
      const btn = document.createElement('button');
      btn.textContent = actionLabel;
      btn.addEventListener('click', () => {
        this.clearToast();
        onAction();
      });
      t.appendChild(btn);
    }
    const x = document.createElement('button');
    x.textContent = '×';
    x.addEventListener('click', () => this.clearToast());
    t.appendChild(x);
    this.root.appendChild(t);
    this.toastEl = t;
    this.toastTimer = window.setTimeout(() => this.clearToast(), ms);
  }

  private clearToast(): void {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastEl?.remove();
    this.toastEl = null;
  }

  destroy(): void {
    this.host.remove();
  }
}
