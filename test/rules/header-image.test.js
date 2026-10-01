import {describe, it} from 'node:test';
import assert from 'node:assert/strict';
import remarkLint from 'remark-lint';
import lint from '../_lint.js';
import headerImageRule from '../../rules/header-image.js';

const config = {
	plugins: [
		remarkLint,
		headerImageRule,
	],
};

const fixture = name => `test/fixtures/header-image/${name}.md`;

describe('rules › header-image', () => {
	it('allows a readme without a header image', async () => {
		assert.deepEqual(await lint({config, filename: fixture('success-no-image')}), []);
	});

	it('ignores the Awesome badge inside the main heading', async () => {
		assert.deepEqual(await lint({config, filename: fixture('success-badge-only')}), []);
	});

	it('allows SVG header images before the main heading', async () => {
		assert.deepEqual(await lint({config, filename: fixture('success-svg')}), []);
	});

	it('does not treat later decorative images as the header image', async () => {
		assert.deepEqual(await lint({config, filename: fixture('success-decorative-images')}), []);
	});

	it('allows a HiDPI-named image immediately after the main heading', async () => {
		assert.deepEqual(await lint({config, filename: fixture('success-layouts')}), []);
	});

	it('allows a local raster rendered at half its intrinsic width', async () => {
		assert.deepEqual(await lint({config, filename: fixture('success-intrinsic-width')}), []);
	});

	it('rejects a standard-resolution image immediately after the main heading', async () => {
		assert.deepEqual(await lint({config, filename: fixture('error-after-heading')}), [
			{
				line: 3,
				ruleId: 'awesome-header-image',
				message: 'Header image must be SVG or a high-DPI raster image',
			},
		]);
	});

	it('rejects a Markdown image immediately after the main heading', async () => {
		assert.deepEqual(await lint({config, filename: fixture('error-markdown-after-heading')}), [
			{
				line: 3,
				ruleId: 'awesome-header-image',
				message: 'Header image must be SVG or a high-DPI raster image',
			},
		]);
	});

	it('rejects a standard-resolution image inside the main heading', async () => {
		assert.deepEqual(await lint({config, filename: fixture('error-in-heading')}), [
			{
				line: 1,
				ruleId: 'awesome-header-image',
				message: 'Header image must be SVG or a high-DPI raster image',
			},
		]);
	});

	it('rejects a standard-resolution image before the main heading', async () => {
		assert.deepEqual(await lint({config, filename: fixture('error-before-heading')}), [
			{
				line: 1,
				ruleId: 'awesome-header-image',
				message: 'Header image must be SVG or a high-DPI raster image',
			},
		]);
	});
});
