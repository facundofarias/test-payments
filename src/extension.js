/* global chrome, fetch, document, console */
(function (global) {
	'use strict';
	var BugMagnet = global.BugMagnet = global.BugMagnet || {},
		warmingUp = false;

	BugMagnet.processConfigText = function (configText, menuBuilder) {
		var processMenuObject = function (configObject, parentMenu) {
				var getTitle = function (key) {
						if (configObject instanceof Array) {
							return configObject[key];
						}
						return key;
					};
				if (!configObject) {
					return;
				}
				Object.keys(configObject).forEach(function (key) {
					var value = configObject[key],
						title = getTitle(key);
					if (typeof value === 'string' || (typeof value === 'object' && value.hasOwnProperty('_type'))) {
						menuBuilder.menuItem(title, parentMenu, value);
					} else if (typeof value === 'object') {
						var result = menuBuilder.subMenu(title, parentMenu);
						processMenuObject(value, result);
					}
				});
			},
			config = JSON.parse(configText),
			rootMenu = menuBuilder.rootMenu('Test Payments');
		processMenuObject(config, rootMenu);
	};

	/* Manifest V3 forbids onclick handlers on context menu items, so the value
	   to insert is encoded into each item's id. A single onClicked listener then
	   decodes it. This keeps click handling stateless, which matters because the
	   background service worker can be torn down and restarted at any time. */
	BugMagnet.normaliseMenuValue = function (value) {
		if (typeof value === 'string') {
			return {'_type': 'literal', value: value};
		}
		return value;
	};

	BugMagnet.valueFromMenuId = function (menuItemId) {
		var id = String(menuItemId),
			separator = id.indexOf(':');
		if (separator < 0) {
			return false;
		}
		try {
			return JSON.parse(id.substring(separator + 1));
		} catch (e) {
			return false;
		}
	};

	BugMagnet.ChromeMenuBuilder = function () {
		var self = this,
			sequence = 0;
		/* MV3 service workers require an explicit id on every context menu item.
		   Containers get a plain "menu-N" id; leaf items encode their value after
		   a ":" so the onClicked listener can decode it (see valueFromMenuId). */
		self.rootMenu = function (title) {
			var id = 'menu-' + (sequence++);
			chrome.contextMenus.create({'id': id, 'title': title, 'contexts': ['editable']});
			return id;
		};
		self.subMenu = function (title, parentMenu) {
			var id = 'menu-' + (sequence++);
			chrome.contextMenus.create({'id': id, 'title': title, 'parentId': parentMenu, 'contexts': ['editable']});
			return id;
		};
		self.menuItem = function (title, parentMenu, value) {
			/* sequence prefix guarantees a unique id even when two items share a value */
			var id = (sequence++) + ':' + JSON.stringify(BugMagnet.normaliseMenuValue(value));
			chrome.contextMenus.create({'id': id, 'title': title, 'parentId': parentMenu, 'contexts': ['editable']});
			return id;
		};
	};

	BugMagnet.buildMenus = function () {
		return new Promise(function (resolve) {
			chrome.contextMenus.removeAll(resolve);
		}).then(function () {
			return fetch(chrome.runtime.getURL('config.json'));
		}).then(function (response) {
			return response.text();
		}).then(function (configText) {
			BugMagnet.processConfigText(configText, new BugMagnet.ChromeMenuBuilder());
		});
	};

	/* Chrome's built-in Gemini Nano (Prompt API) generates fake identity data on
	   the fly for `_type: 'llm'` menu items. It runs on-device in this service
	   worker; every such item carries a static `fallback` so the extension still
	   works when the model is unavailable (old Chrome, unsupported hardware, not
	   yet downloaded). See https://developer.chrome.com/docs/extensions/ai/prompt-api */
	BugMagnet.GENERATE_SYSTEM_PROMPT = 'You generate entirely fictional data for software testing. Never use real people or real personal information. Reply with only the requested value: no quotes, labels, or explanation.';

	BugMagnet.extractGeneratedValue = function (raw) {
		var text = String(raw).trim();
		try {
			var parsed = JSON.parse(text);
			if (parsed && typeof parsed === 'object' && typeof parsed.value === 'string') {
				return parsed.value.trim();
			}
			if (typeof parsed === 'string') {
				return parsed.trim();
			}
		} catch (ignore) {
			/* model returned plain text rather than JSON - fall through */
		}
		return text.split('\n')[0].replace(/^["']+|["']+$/g, '').trim();
	};

	/* Prompt API availability is 'available' | 'downloadable' | 'downloading' |
	   'unavailable'. On 'downloadable' we kick off a one-time background download
	   (guarded so repeated clicks don't spawn concurrent downloads) and fall back
	   for the current click. */
	BugMagnet.warmUpModel = function (model, status) {
		if (status !== 'downloadable' || warmingUp) {
			return;
		}
		warmingUp = true;
		Promise.resolve(model.create()).then(function (session) {
			session.destroy();
		}).catch(function () {}).then(function () {
			warmingUp = false;
		});
	};

	/* The service worker can be evicted mid-request, and generation can be slow;
	   bound it so a hung/slow model falls back instead of leaving the click with
	   no result. Insertion is best-effort: if focus moves during generation the
	   value lands wherever focus is at receipt time (see insertValue). */
	BugMagnet.GENERATE_TIMEOUT_MS = 8000;

	BugMagnet.generateValue = function (prompt) {
		var model = global.LanguageModel;
		if (!model) {
			return Promise.reject(new Error('Prompt API unavailable'));
		}
		var generation = Promise.resolve(model.availability()).then(function (status) {
			if (status !== 'available') {
				BugMagnet.warmUpModel(model, status);
				throw new Error('model not ready: ' + status);
			}
			return model.create({
				initialPrompts: [{role: 'system', content: BugMagnet.GENERATE_SYSTEM_PROMPT}]
			});
		}).then(function (session) {
			return Promise.resolve(session.prompt(prompt, {
				responseConstraint: {type: 'object', properties: {value: {type: 'string'}}, required: ['value']}
			})).then(function (raw) {
				session.destroy();
				return BugMagnet.extractGeneratedValue(raw);
			}, function (error) {
				session.destroy();
				throw error;
			});
		});
		var timeout = new Promise(function (resolve, reject) {
			var timer = setTimeout(function () {
				reject(new Error('generation timed out'));
			}, BugMagnet.GENERATE_TIMEOUT_MS);
			if (timer && timer.unref) {
				timer.unref();
			}
		});
		return Promise.race([generation, timeout]);
	};

	/* Synchronous generators (previously in the content script). Returns the
	   string to insert, or false on failure. `llm` is handled in resolveText. */
	BugMagnet.renderValue = function (value) {
		if (typeof value === 'string') {
			return value;
		}
		if (!value || typeof value !== 'object') {
			return false;
		}
		if (value._type === 'literal') {
			return typeof value.value === 'string' ? value.value : false;
		}
		if (value._type === 'size') {
			var size = parseInt(value.size, 10),
				out = value.template;
			if (typeof out !== 'string' || !out || !(size > 0)) {
				return false;
			}
			while (out.length < size) {
				out += value.template;
			}
			return out.substring(0, size);
		}
		return false;
	};

	/* Resolves a decoded menu value to the final string to insert, or null. */
	BugMagnet.resolveText = function (value) {
		if (value && value._type === 'llm') {
			return BugMagnet.generateValue(value.prompt).then(function (text) {
				return text;
			}, function () {
				return Object.prototype.hasOwnProperty.call(value, 'fallback') ? value.fallback : null;
			});
		}
		var rendered = BugMagnet.renderValue(value);
		return Promise.resolve(rendered === false ? null : rendered);
	};

	/* Injected into the clicked frame via chrome.scripting.executeScript. Must be
	   self-contained (no closure references) so it can be serialised and run in
	   the page. Runs in the frame the user right-clicked, so document.activeElement
	   is the target field - no cross-frame drilling needed. */
	BugMagnet.insertValue = function (text) {
		var element = document.activeElement;
		if (!element || typeof text !== 'string') {
			return;
		}
		if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
			element.value = text;
		} else if (element.hasAttribute && element.hasAttribute('contenteditable')) {
			element.innerText = text;
		}
	};

	if (typeof chrome !== 'undefined' && chrome.contextMenus && chrome.contextMenus.onClicked) {
		chrome.contextMenus.onClicked.addListener(function (info, tab) {
			var value = BugMagnet.valueFromMenuId(info.menuItemId);
			if (!value || !tab || tab.id === undefined) {
				return;
			}
			BugMagnet.resolveText(value).then(function (text) {
				if (typeof text !== 'string') {
					return;
				}
				var target = {tabId: tab.id};
				if (typeof info.frameId === 'number') {
					target.frameIds = [info.frameId];
				}
				/* activeTab (granted by the menu click) lets us inject into the
				   clicked frame without a persistent content script or host access.
				   Note: activeTab does not extend to cross-origin child frames, so
				   fields hosted in third-party iframes (e.g. Stripe/Braintree hosted
				   card fields) can't be filled - the same same-domain-only limitation
				   the previous content-script build had. */
				Promise.resolve(chrome.scripting.executeScript({
					target: target,
					func: BugMagnet.insertValue,
					args: [text]
				})).catch(function (error) {
					/* frame navigated/closed, or a restricted/cross-origin frame */
					console.debug('Test Payments: could not insert value', error);
				});
			});
		});
		chrome.runtime.onInstalled.addListener(BugMagnet.buildMenus);
		chrome.runtime.onStartup.addListener(BugMagnet.buildMenus);
	}
})(typeof self !== 'undefined' ? self : this);
