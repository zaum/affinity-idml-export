'use strict';
const { Document } = require('/document');
const doc = Document.current;
if (!doc) throw new Error('No open document.');
function label(node) {
    if (!node) return null;
    let value = '';
    try { value = String(node.userDescription || node.defaultDescriptionForDisplay || ''); } catch (_) {}
    return { type: String(node[Symbol.toStringTag] || ''), label: value,
        group: !!node.isGroupNode, image: !!node.isImageNode,
        shape: !!node.isShapeNode, spread: !!node.isSpreadNode,
        visible: node.isVisibleInDomain !== false };
}
const result = [];
for (const spread of doc.spreads) {
    let index = 0;
    const nodes = [];
    for (const node of spread.layers.all) {
        if (++index > 100) break;
        const parents = [];
        let parent = node.parent;
        for (let depth = 0; parent && depth < 8; depth++, parent = parent.parent)
            parents.push(label(parent));
        nodes.push({ node: label(node), parents });
    }
    result.push({ spread: result.length + 1, nodes });
}
console.log(JSON.stringify({ title: String(doc.title || ''), result }));
