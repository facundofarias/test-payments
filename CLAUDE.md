# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Test Payments is a Chrome extension (Manifest V3) that adds a right-click "Test Payments" context menu to editable fields on any page. Selecting a menu item injects payment/identity test data (credit card numbers, names, addresses, phones for Stripe, Adyen, Braintree, Checkout.com, etc.) into the focused input. Some entries generate fresh fake identity data on demand via Chrome's built-in on-device AI (Gemini Nano). It is a fork of [bugmagnet](https://github.com/gojko/bugmagnet), so internal identifiers still use the `BugMagnet` namespace.

## Commands

- **Setup (one-time):** `npm install`.
- **Run tests:** `npm test` — runs the Jasmine specs in `test/` under a jsdom DOM (no browser needed). Config is `test-lib/jasmine.json`.
- **Run a single spec/suite:** scope with Jasmine's `fdescribe`/`fit`, or edit the `spec_files` list in `test-lib/jasmine.json`.
- **Package for the Chrome Web Store:** `./pack.sh` — reads `version` from `src/manifest.json` and zips the contents of `src/` into `src/<version>.zip`.
- **Run locally:** load `src/manifest.json` as an unpacked extension in Chrome (`chrome://extensions` → Developer mode → Load unpacked → select `src/`).

## Architecture

Two independent scripts communicate across the extension boundary via Chrome messaging:

- **`src/extension.js`** — background **service worker** (MV3). `BugMagnet.buildMenus` runs on `chrome.runtime.onInstalled`/`onStartup`: it `removeAll`s existing menus, `fetch`es `config.json`, and `BugMagnet.processConfigText` walks the config tree to build the menu via `BugMagnet.ChromeMenuBuilder` (a thin wrapper over `chrome.contextMenus`). A single `chrome.contextMenus.onClicked` listener dispatches clicks by decoding the item's value and sending it to the active tab with `chrome.tabs.sendMessage`.
- **`src/context-element.js`** — content script (injected on `<all_urls>`, unchanged from MV2). Listens for messages and writes the resolved value into the currently focused element (`INPUT`/`TEXTAREA` via `.value`, contenteditable `DIV` via `.innerText`). It drills through `contentDocument` to reach the active element inside same-domain iframes.

### MV3 value-encoding (important)

MV3 forbids `onclick` handlers on `contextMenus.create`, and the service worker can be evicted and restarted at any time. So `ChromeMenuBuilder.menuItem` encodes the value to insert **into the leaf item's id** as `"<sequence>:<JSON>"` (the sequence prefix guarantees uniqueness even for duplicate values). Container items (root/sub-menus) get plain `"menu-N"` ids — MV3 requires an explicit id on *every* item. `BugMagnet.valueFromMenuId` decodes the value in the `onClicked` listener (returning `false` for container ids, which have no `:`). This keeps click handling stateless — no in-memory map to lose on a service-worker restart. Do not reintroduce `onclick` or persistent background state.

### Config format (`src/config.json`)

The menu is data-driven by this JSON file. `processConfigText` interprets it recursively:
- **String value** → a leaf menu item; the raw string is inserted as-is.
- **Object without `_type`** → a sub-menu; keys become labels (nesting is arbitrary depth).
- **Array of strings** → a sub-menu where each string is both label and value.
- **Object with a `_type` property** → a leaf item carrying a generator request (see below).

Card data is organized per provider: a **Test values** sub-menu (insertable expiry/CVV/AVS/magic values) plus card numbers, decline scenarios, and 3DS cards. Note that providers force declines differently — dedicated card numbers, magic values in the cardholder-name field (PayPal/Worldpay/MercadoPago), or magic amounts (Mollie) — so scenario labels matter.

### Value generators (`_type`)

Values are resolved in one of two places depending on `_type`:

- **Content script (`context-element.js`), synchronously** — the `generators` map:
  - `literal` — returns `value` verbatim (plain strings are normalised to `{_type:'literal'}` in `extension.js`).
  - `size` — repeats `template` until it reaches `size` characters (for boundary/length testing).
- **Service worker (`extension.js`), asynchronously** — `BugMagnet.resolveMenuValue`:
  - `llm` — generates fake identity data via Chrome's built-in Prompt API (Gemini Nano) using `value.prompt`, then sends the result to the content script as a `literal`. Requires the `aiLanguageModel` permission and `minimum_chrome_version: 138`. Every `llm` entry must include a static `fallback`, used when the model is unavailable/unsupported/not-yet-downloaded so the extension degrades gracefully. Generation is **best-effort**: it is bounded by `BugMagnet.GENERATE_TIMEOUT_MS` (falls back on timeout) and, because resolution is async, the value is inserted wherever focus is at message-receipt time. Generation is non-deterministic and on-device (offline). The Prompt API global (`LanguageModel`) is read via the IIFE's `global`, so specs inject a fake `LanguageModel` on the Node global.

To add a synchronous data kind, add a generator to `generators` in `context-element.js`; for an async/service-side kind, extend `resolveMenuValue` in `extension.js`. Reference either via `_type` in `config.json`. Adding static test data requires only editing `config.json`.

## Testing notes

- `test-lib/node-bootstrap.js` (a Jasmine helper) sets up jsdom globals (`window`/`document`/`self`), then loads `test-lib/fake-chrome-api.js` and the `src/` scripts so their load-time listener registrations happen once before specs run. Order matters: fake chrome before source.
- `test-lib/fake-chrome-api.js` is a Jasmine spy stub of the MV3 `chrome.*` surface (`runtime.onInstalled/onStartup/onMessage/getURL`, `contextMenus.create/removeAll/onClicked`, `tabs.sendMessage`).
- `test/background-spec.js` covers the MV3 wiring (id encode/decode, `onClicked` dispatch, install/startup rebuild, `buildMenus`). `test/context-menu-handler-spec.js` exercises real DOM behavior (focus, contenteditable, iframes) — jsdom handles all of these faithfully.
