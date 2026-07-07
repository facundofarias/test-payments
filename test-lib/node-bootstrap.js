/*
 * Test bootstrap (loaded as a Jasmine helper, before any spec).
 *
 * The extension code is browser/service-worker code that talks to global
 * `self`, `document`, `window` and `chrome`. This sets those up under Node
 * using jsdom (for a faithful DOM: focus, contenteditable, iframes) and the
 * fake chrome API, then loads the source under test so its load-time listener
 * registrations happen exactly once before the specs run.
 */
'use strict';
var path = require('path');
var JSDOM = require('jsdom').JSDOM;

var dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', { url: 'https://localhost/' });

global.window = dom.window;
global.document = dom.window.document;
/* the extension's background script targets `self` (service worker global) */
global.self = global;

/* order matters: fake chrome first, then the source that registers against it */
require(path.resolve(__dirname, 'fake-chrome-api.js'));
require(path.resolve(__dirname, '..', 'src', 'extension.js'));
