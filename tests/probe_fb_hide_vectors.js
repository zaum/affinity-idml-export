'use strict';
const { Document, FileExportOptions, FileExportArea } = require('/document');
const { Selection } = require('/selections');
const doc = Document.all.find(d => String(d.title || '') === 'FB-tavasz-820x360.ai');
if (!doc) throw new Error('FB-tavasz source is not open.');
const vectors = Array.from(doc.layers.all).filter(n =>
    n.isPolyCurveNode && !n.parent.isGroupNode);
const options = FileExportOptions.createWithPresetName('PNG');
const output = [];
for (let i = 0; i < vectors.length; i++) {
    const node = vectors[i];
    if (node.isVisibleInDomain === false) continue;
    const selection = Selection.create(doc, [node]);
    let hidden = false;
    try {
        doc.hideSelection(selection);
        hidden = true;
        const requested = 'C:/Users/peter/Desktop/FB-tavasz-820x360 IDML export 3/hide-vector-' + (i + 1) + '.png';
        const records = doc.export(requested, options, FileExportArea.createForPages('1'));
        const first = records && records.all && records.all[0];
        if (!first || !first.isSuccess) throw new Error(first ? first.errorMessage : 'No PNG export record');
        output.push({ index: i + 1, path: String(first.path) });
    } finally {
        if (hidden) doc.undo();
        if (node.isVisibleInDomain === false) throw new Error('Source vector visibility was not restored.');
    }
}
console.log(JSON.stringify(output));
