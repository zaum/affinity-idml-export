'use strict';
const { Document, FileExportOptions, FileExportArea } = require('/document');
const { Selection } = require('/selections');
const doc = Document.all.find(d => String(d.title || '') === 'FB-tavasz-820x360.ai');
if (!doc) throw new Error('FB-tavasz source is not open.');
const textNodes = Array.from(doc.layers.all).filter(n =>
    (n.isArtTextNode || n.isFrameTextNode) && n.isVisibleInDomain !== false);
let hidden = false;
try {
    doc.hideSelection(Selection.create(doc, textNodes));
    hidden = true;
    const path = 'C:/Users/peter/Desktop/FB-tavasz-820x360 IDML export 3/artwork-only.png';
    const records = doc.export(path, FileExportOptions.createWithPresetName('PNG'),
        FileExportArea.createForPages('1'));
    const first = records && records.all && records.all[0];
    if (!first || !first.isSuccess) throw new Error(first ? first.errorMessage : 'No PNG export record');
    console.log(JSON.stringify({ path: first.path, textNodes: textNodes.length }));
} finally {
    if (hidden) doc.undo();
    if (textNodes.some(n => n.isVisibleInDomain === false))
        throw new Error('Text visibility was not restored.');
}
