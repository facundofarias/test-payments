/* global chrome, TestPayments */
(function () {
	'use strict';
	window.TestPayments = window.TestPayments || {};
	TestPayments.processConfigText = function (configText, menuBuilder) {
		var processMenuObject = function (configObject, parentMenu){
				var getTitle = function (key) {
						if (configObject instanceof Array) {
							return configObject[key];
						}
						return key;
					};
				if (!configObject) {
					return;
				}
				Object.keys(configObject).forEach(function(key) {
					var	value = configObject[key],
							title = getTitle(key);
					if (typeof(value) === 'string' || (typeof(value) === 'object' && value.hasOwnProperty('_type'))) {
						menuBuilder.menuItem(title, parentMenu, value);
					} else if (typeof(value) === 'object') {
						var result = menuBuilder.subMenu(title, parentMenu);
						processMenuObject(value, result);
					}
				});
			},
			config, rootMenu;
		config = JSON.parse(configText);
		rootMenu = menuBuilder.rootMenu('Test Payments');
		processMenuObject(config, rootMenu);
	};
	TestPayments.ChromeMenuBuilder = function () {
		var self = this,
				buildContentMessage = function (menuValue){
					if (typeof(menuValue)=== 'string') {
						menuValue = {_type:'literal', value: menuValue};
					}
					return function (info, tab) {
						chrome.tabs.sendMessage(tab.id, menuValue);
					};
				};
		self.rootMenu = function (title) {
			return chrome.contextMenus.create({'title': title, 'contexts': ['editable']});
		};
		self.subMenu = function (title, parentMenu) {
			 return chrome.contextMenus.create({'title': title, 'parentId': parentMenu, 'contexts': ['editable']});
		};
		self.menuItem = function (title, parentMenu, value) {
			return chrome.contextMenus.create({'title': title, 'parentId': parentMenu, 'contexts': ['editable'], onclick: buildContentMessage(value)});
		};
	};
	var processConfig = function () {
			var configText = this.responseText;
			TestPayments.processConfigText(configText, new TestPayments.ChromeMenuBuilder());
		},
		loadConfig = function () {
			var xhr = new XMLHttpRequest();
			xhr.open('GET', chrome.extension.getURL('config.json'));
			xhr.onload = processConfig;
			xhr.send();
		};
	loadConfig();
})();
