import fs from 'node:fs';
import path from 'node:path';
import {lintRule} from 'unified-lint-rule';

const htmlImagePattern = /<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi;

const isBadge = url => url.startsWith('https://awesome.re/badge') || url.includes('shields.io/');

const rasterWidth = buffer => {
	if (buffer.length >= 24 && buffer.toString('ascii', 1, 4) === 'PNG') {
		return buffer.readUInt32BE(16);
	}

	if (buffer.length < 4 || buffer[0] !== 0xFF || buffer[1] !== 0xD8) {
		return undefined;
	}

	let offset = 2;
	while (offset + 8 < buffer.length) {
		if (buffer[offset] !== 0xFF) {
			offset++;
			continue;
		}

		const marker = buffer[offset + 1];
		const size = buffer.readUInt16BE(offset + 2);
		if (size < 2 || offset + size + 2 > buffer.length) {
			return undefined;
		}

		if (marker === 0xC0 || marker === 0xC2) {
			return buffer.readUInt16BE(offset + 7);
		}

		offset += size + 2;
	}

	return undefined;
};

const isHighResolution = (image, file) => {
	const pathname = image.url.split(/[?#]/, 1)[0];
	const lowerPathname = pathname.toLowerCase();
	if (/\.svgz?$/.test(lowerPathname) || /@[2-9]x(?:\.[^.]+)?$/.test(lowerPathname)) {
		return true;
	}

	if (!image.displayWidth || /^[a-z]+:\/\//i.test(pathname)) {
		return false;
	}

	try {
		const width = rasterWidth(fs.readFileSync(path.resolve(file.dirname, pathname)));
		return width >= image.displayWidth * 2;
	} catch {
		return false;
	}
};

const markdownImages = node => {
	const images = [];

	if (node.type === 'image') {
		images.push({url: node.url, node});
	}

	for (const child of node.children ?? []) {
		images.push(...markdownImages(child));
	}

	return images;
};

const htmlImages = node => {
	if (node.type !== 'html') {
		return [];
	}

	return [...node.value.matchAll(htmlImagePattern)].map(match => ({
		url: match[1],
		displayWidth: Number.parseInt(/\bwidth\s*=\s*["']?(\d+)/i.exec(match[0])?.[1], 10) || undefined,
		node,
	}));
};

const imagesIn = node => [...markdownImages(node), ...htmlImages(node)];

const isImageOnly = node => {
	if (node.type === 'html') {
		return imagesIn(node).length > 0;
	}

	if (node.type !== 'paragraph') {
		return false;
	}

	return node.children.every(child => {
		if (child.type === 'image') {
			return true;
		}

		return child.type === 'link' && child.children.every(linkChild => linkChild.type === 'image');
	});
};

const findHeaderImages = ast => {
	const firstHeadingIndex = ast.children.findIndex(node => node.type === 'heading' && node.depth === 1);

	if (firstHeadingIndex === -1) {
		const firstNode = ast.children[0];
		return firstNode?.type === 'html' ? imagesIn(firstNode) : [];
	}

	const heading = ast.children[firstHeadingIndex];
	const beforeHeading = ast.children
		.slice(0, firstHeadingIndex)
		.filter(node => isImageOnly(node))
		.flatMap(node => imagesIn(node));
	const afterHeading = ast.children[firstHeadingIndex + 1];

	return [
		...beforeHeading,
		...imagesIn(heading),
		...(afterHeading && isImageOnly(afterHeading) ? imagesIn(afterHeading) : []),
	];
};

const headerImageRule = lintRule('remark-lint:awesome-header-image', (ast, file) => {
	const headerImage = findHeaderImages(ast).find(image => !isBadge(image.url));

	if (headerImage && !isHighResolution(headerImage, file)) {
		file.message('Header image must be SVG or a high-DPI raster image', headerImage.node);
	}
});

export default headerImageRule;
