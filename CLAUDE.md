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

The whole extension is a single background **service worker** — `src/extension.js`. There is no persistent content script and no broad host permission; the extension uses `activeTab` + `scripting`, injecting a tiny function only into the frame the user right-clicked.

- **Menu build:** `BugMagnet.buildMenus` runs on `chrome.runtime.onInstalled`/`onStartup`: it `removeAll`s existing menus, `fetch`es `config.json`, and `BugMagnet.processConfigText` walks the config tree to build the menu via `BugMagnet.ChromeMenuBuilder` (a thin wrapper over `chrome.contextMenus`).
- **Click → insert:** a single `chrome.contextMenus.onClicked` listener decodes the item's value (`valueFromMenuId`), resolves it to a final string (`resolveText` — handles `literal`/`size` synchronously via `renderValue`, and `llm` asynchronously), then `chrome.scripting.executeScript`s `BugMagnet.insertValue` into the clicked tab/frame (`target.frameIds = [info.frameId]`) with the string as an arg. `insertValue` runs in the page and writes into `document.activeElement` (`INPUT`/`TEXTAREA` `.value`, contenteditable `.innerText`). It must stay self-contained (no closure refs) so `executeScript` can serialize it. Because it runs in the exact clicked frame, no cross-frame drilling is needed. The `activeTab` grant comes from the menu click itself, so no host permission is declared.

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

All resolution happens in the service worker (`extension.js`), producing the final string to inject:

- `literal` (sync, `renderValue`) — returns `value` verbatim (plain strings are normalised to `{_type:'literal'}` when encoded into the menu id).
- `size` (sync, `renderValue`) — repeats `template` until it reaches `size` characters (for boundary/length testing); returns `false` for an empty template.
- `llm` (async, `resolveText` → `generateValue`) — generates fake identity data via Chrome's built-in Prompt API (Gemini Nano) using `value.prompt`. Requires the `aiLanguageModel` permission and `minimum_chrome_version: 138`. Every `llm` entry must include a static `fallback`, used when the model is unavailable/unsupported/not-yet-downloaded so the extension degrades gracefully. Generation is **best-effort**: bounded by `BugMagnet.GENERATE_TIMEOUT_MS` (falls back on timeout), non-deterministic, and on-device (offline). The Prompt API global (`LanguageModel`) is read via the IIFE's `global`, so specs inject a fake `LanguageModel` on the Node global.

`resolveText` returns the string to insert, or `null` (nothing inserted). To add a new data kind, extend `renderValue` (sync) or `resolveText` (async) in `extension.js` and reference it via `_type` in `config.json`. Adding static test data requires only editing `config.json`.

## Testing notes

- `test-lib/node-bootstrap.js` (a Jasmine helper) sets up jsdom globals (`window`/`document`/`self`), then loads `test-lib/fake-chrome-api.js` and `src/extension.js` so its load-time listener registrations happen once before specs run. Order matters: fake chrome before source.
- `test-lib/fake-chrome-api.js` is a Jasmine spy stub of the MV3 `chrome.*` surface (`runtime.onInstalled/onStartup/getURL`, `contextMenus.create/removeAll/onClicked`, `scripting.executeScript`).
- `test/background-spec.js` covers the wiring (id encode/decode, `renderValue`/`resolveText`, `onClicked` → `executeScript` dispatch, install/startup rebuild, `buildMenus`, the LLM/timeout/fallback matrix). `test/insert-value-spec.js` exercises `insertValue` against a real (jsdom) DOM (focus, contenteditable, empty string) — jsdom handles these faithfully.
