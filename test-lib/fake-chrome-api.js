/* global jasmine, self */
(function () {
	'use strict';
	var FakeChromeApi = function () {
		var api = this;
		api.runtime = {
			onMessage: jasmine.createSpyObj('chrome.runtime.onMessage', ['addListener']),
			onInstalled: jasmine.createSpyObj('chrome.runtime.onInstalled', ['addListener']),
			onStartup: jasmine.createSpyObj('chrome.runtime.onStartup', ['addListener']),
			getURL: jasmine.createSpy('chrome.runtime.getURL')
		};
		api.contextMenus = jasmine.createSpyObj('chrome.contextMenus', ['create', 'removeAll']);
		api.contextMenus.onClicked = jasmine.createSpyObj('chrome.contextMenus.onClicked', ['addListener']);
		api.tabs = jasmine.createSpyObj('chrome.tabs', ['sendMessage']);
	};
	self.chrome = new FakeChromeApi();
})();
