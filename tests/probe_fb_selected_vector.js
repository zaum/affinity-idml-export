'use strict';
const { Document, FileExportOptions, FileExportArea } = require('/document');
const { Selection } = require('/selections');
const doc = Document.all.find(d => String(d.title || '') === 'FB-tavasz-820x360.ai');
if (!doc) throw new Error('FB-tavasz source is not open.');
const previous = Array.from(doc.selection.nodes);
const vectors = Array.from(doc.layers.all).filter(n => n.isPolyCurveNode && !n.parent.isGroupNode);
const results = [];
try {
    for (let i = 0; i < vectors.length; i++) {
        const selection = Selection.create(doc, [vectors[i]]);
        doc.selection = selection;
        const path = 'C:/Users/peter/Desktop/FB-tavasz-820x360 IDML export 3/selected-area-vector-' + (i + 1) + '.png';
        const records = doc.export(path, FileExportOptions.createWithPresetName('PNG'),
            FileExportArea.createForSelectionArea(doc.selection));
        const first = records && records.all && records.all[0];
        results.push({ index: i + 1, selected: Array.from(doc.selection.nodes).length,
            path: first && first.path, success: !!(first && first.isSuccess) });
    }
} finally {
    doc.selection = Selection.create(doc, previous);
}
console.log(JSON.stringify(results));
