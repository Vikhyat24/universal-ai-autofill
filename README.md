# ⚡ Universal AI Autofill

A production-ready, privacy-first autofill extension for **all Chromium browsers** (Chrome, Brave, Edge, Opera, Vivaldi). It detects form fields on any website, understands what each field means — even with unusual names like `candidate_mail` — and fills them from your saved profiles in seconds.

**It never clicks Submit. Your data never leaves your device.**

## Features

- **Universal form detection** — text, email, phone, password (opt-in), address, date, number, selects, radios, checkboxes, textareas, multi-step and dynamically loaded forms (MutationObserver).
- **Intelligent field recognition** — combines label text, placeholder, `name`/`id`, `aria-label`, `autocomplete`, nearby text, section headings and fuzzy semantic matching. "First Name" ≡ "Given Name" ≡ "Applicant Name"; `mailid` ≡ `user_email` ≡ Email. 35+ canonical field kinds, including job-application specifics (work authorization, visa sponsorship, notice period, start date, pronouns, EEO fields).
- **Résumé import** — drop a **PDF, DOCX or TXT** résumé (or paste its text) and the extension parses it into a profile, entirely on your device. Review every extracted field, then create a new profile or merge into an existing one.
- **Multiple profiles** — Personal, Professional, Job Applications… grouped fields plus unlimited custom fields; duplicate a profile in one click. Per-site preferred profile is remembered.
- **One-click autofill** — popup button, floating ⚡ button on pages with forms, right-click context menu, and keyboard shortcuts (`Alt+Shift+F` fill, `Alt+Shift+R` review).
- **Review before fill** — grouped by form section, edit values, select all/none, correct a field's type with an inline dropdown (which the extension **learns**), or save an edited value straight back to your profile.
- **Undo last fill** — reverted in one tap from the confirmation toast.
- **Per-site rules** — set any site to auto-fill, always-review, or disabled, straight from the popup.
- **Smart learning** — change a filled value and the extension offers to remember it; field-type corrections are stored as learned mappings.
- **Search & stats** — search across every profile field, learned mapping and history entry; see how many fields you've filled (counted locally).
- **Privacy-first** — 100% offline, zero network requests, minimal permissions, profiles encrypted at rest with AES-GCM (WebCrypto).
- **Backups** — export/import JSON, optionally **password-protected** (PBKDF2 + AES-GCM).
- **Modern UI** — React popup + options dashboard, light/dark/system themes.

## Installation (from source)

```bash
npm install
npm run build
```

Then in your browser:

1. Open `chrome://extensions` (or `brave://extensions`, `edge://extensions`, …).
2. Enable **Developer mode** (top-right toggle).
3. Click **Load unpacked** and select the `dist/` folder.
4. The options page opens automatically — fill in your first profile and you're done.

## Development setup

```bash
npm install
npm run dev        # Vite dev server with HMR (load dist/ as unpacked once)
npm run typecheck  # strict TypeScript check
npm test           # vitest unit tests (field-mapping engine)
npm run lint       # eslint
npm run build      # typecheck + production build into dist/
```

The stack: **Manifest V3 + TypeScript (strict) + React 18 + Vite + @crxjs/vite-plugin + Vitest**. Résumé parsing uses **pdfjs-dist** (PDF) and **fflate** (DOCX), both bundled and code-split so they load only when a file is actually opened — no network, ever.

Regenerate icons (pure Node, no dependencies): `node scripts/generate-icons.mjs`.

## Usage

| Action | How |
| --- | --- |
| Fill the current page | Popup → **⚡ Autofill Current Page**, or the floating ⚡ button, or `Alt+Shift+F` |
| Undo a fill | Click **Undo** on the toast shown right after filling |
| Review & edit before filling | Popup → **Review first**, right-click → *Review detected fields…*, or `Alt+Shift+R` |
| Fill only some fields | Open the review panel, use **Select all / None** or untick individual fields |
| Import a résumé | Options → **Import** → drop a PDF/DOCX/TXT or paste text → review → create or merge |
| Switch profile for a site | Popup profile dropdown (remembered per hostname) |
| Set per-site behavior | Popup → **On \<site\>:** → Auto-fill / Always review / Disable |
| Teach a correction | In the review panel change a field's **type dropdown**; or edit a filled value and accept "Remember?" |
| Save an edited value to your profile | Click 💾 next to the field in the review panel |
| Search your data | Options → **Search** |
| Backup / restore | Popup or Options → Data tab → Export (optionally encrypted) / Import |
| Disable on a site | Popup → *Disable here*, or Options → Settings → Ignored websites |

## Testing strategy

- **Unit tests** (`npm test`) cover the core risk: the semantic mapper (`src/services/mapping/`) — label variants, unusual names, negative-keyword vetoes, learned mappings, custom keys, select-option matching.
- **Manual smoke test**: open `test-page/demo-form.html` in the browser with the extension loaded — it contains standard, hostile-naming, dynamic and multi-step fields.
- **Recommended additions** (see docs/ROADMAP.md): Playwright end-to-end tests driving a real Chromium with the built extension against fixture forms; DOM detector tests under jsdom.

## Project structure

```
src/
  manifest.ts             MV3 manifest (typed, via @crxjs)
  shared/                 types, field taxonomy, constants, messaging
  services/
    crypto.ts             AES-GCM at-rest encryption (WebCrypto)
    backupCrypto.ts       PBKDF2 + AES-GCM password-protected backups
    storage.ts            single gateway to chrome.storage (swappable backend)
    profileService.ts     profile domain logic, value derivation, site-rule resolver
    mapping/              signal extraction + semantic mapper (+ tests)
    resume/               résumé → profile: readers (pdf/docx/txt) + extractor (+ tests)
  content/                detector, fill engine, shadow-DOM UI, orchestrator
  background/             service worker: commands, context menu, install seed
  popup/                  React popup (profile switch, per-site rule, stats)
  options/                React options dashboard (Profiles / Import / Search / Settings / Data)
  ui/                     shared theme, hooks, backup helpers
docs/                     ARCHITECTURE, SECURITY, ROADMAP
scripts/generate-icons.mjs
test-page/demo-form.html  manual test playground
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full design, [docs/SECURITY.md](docs/SECURITY.md) for the security model, and [docs/ROADMAP.md](docs/ROADMAP.md) for planned features (LLM mapping, cloud sync, resume autofill, OCR…).
