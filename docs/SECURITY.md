# Security & Privacy

## Principles

1. **Offline by default.** The extension makes zero network requests. There is no telemetry, no analytics, no external server.
2. **Minimal permissions.** `storage`, `activeTab`, `scripting`, `contextMenus`. No `tabs`, no `webRequest`, no host-permission network access. The content script match (`<all_urls>`) exists only so autofill works everywhere; it runs locally.
3. **Never submit.** The fill engine writes values and dispatches events but never triggers form submission or clicks buttons.
4. **User in control.** Review-before-fill, per-field opt-out, ignored-sites list, one-click full data wipe.

## Data at rest

- Profiles and learned mappings are encrypted with **AES-GCM 256** (WebCrypto) before being written to `chrome.storage.local` (`enc:v1:<iv>:<ciphertext>` envelope, fresh IV per write).
- The AES key is generated on first use and stored in `chrome.storage.local`.

**Honest threat model:** because the key lives beside the data, this protects against casual inspection/copying of the extension's storage files, not against an attacker with full control of the OS user account. True protection requires a user passphrase (PBKDF2/Argon2-derived key) — the `crypto.ts` API is already shaped for that upgrade (planned, see ROADMAP).

- Exported backup files are **plaintext JSON** by design (portability). The UI warns users to store them safely.

## Sensitive-field policy

- `password` fields are recognized but **never auto-filled** (the fill pipeline skips `kind === 'password'`). Browsers' native password managers do this better and more safely.
- Payment data (card numbers, CVV) is deliberately absent from the taxonomy. On bank/checkout pages the extension fills only identity/address data.
- Recommended: add your bank's hostname to **Ignored websites** to keep the extension fully inert there.

## Injection & isolation

- Injected UI lives in a **closed shadow root** — host pages cannot read or restyle it, and our styles cannot leak out.
- The content script runs in Chrome's isolated world; page scripts cannot call our functions or read extension storage.
- All values written into the DOM originate from the user's own stored data; nothing from the page is executed. Field text extracted from pages is treated as data only (used for matching), never as HTML — the review panel renders it via `textContent`.

## Known residual risks

| Risk | Mitigation |
| --- | --- |
| Malicious page hides fields hoping for silent data fill | Detector skips invisible/disabled fields; confidence threshold; review mode; per-site profiles limit blast radius |
| Backup JSON left in Downloads | User education (warning in UI); encrypted export planned |
| Key-beside-data encryption | Passphrase mode planned; encryption still raises the bar |
| Learned mappings could be poisoned by a hostile site's labels | Mappings are only saved on explicit user action |

## Reporting

Security issues: open a private report to the repository owner. Do not file public issues for exploitable bugs.
