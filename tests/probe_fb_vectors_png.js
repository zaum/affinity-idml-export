'use strict';
const { Document, FileExportOptions, FileExportArea } = require('/document');
const { Selection } = require('/selections');
const doc = Document.all.find(d => String(d.title || '') === 'FB-tavasz-820x360.ai');
if (!doc) throw new Error('FB-tavasz source is not open.');
const nodes = Array.from(doc.layers.all).filter(n =>
    (n.isPolyCurveNode || n.isShapeNode) && !n.parent.isGroupNode && !n.parent.isSpreadNode);
const options = FileExportOptions.createWithPresetName('PNG');
const output = [];
for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const sel = Selection.create(doc, [node]);
    const requested = 'C:/Users/peter/Desktop/FB-tavasz-820x360 IDML export 3/vector-' + (i + 1) + '.png';
    const records = doc.export(requested, options, FileExportArea.createForSelection(sel));
    const first = records && records.all && records.all[0];
    output.push({ index: i + 1, box: node.getSpreadBaseBox(false),
        path: first && first.path, success: !!(first && first.isSuccess) });
}
console.log(JSON.stringify(output));
