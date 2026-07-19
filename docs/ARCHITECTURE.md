# Architecture

## Overview

```
┌─────────────────────────────────────────────────────────────────┐
│  Web page                                                       │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ content/index.ts  (orchestrator)                          │  │
│  │   detector.ts ──► signals ──► services/mapping/mapper.ts  │  │
│  │   filler.ts   ◄── proposed values ◄── profileService      │  │
│  │   ui.ts (shadow DOM: FAB, review panel, toasts, learning) │  │
│  └───────────────────────────────────────────────────────────┘  │
└───────────────▲─────────────────────────────▲───────────────────┘
                │ runtime messages            │ chrome.storage (direct)
┌───────────────┴───────────┐   ┌─────────────┴───────────────────┐
│ background/index.ts       │   │ services/                       │
│  commands, context menu,  │   │  storage.ts ◄─ crypto.ts        │
│  install seeding          │   │  profileService.ts              │
└───────────────▲───────────┘   └─────────────▲───────────────────┘
                │                             │
        ┌───────┴─────────┐          ┌────────┴────────┐
        │ popup (React)   │          │ options (React) │
        └─────────────────┘          └─────────────────┘
```

## Layers

### 1. Shared (`src/shared/`)
- `types.ts` — every cross-context type: `Profile`, `Settings`, `FieldKind`, the `RuntimeMessage` protocol, `BackupPayload` (versioned).
- `taxonomy.ts` — the **field knowledge base**: per-kind keywords, phrases, `autocomplete` values, input-type hints and negative (veto) tokens; plus `deriveValue` (fullName ⇄ first/last).
- `messaging.ts` — typed wrappers over `chrome.runtime`/`chrome.tabs` messaging.

### 2. Services (`src/services/`) — pure logic, no DOM
- `crypto.ts` — AES-GCM 256 via WebCrypto. `encryptJson`/`decryptJson` with a versioned `enc:v1:` envelope; transparently reads legacy plaintext.
- `storage.ts` — the **only** module that touches `chrome.storage`. Profiles and learned mappings are encrypted at rest. Exposes backup import/export. Designed so a cloud-sync backend can implement the same functions later.
- `profileService.ts` — profile creation, value resolution with derivation, per-site profile selection (`site preference → explicit → default → first`).
- `mapping/signals.ts` — `FieldSignals` (serializable), normalization (camelCase/snake_case splitting), signatures for learning, Dice-coefficient similarity.
- `mapping/mapper.ts` — the matching pipeline:
  1. learned mappings (user corrections, highest trust)
  2. `autocomplete` attribute (standards-based, 0.98)
  3. input-type hints (email/tel/date)
  4. weighted taxonomy scoring across 9 signals (label 1.0 → heading 0.3), with negative-token vetoes
  5. fuzzy custom-field matching
  Output is `(kind, confidence 0..1)`; fills happen only above `FILL_CONFIDENCE_THRESHOLD`.

### 3. Content script (`src/content/`)
- `detector.ts` — one `querySelectorAll` pass (+ open shadow roots), visibility filtering, label map prebuilt per scan, nearby-text/section-heading extraction. Fields get stable `data-uaf-field-id`s.
- `filler.ts` — framework-safe value writing: native prototype setters + `input`/`change`/`blur` events (works with React/Vue/Angular), select/radio option matching, checkbox truthiness, date coercion. **Never submits.**
- `ui.ts` — closed-shadow-root UI: floating action button, review/edit panel with profile switcher and type-correction chips, toasts, learning prompts.
- `index.ts` — orchestrates scan → map → UI → fill; debounced MutationObserver for SPA/dynamic/multi-step forms; smart-learning hooks; message handlers.

### 4. Background (`src/background/`)
Thin by design: context menus, keyboard command routing, first-install seeding. All data access still goes through `services/storage`.

### 5. UI (`src/popup/`, `src/options/`, `src/ui/`)
React 18. Shared CSS-variable theme with light/dark/system. Popup = quick actions; Options = full dashboard (Profiles / Settings / Data).

## Key design decisions

| Decision | Rationale |
| --- | --- |
| All mapping logic is pure over serializable `FieldSignals` | An LLM mapper can be swapped in later without touching the detector; signals can be sent as-is to a model |
| Content script reads storage directly | Avoids background round-trips → faster fills; the service worker can sleep |
| Plain DOM (no React) in the content script | Small bundle, fast injection, zero framework conflicts with host pages |
| Closed shadow root for injected UI | Host-page CSS/JS cannot style or observe our UI |
| Versioned `BackupPayload` and `enc:v1:` envelope | Forward-compatible migrations |
| Confidence threshold + review panel | Wrong fills are worse than missed fills |

## Performance

- Single DOM pass per scan; label lookup via prebuilt map (O(labels)+O(fields), no per-field document scans).
- Re-scans debounced (400 ms) and only on element-level childList mutations; our own UI mutations are filtered out.
- Mapper is synchronous, allocation-light, ~µs per field.
- Content bundle ≈ 8 kB gzipped; React is only loaded in popup/options.

## Extension points (see ROADMAP)

- `Mapper`: add an async LLM implementation behind the same `mapField` contract, gated by `Settings.aiMappingEnabled`.
- `storage.ts`: add a `SyncBackend` implementing the same CRUD, fan out writes.
- `BackupPayload`: bump `version` for schema migrations.
