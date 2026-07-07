/*global describe, it, expect, BugMagnet, beforeEach, afterEach, chrome, self, jasmine, global*/
describe('Background service worker', function () {
	'use strict';

	/* let queued promises settle (dispatch resolves the value asynchronously) */
	var flush = function () {
		return new Promise(function (resolve) { setTimeout(resolve, 0); });
	};

	describe('valueFromMenuId', function () {
		it('decodes the value encoded into a menu item id', function () {
			expect(BugMagnet.valueFromMenuId('7:{"_type":"literal","value":"hello"}'))
				.toEqual({'_type': 'literal', value: 'hello'});
		});
		it('returns false for an id without an encoded value', function () {
			expect(BugMagnet.valueFromMenuId('no-separator-here')).toBe(false);
		});
		it('returns false when the encoded value is not valid JSON', function () {
			expect(BugMagnet.valueFromMenuId('7:not json')).toBe(false);
		});
	});

	describe('onClicked handler', function () {
		var handler = function () {
			return chrome.contextMenus.onClicked.addListener.calls.first().args[0];
		};
		beforeEach(function () {
			chrome.tabs.sendMessage.calls.reset();
		});
		it('is registered once at startup', function () {
			expect(chrome.contextMenus.onClicked.addListener.calls.count()).toBe(1);
			expect(handler() instanceof Function).toBeTruthy();
		});
		it('sends the decoded value to the clicked tab', async function () {
			handler()({menuItemId: '3:{"_type":"literal","value":"xyz"}'}, {id: 5});
			await flush();
			expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(5, {'_type': 'literal', value: 'xyz'});
		});
		it('does nothing for an id without an encoded value', function () {
			handler()({menuItemId: 'garbage'}, {id: 5});
			expect(chrome.tabs.sendMessage).not.toHaveBeenCalled();
		});
		it('does nothing when there is no tab', function () {
			handler()({menuItemId: '3:{"_type":"literal","value":"xyz"}'}, undefined);
			expect(chrome.tabs.sendMessage).not.toHaveBeenCalled();
		});
	});

	describe('installation', function () {
		it('rebuilds the menu when the extension is installed', function () {
			expect(chrome.runtime.onInstalled.addListener).toHaveBeenCalledWith(BugMagnet.buildMenus);
		});
		it('rebuilds the menu when the browser starts up', function () {
			expect(chrome.runtime.onStartup.addListener).toHaveBeenCalledWith(BugMagnet.buildMenus);
		});
	});

	describe('buildMenus', function () {
		var originalFetch;
		beforeEach(function () {
			originalFetch = self.fetch;
			chrome.contextMenus.create.calls.reset();
			chrome.contextMenus.removeAll.and.callFake(function (callback) {
				callback();
			});
			chrome.runtime.getURL.and.callFake(function (path) {
				return 'chrome-extension://test/' + path;
			});
			self.fetch = jasmine.createSpy('fetch').and.returnValue(Promise.resolve({
				text: function () {
					return Promise.resolve('{"Group": {"Item": "value"}}');
				}
			}));
		});
		afterEach(function () {
			self.fetch = originalFetch;
		});
		it('clears existing menus, fetches config.json and rebuilds the menu tree', function (done) {
			BugMagnet.buildMenus().then(function () {
				expect(chrome.contextMenus.removeAll).toHaveBeenCalled();
				expect(self.fetch).toHaveBeenCalledWith('chrome-extension://test/config.json');
				/* root "Test Payments" + sub-menu "Group" + item "Item" */
				expect(chrome.contextMenus.create.calls.count()).toBe(3);
				expect(chrome.contextMenus.create.calls.first().args[0].title).toBe('Test Payments');
				done();
			}).catch(done.fail);
		});
	});

	describe('extractGeneratedValue', function () {
		it('reads the value field from JSON output', function () {
			expect(BugMagnet.extractGeneratedValue('{"value":"John Doe"}')).toBe('John Doe');
		});
		it('handles a bare JSON string', function () {
			expect(BugMagnet.extractGeneratedValue('"John Doe"')).toBe('John Doe');
		});
		it('strips surrounding quotes and trailing lines from plain text output', function () {
			expect(BugMagnet.extractGeneratedValue('  "John Doe"\nsome explanation ')).toBe('John Doe');
		});
	});

	describe('resolveMenuValue', function () {
		var fakeSession;
		afterEach(function () {
			delete global.LanguageModel;
		});
		it('passes literal values straight through untouched', async function () {
			var value = {'_type': 'literal', value: 'x'};
			expect(await BugMagnet.resolveMenuValue(value)).toBe(value);
		});
		it('passes size values straight through untouched', async function () {
			var value = {'_type': 'size', size: '5', template: 'ab'};
			expect(await BugMagnet.resolveMenuValue(value)).toBe(value);
		});
		it('generates a literal from an llm value when the model is available', async function () {
			fakeSession = {
				prompt: jasmine.createSpy('prompt').and.returnValue(Promise.resolve('{"value":"Jane Fake"}')),
				destroy: jasmine.createSpy('destroy')
			};
			global.LanguageModel = {
				availability: function () { return Promise.resolve('available'); },
				create: jasmine.createSpy('create').and.returnValue(Promise.resolve(fakeSession))
			};
			var resolved = await BugMagnet.resolveMenuValue({'_type': 'llm', prompt: 'p', fallback: 'F'});
			expect(resolved).toEqual({'_type': 'literal', value: 'Jane Fake'});
			expect(fakeSession.destroy).toHaveBeenCalled();
		});
		it('falls back to the static value when the model is unavailable', async function () {
			global.LanguageModel = {
				availability: function () { return Promise.resolve('unavailable'); },
				create: function () { return Promise.resolve({}); }
			};
			var resolved = await BugMagnet.resolveMenuValue({'_type': 'llm', prompt: 'p', fallback: 'Patrick Adams'});
			expect(resolved).toEqual({'_type': 'literal', value: 'Patrick Adams'});
		});
		it('falls back to the static value when the Prompt API is absent', async function () {
			var resolved = await BugMagnet.resolveMenuValue({'_type': 'llm', prompt: 'p', fallback: 'Naomi'});
			expect(resolved).toEqual({'_type': 'literal', value: 'Naomi'});
		});
		it('returns null for an llm value with no fallback when generation fails', async function () {
			var resolved = await BugMagnet.resolveMenuValue({'_type': 'llm', prompt: 'p'});
			expect(resolved).toBeNull();
		});
	});
});
