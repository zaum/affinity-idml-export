'use strict';

const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const helper = fs.readFileSync(path.join(__dirname, 'extract_inline_svg.cjs'), 'utf8');
const start = helper.indexOf('function parseSvg(');
const end = helper.indexOf('if (require.main === module)');
if (start < 0 || end <= start) throw new Error('Could not find pure SVG helper functions.');
const target = path.join(root, 'finished scripts', 'Export to IDML v1.23.0.js');
let source = fs.readFileSync(target, 'utf8');
const marker = '    function safeNodeValue(node, key) {';
if (!source.includes(marker)) throw new Error('Exporter insertion point is missing.');
const functions = helper.slice(start, end).trimEnd().split('\n').map(line =>
    line ? '    ' + line : '').join('\n');
const oldStart = source.indexOf('    function parseSvg(source) {');
if (oldStart >= 0) source = source.slice(0, oldStart) + functions + '\n\n' +
    source.slice(source.indexOf(marker, oldStart));
else source = source.replace(marker, functions + '\n\n' + marker);
fs.writeFileSync(target, source);
