'use strict';
const { Document, FileExportOptions, FileExportArea } = require('/document');
const { Selection } = require('/selections');
const doc = Document.all.find(d => String(d.title || '') === 'FB-tavasz-820x360.ai');
if (!doc) throw new Error('FB-tavasz source is not open.');
const groups = Array.from(doc.layers.all).filter(n => n.isGroupNode && !n.parent.isGroupNode);
const options = FileExportOptions.createWithPresetName('PNG');
const output = [];
for (let i = 0; i < groups.length; i++) {
    const node = groups[i];
    const sel = Selection.create(doc, [node]);
    const requested = 'C:/Users/peter/Desktop/FB-tavasz-820x360 IDML export 3/group-' + (i + 1) + '.png';
    const records = doc.export(requested, options, FileExportArea.createForSelection(sel));
    const first = records && records.all && records.all[0];
    output.push({ index: i + 1, box: node.getSpreadBaseBox(false),
        path: first && first.path, success: !!(first && first.isSuccess),
        error: first && first.errorMessage });
}
console.log(JSON.stringify(output));
