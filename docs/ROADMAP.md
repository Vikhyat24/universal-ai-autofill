# Roadmap

The architecture was designed so each of these lands without major refactoring. The relevant seam is noted for every item.

## Near term

- **Passphrase-derived encryption key** — replace the stored AES key with PBKDF2/Argon2 derivation from a user passphrase, with an unlock flow.
  *Seam:* `services/crypto.ts` `getKey()` — callers are unchanged.
- **Encrypted backup export** — password-protect the exported JSON.
  *Seam:* `ui/backup.ts` + `BackupPayload` version bump.
- **Playwright E2E suite** — real Chromium + built extension against fixture forms (standard, hostile naming, SPA-rendered, multi-step).
  *Seam:* `test-page/` fixtures already exist; add `e2e/` with `chromium.launchPersistentContext` and `--load-extension`.
- **Per-frame support** — enable `all_frames: true` with per-frame detection budgets for iframe-heavy checkout pages.

## Mid term

- **LLM-powered field recognition** — an async `Mapper` that sends *only field metadata* (`FieldSignals`, never values) to a user-configured endpoint (local Ollama or an API key the user provides), used as fallback when the offline mapper's confidence is low; responses cached as learned mappings.
  *Seam:* `services/mapping/mapper.ts` — `FieldSignals` is already serializable; gate behind an explicit opt-in setting since it relaxes the no-network guarantee.
- **Cloud sync across devices** — a `SyncBackend` interface (push/pull/merge with `updatedAt` conflict resolution) implemented first for the user's own storage (chrome.storage.sync for small payloads, or user-supplied endpoints). End-to-end encrypted with the passphrase key.
  *Seam:* `services/storage.ts` is the single storage gateway.
- **Resume autofill** — parse a resume (PDF/DOCX) into profile fields; map "upload resume + retype everything" job portals in one shot.
  *Seam:* new `services/resume/` producing a `Profile`; options UI already supports arbitrary fields.
- **Address autocomplete quality** — country-aware state/zip formats, phone formatting per locale.
  *Seam:* `filler.ts` coercion functions.

## Long term

- **Team / shared profiles** — org-distributed read-only profiles (company address, VAT numbers) layered under personal profiles.
  *Seam:* `pickProfile` already resolves through an ordered chain; add a "shared" source.
- **OCR for PDF/scanned forms** — render PDFs, OCR field labels, produce `FieldSignals`, reuse the same mapper.
- **Browser-to-browser sync** — WebRTC pairing with QR code, E2E encrypted transfer of the backup payload.
- **Mobile support** — the codebase is MV3 + standard web APIs; Firefox for Android and Safari iOS ports need manifest tweaks (`browser_specific_settings`, safari-web-extension-converter) and popup-first UX (no floating button).

## Quality backlog

- jsdom tests for `detector.ts` (label association, nearby text, shadow DOM).
- Fuzz corpus of real-world form HTML for mapper regression tests.
- i18n of taxonomy keywords (es/fr/de/hi already partially seeded) and UI strings.
- Options-page search across all stored data.
