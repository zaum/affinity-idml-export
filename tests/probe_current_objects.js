const { Document } = require('/document');
const doc = Document.current;
function box(node) {
    try { const b = node.getSpreadBaseBox(false); return [b.x,b.y,b.width,b.height]; }
    catch (_) { return null; }
}
const rows = [];
let count = 0;
for (const node of doc.layers.all) {
    if (++count > 500) break;
    const b = box(node);
    let name = '', text = '';
    try { name = String(node.name || ''); } catch (_) {}
    if (node.isFrameTextNode || node.isArtTextNode) {
        try { text = String(node.text || '').slice(0, 180); } catch (_) {}
    }
    rows.push({ name, type: node.isFrameTextNode ? 'frameText' :
        node.isArtTextNode ? 'artText' : node.isImageNode ? 'image' :
        node.isShapeNode ? 'shape' : node.isPolyCurveNode ? 'polyCurve' : 'other',
        box: b, text, visible: node.isVisibleInDomain });
}
console.log(JSON.stringify({ title: doc.title, count, rows }));
