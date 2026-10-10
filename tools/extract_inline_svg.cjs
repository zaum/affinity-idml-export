'use strict';

const fs = require('node:fs');

function parseSvg(source) {
    const root = { tag: 'root', attrs: {}, children: [], parent: null, text: '' };
    const stack = [root];
    const tokens = /<\/?[A-Za-z][^>]*>|[^<]+/g;
    for (const part of source.match(tokens) || []) {
        if (!part.startsWith('<')) {
            if (stack.some(node => node.tag === 'text' || node.tag === 'tspan'))
                stack[stack.length - 1].text += part;
            continue;
        }
        if (part.startsWith('</')) { if (stack.length > 1) stack.pop(); continue; }
        const match = part.match(/^<([A-Za-z][\w:-]*)/);
        if (!match) continue;
        const attrs = {};
        for (const a of part.matchAll(/([:\w-]+)="([^"]*)"/g)) attrs[a[1]] = a[2];
        const node = { tag: match[1].split(':').pop(), attrs, children: [],
            parent: stack[stack.length - 1], text: '' };
        node.parent.children.push(node);
        if (!part.endsWith('/>')) stack.push(node);
    }
    return root.children[0];
}

function descendants(node, predicate) {
    const found = [];
    for (const child of node.children) {
        if (predicate(child)) found.push(child);
        found.push(...descendants(child, predicate));
    }
    return found;
}

function normalizedText(node) {
    const parts = descendants(node, item => item.tag === 'text').map(item =>
        item.text + descendants(item, child => child.tag === 'tspan').map(x => x.text).join(''));
    return parts.join('').replace(/&(?:amp|lt|gt|quot|apos);/g, '').replace(/\s+/g, '');
}

function groupsForInlineVectors(svg, sourceText, count) {
    const wanted = sourceText.replace(/\s+/g, '');
    return descendants(svg, node => node.tag === 'g').filter(group => {
        const textChildren = group.children.filter(child => normalizedText(child));
        const graphics = group.children.filter(child => !normalizedText(child) &&
            descendants(child, item => ['path', 'circle', 'rect', 'ellipse', 'polygon'].includes(item.tag)).length);
        return textChildren.length === 1 && graphics.length === count &&
            normalizedText(textChildren[0]).startsWith(wanted.slice(0, 12));
    });
}

const identity = [1, 0, 0, 1, 0, 0];
function multiply(a, b) {
    return [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1],
        a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3],
        a[0] * b[4] + a[2] * b[5] + a[4],
        a[1] * b[4] + a[3] * b[5] + a[5]];
}
function matrixFor(node) {
    let out = identity;
    const chain = [];
    for (let part = node; part; part = part.parent) chain.unshift(part);
    for (const part of chain) {
        const transform = part.attrs.transform;
        if (!transform) continue;
        const match = transform.match(/^matrix\(([^)]+)\)$/);
        if (!match) throw new Error('Unsupported SVG transform: ' + transform);
        const m = match[1].split(/[\s,]+/).map(Number);
        if (m.length !== 6 || m.some(x => !Number.isFinite(x)))
            throw new Error('Invalid SVG transform: ' + transform);
        out = multiply(out, m);
    }
    return out;
}
function point(m, x, y, viewBox, page) {
    const px = m[0] * x + m[2] * y + m[4];
    const py = m[1] * x + m[3] * y + m[5];
    return { x: (px - viewBox[0]) * page.width / viewBox[2],
        y: (py - viewBox[1]) * page.height / viewBox[3] };
}
function readFill(node) {
    for (let item = node; item; item = item.parent) {
        const style = item.attrs.style || '';
        const value = (style.match(/(?:^|;)fill:\s*([^;]+)/) || [])[1] || item.attrs.fill;
        if (!value) continue;
        if (value === 'none') return null;
        const rgb = value.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
        if (rgb) return { space: 'RGB', values: rgb.slice(1).map(Number), alpha: 1 };
        if (value === 'white') return { space: 'RGB', values: [255, 255, 255], alpha: 1 };
        if (value === 'black') return { space: 'RGB', values: [0, 0, 0], alpha: 1 };
        throw new Error('Unsupported SVG fill: ' + value);
    }
    return { space: 'RGB', values: [0, 0, 0], alpha: 1 };
}
function pathPoint(p) { return { anchor: p, left: p, right: p }; }
function circlePath(node, viewBox, page) {
    const cx = Number(node.attrs.cx), cy = Number(node.attrs.cy), r = Number(node.attrs.r);
    if (!(r > 0)) throw new Error('Invalid SVG circle.');
    const k = r * 0.552284749831;
    const m = matrixFor(node);
    const anchor = (x, y) => point(m, x, y, viewBox, page);
    return { closed: true, points: [
        { anchor: anchor(cx + r, cy), left: anchor(cx + r, cy - k), right: anchor(cx + r, cy + k) },
        { anchor: anchor(cx, cy + r), left: anchor(cx + k, cy + r), right: anchor(cx - k, cy + r) },
        { anchor: anchor(cx - r, cy), left: anchor(cx - r, cy + k), right: anchor(cx - r, cy - k) },
        { anchor: anchor(cx, cy - r), left: anchor(cx - k, cy - r), right: anchor(cx + k, cy - r) }
    ] };
}
function svgPath(node, viewBox, page) {
    const tokens = (node.attrs.d || '').match(/[A-Za-z]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g) || [];
    const m = matrixFor(node), paths = [];
    let i = 0, command = '', x = 0, y = 0, startX = 0, startY = 0, path = null;
    const pointAt = (a, b) => point(m, a, b, viewBox, page);
    while (i < tokens.length) {
        if (/^[A-Za-z]$/.test(tokens[i])) command = tokens[i++];
        if (!command) throw new Error('SVG path has no command.');
        const upper = command.toUpperCase(), relative = command !== upper;
        if (upper === 'Z') {
            if (path) path.closed = true;
            x = startX; y = startY; command = ''; continue;
        }
        const count = { M: 2, L: 2, H: 1, V: 1, C: 6 }[upper];
        if (!count || i + count > tokens.length) throw new Error('Unsupported SVG path command: ' + command);
        const n = tokens.slice(i, i + count).map(Number); i += count;
        if (n.some(v => !Number.isFinite(v))) throw new Error('Invalid SVG path coordinate.');
        let nx = x, ny = y;
        if (upper === 'H') nx = (relative ? x : 0) + n[0];
        else if (upper === 'V') ny = (relative ? y : 0) + n[0];
        else { nx = (relative ? x : 0) + n[count - 2]; ny = (relative ? y : 0) + n[count - 1]; }
        if (upper === 'M') {
            path = { closed: false, points: [pathPoint(pointAt(nx, ny))] };
            paths.push(path); startX = nx; startY = ny;
            command = relative ? 'l' : 'L';
        } else {
            if (!path) throw new Error('SVG path segment before move.');
            const next = pathPoint(pointAt(nx, ny));
            if (upper === 'C') {
                path.points[path.points.length - 1].right = pointAt((relative ? x : 0) + n[0],
                    (relative ? y : 0) + n[1]);
                next.left = pointAt((relative ? x : 0) + n[2], (relative ? y : 0) + n[3]);
            }
            path.points.push(next);
        }
        x = nx; y = ny;
    }
    return paths.filter(item => item.points.length > 1);
}

