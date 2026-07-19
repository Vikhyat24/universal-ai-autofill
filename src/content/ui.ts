/**
 * In-page UI, rendered inside a closed shadow root for full style isolation.
 * Components: floating action button, review/edit panel, toasts, and the
 * smart-learning prompt. Plain DOM (no React) to keep the content bundle
 * small and fast.
 */
import { EXT_PREFIX } from '@/shared/constants';
import { KIND_LABELS, TAXONOMY } from '@/shared/taxonomy';
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
.${EXT_PREFIX}-fields { overflow-y: auto; padding: 8px 10px; flex: 1; }
.${EXT_PREFIX}-row {
  display: grid; grid-template-columns: 18px 1fr; gap: 8px;
  padding: 8px 6px; border-radius: 9px; align-items: start;
}
.${EXT_PREFIX}-row:hover { background: #201e29; }
.${EXT_PREFIX}-row input[type=checkbox] { margin-top: 5px; accent-color: #91e63e; }
.${EXT_PREFIX}-row .meta { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; flex-wrap: wrap; }
.${EXT_PREFIX}-row .lbl { font-size: 12px; font-weight: 600; color: #cfcbe0; }
.${EXT_PREFIX}-row .kind {
  font-size: 10px; background: #2c2a38; color: #91e63e; padding: 1.5px 7px;
  border-radius: 999px; border: none; cursor: pointer;
}
.${EXT_PREFIX}-row .conf-low { color: #f0b35f; }
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

    const inputs = new Map<string, { check: HTMLInputElement; value: HTMLInputElement }>();

    for (const f of fillable) {
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
      const kindBtn = document.createElement('button');
      kindBtn.className = 'kind' + (f.confidence < 0.6 ? ' conf-low' : '');
      kindBtn.title = 'Click to correct the field type';
      kindBtn.textContent = f.kind === 'custom' ? (f.customKey ?? 'custom') : (KIND_LABELS[f.kind] ?? f.kind);
      kindBtn.addEventListener('click', () => {
        const kinds = TAXONOMY.map((t) => t.kind);
        const current = kinds.indexOf(f.kind as (typeof kinds)[number]);
        const pick = prompt(
          `Correct field type for "${f.label}".\nOne of: ${kinds.join(', ')}`,
          current >= 0 ? f.kind : '',
        );
        if (pick && kinds.includes(pick as (typeof kinds)[number])) {
          this.cb.onKindCorrected(f.fieldId, pick as FieldKind);
        }
      });
      meta.append(lbl, kindBtn);

      const valueInput = document.createElement('input');
      valueInput.type = 'text';
      valueInput.value = f.proposedValue;

      body.append(meta, valueInput);
      row.append(check, body);
      list.appendChild(row);
      inputs.set(f.fieldId, { check, value: valueInput });
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
