/*global describe, it, expect, BugMagnet, beforeEach, chrome*/
describe('BugMagnet.ChromeMenuBuilder', function () {
	'use strict';
	var underTest,
		lastMenu = function () {
			return chrome.contextMenus.create.calls.mostRecent().args[0];
		};
	beforeEach(function () {
		chrome.contextMenus.create.calls.reset();
		chrome.tabs.sendMessage.calls.reset();
		underTest = new BugMagnet.ChromeMenuBuilder();
	});
	describe('rootMenu', function () {
		it('creates a menu item without a parent', function () {
			underTest.rootMenu('test me');
			expect(chrome.contextMenus.create.calls.count()).toBe(1);
			expect(lastMenu().contexts).toEqual(['editable']);
			expect(lastMenu().title).toBe('test me');
			expect(lastMenu().parentId).toBeFalsy();
			expect(lastMenu().id).toBeFalsy();
		});
	});
	describe('subMenu', function () {
		it('creates a menu item with a parent', function () {
			underTest.subMenu('test me', 'root');
			expect(chrome.contextMenus.create.calls.count()).toBe(1);
			expect(lastMenu().contexts).toEqual(['editable']);
			expect(lastMenu().title).toBe('test me');
			expect(lastMenu().parentId).toBe('root');
			expect(lastMenu().id).toBeFalsy();
		});
	});
	describe('menuItem', function () {
		it('creates a menu item with a parent and a value-encoding id', function () {
			var id = underTest.menuItem('test me', 'root', 'some value');
			expect(chrome.contextMenus.create.calls.count()).toBe(1);
			expect(lastMenu().contexts).toEqual(['editable']);
			expect(lastMenu().title).toBe('test me');
			expect(lastMenu().parentId).toBe('root');
			expect(lastMenu().id).toBe(id);
		});
		it('encodes a plain string value as a literal that can be decoded from the id', function () {
			var id = underTest.menuItem('test me', 'root', 'some value');
			expect(BugMagnet.valueFromMenuId(id)).toEqual({'_type': 'literal', value: 'some value'});
		});
		it('encodes a hash object value verbatim into the id', function () {
			var id = underTest.menuItem('test me', 'root', {'_type': 'size', value: 'some value'});
			expect(BugMagnet.valueFromMenuId(id)).toEqual({'_type': 'size', value: 'some value'});
		});
		it('generates a unique id even for items sharing the same value', function () {
			var first = underTest.menuItem('one', 'root', 'same'),
				second = underTest.menuItem('two', 'root', 'same');
			expect(first).not.toBe(second);
		});
	});
});