function editableInlineVectors(svg, sourceText, count, page) {
    const viewBox = String(svg.attrs.viewBox || '').split(/[\s,]+/).map(Number);
    if (viewBox.length !== 4 || !(viewBox[2] > 0) || !(viewBox[3] > 0))
        throw new Error('SVG page viewBox is unavailable.');
    const groups = groupsForInlineVectors(svg, sourceText, count);
    if (groups.length !== 1) throw new Error('Inline-vector SVG group is ambiguous (' + groups.length + ').');
    const graphics = groups[0].children.filter(child => !normalizedText(child));
    const result = [];
    for (const group of graphics) {
        const shapes = descendants(group, child => ['circle', 'path'].includes(child.tag));
        if (!shapes.length) throw new Error('Inline vector group has no supported shapes.');
        for (const shape of shapes) {
            const paths = shape.tag === 'circle' ? [circlePath(shape, viewBox, page)] :
                svgPath(shape, viewBox, page);
            if (!paths.length) throw new Error('Inline SVG path is empty.');
            result.push({ kind: 'vector', paths, fill: readFill(shape), stroke: null,
                strokeWeight: 0 });
        }
    }
    return result;
}

function inlineTextBaselines(svg, sourceText, count, page) {
    const viewBox = String(svg.attrs.viewBox || '').split(/[\s,]+/).map(Number);
    const groups = groupsForInlineVectors(svg, sourceText, count);
    if (groups.length !== 1) throw new Error('Inline-text SVG group is ambiguous.');
    const lines = descendants(groups[0], item => item.tag === 'text');
    return lines.map(line => {
        const x = parseFloat(line.attrs.x), y = parseFloat(line.attrs.y);
        if (!Number.isFinite(x) || !Number.isFinite(y))
            throw new Error('SVG text baseline is unreadable.');
        return point(matrixFor(line), x, y, viewBox, page);
    }).sort((a, b) => a.y - b.y);
}

if (require.main === module) {
    const source = fs.readFileSync(process.argv[2], 'utf8');
    const svg = parseSvg(source);
    const text = process.argv[3];
    const count = Number(process.argv[4]);
    const matches = text ? groupsForInlineVectors(svg, text, count) :
        descendants(svg, node => node.tag === 'g').filter(group => {
            const textChildren = group.children.filter(child => normalizedText(child));
            const graphics = group.children.filter(child => !normalizedText(child) &&
                descendants(child, item => ['path', 'circle', 'rect', 'ellipse', 'polygon'].includes(item.tag)).length);
            return textChildren.length === 1 && graphics.length === count;
        });
    process.stdout.write(JSON.stringify({ matches: matches.length,
        texts: matches.map(normalizedText),
        graphics: matches.map(group => group.children.filter(child => !normalizedText(child))
            .map(child => ({ tag: child.tag, shapeTags: descendants(child, x =>
                ['path', 'circle', 'rect', 'ellipse', 'polygon'].includes(x.tag)).map(x => x.tag) }))),
        vectors: text ? editableInlineVectors(svg, text, count, { width: 1600, height: 1600 }).length : null
    }, null, 2));
}

module.exports = { parseSvg, descendants, normalizedText, groupsForInlineVectors,
    editableInlineVectors, inlineTextBaselines };
