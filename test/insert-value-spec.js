/*global describe, it, expect, BugMagnet, beforeEach, afterEach, document*/
describe('BugMagnet.insertValue', function () {
	'use strict';
	/* insertValue is injected into the clicked frame and writes into whatever is
	   focused there. These exercise it directly against a real (jsdom) DOM. */
	var container, input, textArea, contentEditable;
	beforeEach(function () {
		container = document.createElement('div');
		container.innerHTML = '<input type="text" value="old"/>' +
			'<textarea>old</textarea>' +
			'<div contenteditable>old</div>';
		document.body.appendChild(container);
		input = container.getElementsByTagName('input')[0];
		textArea = container.getElementsByTagName('textarea')[0];
		contentEditable = container.getElementsByTagName('div')[0];
	});
	afterEach(function () {
		document.body.removeChild(container);
	});
	it('sets the value of a focused input', function () {
		input.focus();
		BugMagnet.insertValue('xyz');
		expect(input.value).toBe('xyz');
	});
	it('sets the value of a focused textarea', function () {
		textArea.focus();
		BugMagnet.insertValue('xyz');
		expect(textArea.value).toBe('xyz');
	});
	it('sets the innerText of a focused contenteditable element', function () {
		contentEditable.focus();
		BugMagnet.insertValue('xyz');
		expect(contentEditable.innerText).toBe('xyz');
	});
	it('sets an empty string rather than skipping it', function () {
		input.focus();
		BugMagnet.insertValue('');
		expect(input.value).toBe('');
	});
	it('does nothing when nothing editable is focused', function () {
		input.focus();
		input.blur();
		BugMagnet.insertValue('xyz');
		expect(input.value).toBe('old');
	});
	it('does nothing when the text is not a string', function () {
		input.focus();
		BugMagnet.insertValue(undefined);
		expect(input.value).toBe('old');
	});
});
