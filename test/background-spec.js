/*global describe, it, expect, BugMagnet, beforeEach, afterEach, chrome, self, jasmine, global, spyOn, console*/
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
		var lastInjection = function () {
			return chrome.scripting.executeScript.calls.mostRecent().args[0];
		};
		beforeEach(function () {
			chrome.scripting.executeScript.calls.reset();
		});
		afterEach(function () {
			chrome.scripting.executeScript.and.stub();
			delete global.LanguageModel;
		});
		it('is registered once at startup', function () {
			expect(chrome.contextMenus.onClicked.addListener.calls.count()).toBe(1);
			expect(handler() instanceof Function).toBeTruthy();
		});
		it('injects the resolved text into the clicked frame', async function () {
			handler()({menuItemId: '3:{"_type":"literal","value":"xyz"}', frameId: 0}, {id: 5});
			await flush();
			expect(chrome.scripting.executeScript).toHaveBeenCalled();
			expect(lastInjection().target).toEqual({tabId: 5, frameIds: [0]});
			expect(lastInjection().func).toBe(BugMagnet.insertValue);
			expect(lastInjection().args).toEqual(['xyz']);
		});
		it('targets only the tab when no frameId is provided', async function () {
			handler()({menuItemId: '3:{"_type":"literal","value":"z"}'}, {id: 5});
			await flush();
			expect(lastInjection().target).toEqual({tabId: 5});
		});
		it('does nothing for an id without an encoded value', async function () {
			handler()({menuItemId: 'garbage'}, {id: 5});
			await flush();
			expect(chrome.scripting.executeScript).not.toHaveBeenCalled();
		});
		it('does nothing when there is no tab', async function () {
			handler()({menuItemId: '3:{"_type":"literal","value":"xyz"}'}, undefined);
			await flush();
			expect(chrome.scripting.executeScript).not.toHaveBeenCalled();
		});
		it('injects the generated string for an llm value', async function () {
			global.LanguageModel = {
				availability: function () { return Promise.resolve('available'); },
				create: function () {
					return Promise.resolve({
						prompt: function () { return Promise.resolve('{"value":"Generated Name"}'); },
						destroy: function () {}
					});
				}
			};
			handler()({menuItemId: '9:{"_type":"llm","prompt":"p","fallback":"F"}', frameId: 0}, {id: 5});
			await flush();
			expect(lastInjection().args).toEqual(['Generated Name']);
		});
		it('does not inject when the value resolves to null', async function () {
			/* llm with no fallback and no model available -> resolveText yields null */
			handler()({menuItemId: '9:{"_type":"llm","prompt":"p"}', frameId: 0}, {id: 5});
			await flush();
			expect(chrome.scripting.executeScript).not.toHaveBeenCalled();
		});
		it('logs and does not throw when injection is rejected', async function () {
			var debugSpy = spyOn(console, 'debug');
			chrome.scripting.executeScript.and.returnValue(Promise.reject(new Error('frame gone')));
			handler()({menuItemId: '3:{"_type":"literal","value":"xyz"}', frameId: 0}, {id: 5});
			await flush();
			expect(debugSpy).toHaveBeenCalled();
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

	describe('renderValue', function () {
		it('returns a literal value as its string', function () {
			expect(BugMagnet.renderValue({'_type': 'literal', value: 'x'})).toBe('x');
		});
		it('returns an empty literal as an empty string, not a failure', function () {
			expect(BugMagnet.renderValue({'_type': 'literal', value: ''})).toBe('');
		});
		it('computes a size value by repeating the template', function () {
			expect(BugMagnet.renderValue({'_type': 'size', size: '20', template: '1234567'})).toBe('12345671234567123456');
		});
		it('returns false for a size value with an empty template', function () {
			expect(BugMagnet.renderValue({'_type': 'size', size: '5', template: ''})).toBe(false);
		});
		it('returns false for an unknown type', function () {
			expect(BugMagnet.renderValue({'_type': 'nope'})).toBe(false);
		});
	});

	describe('resolveText', function () {
		var fakeSession;
		afterEach(function () {
			delete global.LanguageModel;
		});
		it('resolves a literal value to its string', async function () {
			expect(await BugMagnet.resolveText({'_type': 'literal', value: 'x'})).toBe('x');
		});
		it('resolves a size value to the computed string', async function () {
			expect(await BugMagnet.resolveText({'_type': 'size', size: '5', template: 'ab'})).toBe('ababa');
		});
		it('returns null for a value that renders to a failure', async function () {
			expect(await BugMagnet.resolveText({'_type': 'nope'})).toBeNull();
		});
		it('generates text from an llm value when the model is available', async function () {
			fakeSession = {
				prompt: jasmine.createSpy('prompt').and.returnValue(Promise.resolve('{"value":"Jane Fake"}')),
				destroy: jasmine.createSpy('destroy')
			};
			global.LanguageModel = {
				availability: function () { return Promise.resolve('available'); },
				create: jasmine.createSpy('create').and.returnValue(Promise.resolve(fakeSession))
			};
			expect(await BugMagnet.resolveText({'_type': 'llm', prompt: 'p', fallback: 'F'})).toBe('Jane Fake');
			expect(fakeSession.destroy).toHaveBeenCalled();
		});
		it('falls back to the static value when the model is unavailable', async function () {
			global.LanguageModel = {
				availability: function () { return Promise.resolve('unavailable'); },
				create: function () { return Promise.resolve({}); }
			};
			expect(await BugMagnet.resolveText({'_type': 'llm', prompt: 'p', fallback: 'Patrick Adams'})).toBe('Patrick Adams');
		});
		it('falls back to the static value when the Prompt API is absent', async function () {
			expect(await BugMagnet.resolveText({'_type': 'llm', prompt: 'p', fallback: 'Naomi'})).toBe('Naomi');
		});
		it('returns null for an llm value with no fallback when generation fails', async function () {
			expect(await BugMagnet.resolveText({'_type': 'llm', prompt: 'p'})).toBeNull();
		});
		it('falls back to the static value when generation exceeds the timeout', async function () {
			var originalTimeout = BugMagnet.GENERATE_TIMEOUT_MS;
			BugMagnet.GENERATE_TIMEOUT_MS = 10;
			global.LanguageModel = {
				availability: function () { return Promise.resolve('available'); },
				create: function () {
					return Promise.resolve({
						prompt: function () { return new Promise(function () {}); }, /* never resolves */
						destroy: function () {}
					});
				}
			};
			var resolved = await BugMagnet.resolveText({'_type': 'llm', prompt: 'p', fallback: 'Static'});
			BugMagnet.GENERATE_TIMEOUT_MS = originalTimeout;
			expect(resolved).toBe('Static');
		});
	});

	describe('warmUpModel', function () {
		it('does nothing when the model is already available', function () {
			var model = {create: jasmine.createSpy('create')};
			BugMagnet.warmUpModel(model, 'available');
			expect(model.create).not.toHaveBeenCalled();
		});
		it('starts the background download only once for a downloadable model', async function () {
			var model = {create: jasmine.createSpy('create').and.returnValue(Promise.resolve({destroy: function () {}}))};
			BugMagnet.warmUpModel(model, 'downloadable');
			BugMagnet.warmUpModel(model, 'downloadable');
			expect(model.create.calls.count()).toBe(1);
			await new Promise(function (resolve) { setTimeout(resolve, 0); }); /* let the guard reset */
		});
	});
});
